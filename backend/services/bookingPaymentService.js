import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import Child from "../models/Child.js";
import Parent from "../models/Parent.js";
import Notification from "../models/Notification.js";
import { razorpayClient, razorpayConfig } from "./razorpayService.js";
import { confirmedRazorpayPayment, monthEnd, verifyCheckoutSignature } from "./paymentRules.js";

export async function reconcilePayment(payment, io, checkout) {
  const config = razorpayConfig();
  if (payment.provider !== "razorpay" || payment.environment !== config.mode || !payment.orderId.startsWith("order_")) {
    const error = new Error("This payment belongs to a different payment mode. Start a fresh booking in the current mode.");
    error.status = 409;
    throw error;
  }
  if (checkout) {
    const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = checkout;
    if (![paymentId, orderId, signature].every((value) => typeof value === "string" && value.length)) {
      const error = new Error("Payment confirmation is incomplete."); error.status = 400; throw error;
    }
    if (orderId !== payment.orderId || !verifyCheckoutSignature(orderId, paymentId, signature, config.keySecret)) {
      const error = new Error("Payment signature did not match."); error.status = 400; throw error;
    }
  }
  const client = razorpayClient();
  const order = await client.orders.fetch(payment.orderId);
  const attempts = (await client.orders.fetchPayments(payment.orderId)).items || [];
  const confirmed = confirmedRazorpayPayment(order, attempts, payment);
  if (order.status === "paid" && !confirmed) throw new Error("Payment amount or currency does not match this booking");
  if (checkout && confirmed && confirmed.id !== checkout.razorpay_payment_id) {
    const error = new Error("Payment ID did not match the captured payment."); error.status = 400; throw error;
  }
  if (!confirmed) {
    if (payment.status === "CANCELLED" || payment.status === "REFUNDING" || payment.status === "REFUNDED") {
      return { paid: false, status: payment.status, order };
    }
    const status = attempts.some((p) => p.status === "authorized") ? "PENDING"
      : attempts.length && attempts.every((p) => p.status === "failed") ? "FAILED" : "ACTIVE";
    const updated = await BookingPayment.updateOne(
      { _id: payment._id, orderId: payment.orderId, status: { $nin: ["PAID", "CANCELLED", "REFUNDING", "REFUNDED", "REFUND_FAILED"] } },
      { $set: { status } }
    );
    if (!updated.matchedCount) {
      const latest = await BookingPayment.findById(payment._id).select("status");
      return { paid: false, status: latest?.status || status, order };
    }
    return { paid: false, status, order };
  }
  const session = await mongoose.startSession();
  let activated;
  let driverNotification;
  let cancelledBooking;
  try {
    await session.withTransaction(async () => {
      activated = null;
      driverNotification = null;
      cancelledBooking = false;
      const current = await BookingPayment.findById(payment._id).session(session);
      if (current.status === "PAID") return;
      if (current.orderId !== payment.orderId) throw new Error("Payment order changed; retry verification");
      const booking = await Booking.findById(payment.bookingId).session(session);
      if (booking?.status === "cancelled") { cancelledBooking = true; return; }
      if (!booking || booking.status !== "awaiting_payment" || !booking.assignedDriverId) throw new Error("Booking cannot be activated");
      const parent = await Parent.findById(booking.parentId).session(session);
      if (!parent) throw new Error("Parent account was not found");
      const now = new Date();
      current.status = "PAID";
      current.paymentId = String(confirmed.id);
      current.paidAt = now;
      await current.save({ session });
      booking.paymentId = current._id;
      booking.paidAt = now;
      booking.serviceStartsAt = now;
      booking.serviceEndsAt = monthEnd(now);
      booking.status = "active";
      await booking.save({ session });
      const bookingChildIds = [...new Set((booking.childIds?.length ? booking.childIds : [booking.childId]).filter(Boolean).map(String))];
      const childResult = await Child.updateMany({ _id: { $in: bookingChildIds }, parentId: booking.parentId }, { $set: { driverId: booking.assignedDriverId, activeBookingId: booking._id } }, { session });
      if (!bookingChildIds.length || childResult.matchedCount !== bookingChildIds.length) throw new Error("One or more booking children were not found");
      parent.driverIds = [...new Set([...(parent.driverIds || []), parent.driverId, booking.assignedDriverId].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean))];
      parent.driverId = parent.driverId || booking.assignedDriverId;
      await parent.save({ session });
      const childNames = (booking.children?.length ? booking.children : [booking.child]).map((item) => item?.name).filter(Boolean).join(", ");
      const notifications = await Notification.create([
        { parent: parent._id, recipientType: "parent", title: "Payment received", message: "Your monthly ride service is now active.", type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id) } },
        { driver: booking.assignedDriverId, recipientType: "driver", title: "Parent payment confirmed", message: `The parent paid for ${childNames || "the child"}. Distance charge: ₹${Number(booking.quote.distanceCharge).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for the month. The ride service is active.`, type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id), distanceCharge: booking.quote.distanceCharge } },
      ], { session, ordered: true });
      driverNotification = notifications[1];
      activated = booking;
    });
  } finally { await session.endSession(); }
  if (cancelledBooking) {
    const claimed = await BookingPayment.findOneAndUpdate(
      { _id: payment._id, orderId: payment.orderId, status: { $nin: ["PAID", "REFUNDING", "REFUNDED"] } },
      { $set: { status: "REFUNDING", paymentId: String(confirmed.id) } },
      { new: true }
    );
    if (claimed) {
      try {
        await client.payments.refund(String(confirmed.id), {
          amount: Math.round(Number(payment.amount) * 100),
          notes: { booking_id: String(payment.bookingId), reason: "Booking cancelled before payment confirmation" },
        });
        await BookingPayment.updateOne({ _id: claimed._id, status: "REFUNDING" }, { $set: { status: "REFUNDED" } });
        io?.to(String(payment.parentId)).emit("booking_payment_refunded", { bookingId: String(payment.bookingId), status: "REFUNDED" });
      } catch (error) {
        console.error("CANCELLED BOOKING REFUND ERROR", error.message);
        await BookingPayment.updateOne({ _id: claimed._id, status: "REFUNDING" }, { $set: { status: "REFUND_FAILED" } });
        const refundError = new Error("The booking was cancelled, but the payment refund needs attention. Please contact support.");
        refundError.status = 502;
        throw refundError;
      }
    }
    return { paid: false, status: claimed ? "REFUNDED" : "REFUNDING", order };
  }
  if (activated) {
    const payload = { bookingId: String(activated._id), status: "active", serviceEndsAt: activated.serviceEndsAt };
    io?.to(String(activated.parentId)).emit("booking_status_updated", payload);
    io?.to(activated.assignedDriverId).emit("booking_service_activated", payload);
    io?.to(activated.assignedDriverId).emit("new_notification", driverNotification.toObject());
  }
  return { paid: true, status: "PAID", order };
}
