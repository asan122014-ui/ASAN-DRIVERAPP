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
    const status = attempts.some((p) => p.status === "authorized") ? "PENDING"
      : attempts.length && attempts.every((p) => p.status === "failed") ? "FAILED" : "ACTIVE";
    await BookingPayment.updateOne({ _id: payment._id, orderId: payment.orderId, status: { $ne: "PAID" } }, { $set: { status } });
    return { paid: false, status, order };
  }
  const session = await mongoose.startSession();
  let activated;
  let driverNotification;
  try {
    await session.withTransaction(async () => {
      activated = null;
      driverNotification = null;
      const current = await BookingPayment.findById(payment._id).session(session);
      if (current.status === "PAID") return;
      if (current.orderId !== payment.orderId) throw new Error("Payment order changed; retry verification");
      const booking = await Booking.findById(payment.bookingId).session(session);
      if (!booking || booking.status !== "awaiting_payment" || !booking.assignedDriverId) throw new Error("Booking cannot be activated");
      const parent = await Parent.findById(booking.parentId).session(session);
      if (!parent || (parent.driverId && parent.driverId !== booking.assignedDriverId)) throw new Error("Parent driver assignment changed; payment needs review");
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
      const child = await Child.updateOne({ _id: booking.childId, parentId: booking.parentId }, { $set: { driverId: booking.assignedDriverId, activeBookingId: booking._id } }, { session });
      if (!child.matchedCount) throw new Error("Booking child was not found");
      parent.driverId = booking.assignedDriverId;
      await parent.save({ session });
      const notifications = await Notification.create([
        { parent: parent._id, recipientType: "parent", title: "Payment received", message: "Your monthly ride service is now active.", type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id) } },
        { driver: booking.assignedDriverId, recipientType: "driver", title: "Parent payment confirmed", message: `The parent paid for ${booking.child.name}. Distance charge: ₹${Number(booking.quote.distanceCharge).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for the month. The ride service is active.`, type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id), distanceCharge: booking.quote.distanceCharge } },
      ], { session });
      driverNotification = notifications[1];
      activated = booking;
    });
  } finally { await session.endSession(); }
  if (activated) {
    const payload = { bookingId: String(activated._id), status: "active", serviceEndsAt: activated.serviceEndsAt };
    io?.to(String(activated.parentId)).emit("booking_status_updated", payload);
    io?.to(activated.assignedDriverId).emit("booking_service_activated", payload);
    io?.to(activated.assignedDriverId).emit("new_notification", driverNotification.toObject());
  }
  return { paid: true, status: "PAID", order };
}
