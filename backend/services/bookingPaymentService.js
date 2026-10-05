import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import Child from "../models/Child.js";
import Parent from "../models/Parent.js";
import Notification from "../models/Notification.js";
import { cashfreeRequest, cashfreeConfig } from "./cashfreeService.js";
import { confirmedPayment, monthEnd } from "./paymentRules.js";

export async function reconcilePayment(payment, io) {
  if (payment.environment !== cashfreeConfig().mode) throw new Error("Payment environment mismatch");
  const order = await cashfreeRequest("GET", `/orders/${encodeURIComponent(payment.orderId)}`);
  if (order.order_id !== payment.orderId) throw new Error("Payment order mismatch");
  const attempts = await cashfreeRequest("GET", `/orders/${encodeURIComponent(payment.orderId)}/payments`);
  const confirmed = confirmedPayment(order, attempts, payment);
  if (order.order_status === "PAID" && !confirmed) throw new Error("Payment amount or currency does not match this booking");
  if (!confirmed) {
    const status = ["EXPIRED", "TERMINATED"].includes(order.order_status) ? order.order_status
      : attempts.some((p) => p.payment_status === "PENDING") ? "PENDING"
      : attempts.length && attempts.every((p) => ["FAILED", "USER_DROPPED", "CANCELLED", "VOID"].includes(p.payment_status)) ? "FAILED" : "ACTIVE";
    await BookingPayment.updateOne({ _id: payment._id, orderId: payment.orderId, status: { $ne: "PAID" } }, { $set: { status } });
    return { paid: false, status, order };
  }
  const session = await mongoose.startSession();
  let activated;
  try {
    await session.withTransaction(async () => {
      activated = null;
      const current = await BookingPayment.findById(payment._id).session(session);
      if (current.status === "PAID") return;
      if (current.orderId !== payment.orderId) throw new Error("Payment order changed; retry verification");
      const booking = await Booking.findById(payment.bookingId).session(session);
      if (!booking || booking.status !== "awaiting_payment" || !booking.assignedDriverId) throw new Error("Booking cannot be activated");
      const parent = await Parent.findById(booking.parentId).session(session);
      if (!parent || (parent.driverId && parent.driverId !== booking.assignedDriverId)) throw new Error("Parent driver assignment changed; payment needs review");
      const now = new Date();
      current.status = "PAID";
      current.paymentId = String(confirmed.cf_payment_id);
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
      await Notification.create([
        { parent: parent._id, recipientType: "parent", title: "Payment received", message: "Your monthly ride service is now active.", type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id) } },
        { driver: booking.assignedDriverId, recipientType: "driver", title: "Ride service activated", message: `Payment received for ${booking.child.name}. The monthly service is active.`, type: "payment_received", notificationKey: "BOOKING_PAID", meta: { bookingId: String(booking._id) } },
      ], { session });
      activated = booking;
    });
  } finally { await session.endSession(); }
  if (activated) {
    const payload = { bookingId: String(activated._id), status: "active", serviceEndsAt: activated.serviceEndsAt };
    io?.to(String(activated.parentId)).emit("booking_status_updated", payload);
    io?.to(activated.assignedDriverId).emit("booking_service_activated", payload);
  }
  return { paid: true, status: "PAID", order };
}
