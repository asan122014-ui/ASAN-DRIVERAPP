import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import verifyParent from "../middleware/verifyParent.js";
import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import { razorpayClient, razorpayConfig } from "../services/razorpayService.js";
import { monthlyAmount } from "../services/paymentRules.js";
import { reconcilePayment } from "../services/bookingPaymentService.js";

const router = express.Router();
const fail = (res, error) => {
  console.error("BOOKING PAYMENT ERROR", error.message);
  const status = error.statusCode === 401 ? 401 : error.status && error.status < 500 ? error.status : 500;
  return res.status(status).json({ success: false, message: status === 401 ? "Payment credentials were rejected. Please contact support." : status < 500 ? error.message : "Unable to process payment right now. Please try again later." });
};

router.use(verifyParent);
router.param("id", (req, res, next, id) => mongoose.Types.ObjectId.isValid(id) ? next() : res.status(400).json({ success: false, message: "Invalid booking ID" }));

router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const payment = await BookingPayment.findOne({ bookingId: booking._id }).select("amount currency status orderId paymentId paidAt environment provider");
    return res.json({ success: true, data: { booking, payment } });
  } catch (error) { return fail(res, error); }
});

router.get("/:id/status", async (req, res) => {
  try {
    const payment = await BookingPayment.findOne({ bookingId: req.params.id, parentId: req.parent._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment has not been started" });
    if (!payment.orderId.startsWith("order_")) return res.json({ success: true, data: { paid: false, status: payment.status } });
    const result = await reconcilePayment(payment, req.app.get("io"));
    return res.json({ success: true, data: { paid: result.paid, status: result.status } });
  } catch (error) { return fail(res, error); }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const fields = ["razorpay_payment_id", "razorpay_order_id", "razorpay_signature"];
    if (!fields.every((field) => typeof req.body?.[field] === "string" && req.body[field].length)) return res.status(400).json({ success: false, message: "Payment confirmation is incomplete." });
    const payment = await BookingPayment.findOne({ bookingId: req.params.id, parentId: req.parent._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment has not been started" });
    const result = await reconcilePayment(payment, req.app.get("io"), req.body);
    return res.json({ success: true, data: { paid: result.paid, status: result.status } });
  } catch (error) { return fail(res, error); }
});

router.post("/:id/order", async (req, res) => {
  try {
    const config = razorpayConfig();
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status !== "awaiting_payment" || !booking.assignedDriverId) return res.status(409).json({ success: false, message: "Payment is available after the driver accepts." });
    const amount = monthlyAmount(booking);
    const amountPaise = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return res.status(400).json({ success: false, message: "The payment amount must be at least ₹1." });
    if (amountPaise !== Math.round(booking.quote.totalMonthly * 100)) return res.status(409).json({ success: false, message: "This booking price needs review before payment. Please contact support." });
    let payment = await BookingPayment.findOne({ bookingId: booking._id });
    let claimed = false;
    if (!payment) {
      try {
        payment = await BookingPayment.create({ bookingId: booking._id, parentId: req.parent._id, orderId: `pending_${randomUUID()}`, idempotencyKey: randomUUID(), amount, environment: config.mode, provider: "razorpay", status: "CREATING" });
        claimed = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        payment = await BookingPayment.findOne({ bookingId: booking._id });
      }
    }
    if (payment.provider !== "razorpay" || payment.environment !== config.mode || Math.round(payment.amount * 100) !== amountPaise) return res.status(409).json({ success: false, message: "This booking has an older payment attempt or a different price. Please contact support." });
    if (payment.status === "PAID") return res.json({ success: true, data: { paid: true } });
    if (payment.orderId.startsWith("order_")) {
      const result = await reconcilePayment(payment, req.app.get("io"));
      if (result.paid) return res.json({ success: true, data: { paid: true } });
      if (result.status === "PENDING") return res.status(409).json({ success: false, message: "Your payment is still processing. Please check its status." });
      return res.json({ success: true, data: { order_id: payment.orderId, amount: amountPaise, currency: "INR", keyId: config.keyId } });
    }
    if (!claimed) {
      const stale = payment.updatedAt < new Date(Date.now() - 60000);
      if (payment.status !== "FAILED" && !stale) return res.status(409).json({ success: false, message: "Payment order is being created. Please retry shortly." });
      const previousStatus = payment.status;
      payment = await BookingPayment.findOneAndUpdate({ _id: payment._id, orderId: payment.orderId, status: previousStatus, updatedAt: payment.updatedAt }, { $set: { status: "CREATING" }, $inc: { attempt: 1 } }, { new: true });
      if (!payment) return res.status(409).json({ success: false, message: "Payment order is being created. Please retry shortly." });
    }
    try {
      const order = await razorpayClient().orders.create({ amount: amountPaise, currency: "INR", receipt: `asan_${booking._id}_${payment.attempt}`, partial_payment: false });
      if (!order.id || order.amount !== amountPaise || order.currency !== "INR") throw new Error("Payment provider returned an invalid order");
      const saved = await BookingPayment.updateOne({ _id: payment._id, orderId: payment.orderId, status: "CREATING" }, { $set: { orderId: order.id, status: "ACTIVE" } });
      if (!saved.matchedCount) throw new Error("Payment order could not be saved");
      return res.json({ success: true, data: { order_id: order.id, amount: order.amount, currency: order.currency, keyId: config.keyId } });
    } catch (error) {
      await BookingPayment.updateOne({ _id: payment._id, orderId: payment.orderId, status: "CREATING" }, { $set: { status: "FAILED" } });
      throw error;
    }
  } catch (error) { return fail(res, error); }
});

export default router;
