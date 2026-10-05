import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import verifyParent from "../middleware/verifyParent.js";
import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import { cashfreeConfig, cashfreeRequest } from "../services/cashfreeService.js";
import { monthlyAmount, verifySignature } from "../services/paymentRules.js";
import { reconcilePayment } from "../services/bookingPaymentService.js";

const router = express.Router();
const fail = (res, error) => {
  console.error("BOOKING PAYMENT ERROR", error.message);
  return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : "Unable to confirm payment right now. Please check payment status before trying again." });
};

export async function cashfreeWebhook(req, res) {
  try {
    const config = cashfreeConfig();
    if (!verifySignature(req.body, req.get("x-webhook-timestamp"), req.get("x-webhook-signature"), process.env.CASHFREE_SECRET_KEY)) return res.status(401).json({ success: false });
    const event = JSON.parse(req.body.toString("utf8"));
    const orderId = event.data?.order?.order_id;
    if (typeof orderId !== "string") return res.status(400).json({ success: false });
    const payment = await BookingPayment.findOne({ orderId, environment: config.mode });
    if (payment) await reconcilePayment(payment, req.app.get("io"));
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
}

router.use(verifyParent);
router.param("id", (req, res, next, id) => mongoose.Types.ObjectId.isValid(id) ? next() : res.status(400).json({ success: false, message: "Invalid booking ID" }));

router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const payment = await BookingPayment.findOne({ bookingId: booking._id }).select("amount currency status orderId paymentId paidAt environment");
    return res.json({ success: true, data: { booking, payment, mode: process.env.CASHFREE_ENV || "sandbox" } });
  } catch (error) { return fail(res, error); }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const payment = await BookingPayment.findOne({ bookingId: req.params.id, parentId: req.parent._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment has not been started" });
    const result = await reconcilePayment(payment, req.app.get("io"));
    return res.json({ success: true, data: { paid: result.paid, status: result.status } });
  } catch (error) { return fail(res, error); }
});

router.post("/:id/order", async (req, res) => {
  try {
    const config = cashfreeConfig();
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status !== "awaiting_payment" || !booking.assignedDriverId) return res.status(409).json({ success: false, message: "Payment is available after the driver accepts." });
    const amount = monthlyAmount(booking);
    if (Math.round(amount * 100) !== Math.round(booking.quote.totalMonthly * 100)) return res.status(409).json({ success: false, message: "This booking price needs review before payment. Please contact support." });
    const phone = String(req.parent.phone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ success: false, message: "Add a valid mobile number to your profile before paying." });
    let payment;
    await BookingPayment.init();
    try {
      payment = await BookingPayment.findOneAndUpdate({ bookingId: booking._id }, { $setOnInsert: { parentId: req.parent._id, orderId: `asan_${booking._id}_1`, idempotencyKey: randomUUID(), amount, environment: config.mode } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      payment = await BookingPayment.findOne({ bookingId: booking._id });
    }
    if (payment.environment !== config.mode) return res.status(409).json({ success: false, message: "This booking belongs to a different payment environment." });
    let order;
    try {
      const result = await reconcilePayment(payment, req.app.get("io"));
      if (result.paid) return res.json({ success: true, data: { paid: true } });
      if (result.status === "PENDING") return res.status(409).json({ success: false, message: "Your payment is still processing. Please check payment status before trying again." });
      order = result.order;
      if (["EXPIRED", "TERMINATED"].includes(order.order_status)) {
        const next = await BookingPayment.findOneAndUpdate({ _id: payment._id, orderId: payment.orderId, status: { $in: ["EXPIRED", "TERMINATED"] } }, { $set: { orderId: `asan_${booking._id}_${payment.attempt + 1}`, idempotencyKey: randomUUID(), status: "CREATED" }, $inc: { attempt: 1 } }, { new: true });
        if (!next) return res.status(409).json({ success: false, message: "Payment is being refreshed. Please try again." });
        payment = next;
        order = null;
      }
    } catch (error) {
      if (error.response?.status !== 404 || payment.status !== "CREATED") throw error;
    }
    if (!order) {
      order = await cashfreeRequest("POST", "/orders", {
        order_id: payment.orderId,
        order_amount: payment.amount,
        order_currency: "INR",
        customer_details: { customer_id: String(req.parent._id), customer_phone: phone, customer_email: req.parent.email, customer_name: req.parent.name },
        order_meta: { return_url: `${config.parentUrl}/booking-payment/${booking._id}`, notify_url: `${config.apiUrl}/api/booking-payments/webhook` },
      }, payment.idempotencyKey);
      await BookingPayment.updateOne({ _id: payment._id, orderId: payment.orderId, status: "CREATED" }, { $set: { status: "ACTIVE" } });
    }
    if (order.order_status !== "ACTIVE" || !order.payment_session_id) return res.status(409).json({ success: false, message: "Payment is processing. Check status before trying again." });
    return res.json({ success: true, data: { paymentSessionId: order.payment_session_id, mode: config.mode, amount: payment.amount, orderId: payment.orderId } });
  } catch (error) { return fail(res, error); }
});
export default router;
