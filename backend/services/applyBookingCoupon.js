import { assertCheckoutCanBeWaived } from "./couponCheckoutPolicy.js";
import { razorpayClient, razorpayConfig } from "./razorpayService.js";
import { deliverBookingNotice } from "./bookingNotifications.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import Child from "../models/Child.js";
import Parent from "../models/Parent.js";
import Notification from "../models/Notification.js";
import { monthEnd } from "./paymentRules.js";
import { validParentCoupon, assertCouponBooking } from "./parentPaymentCoupon.js";

export async function applyBookingCoupon(parent, bookingId, code, io) {
  if (!validParentCoupon(parent, code)) { const error = new Error("Coupon is invalid, expired, or unavailable for this account."); error.status = 403; throw error; }
  const ownedBooking = await Booking.findOne({ _id: bookingId, parentId: parent._id });
  if (ownedBooking?.couponAppliedAt && ["active", "expired"].includes(ownedBooking.status)) return ownedBooking;
  assertCouponBooking(ownedBooking, false);
  const priorPayment = await BookingPayment.findOne({ bookingId, parentId: parent._id });
  if (priorPayment) {
    assertCheckoutCanBeWaived(priorPayment, { id: priorPayment.orderId });
    if (priorPayment.environment !== razorpayConfig().mode) { const error = new Error("Payment mode changed. Please contact support."); error.status = 409; throw error; }
    const client = razorpayClient();
    const [order, payments] = await Promise.all([client.orders.fetch(priorPayment.orderId), client.orders.fetchPayments(priorPayment.orderId)]);
    assertCheckoutCanBeWaived(priorPayment, order, payments.items || []);
  }
  const session = await mongoose.startSession();
  let booking;
  let bookingNotices = [];
  try {
    await session.withTransaction(async () => {
      if (!validParentCoupon(parent, code)) { const error = new Error("Coupon is invalid, expired, or unavailable for this account."); error.status = 403; throw error; }
      booking = await Booking.findOne({ _id: bookingId, parentId: parent._id }).session(session);
      if (booking?.couponAppliedAt && ["active", "expired"].includes(booking.status)) return;
      const payment = await BookingPayment.findOne({ bookingId }).session(session);
      assertCouponBooking(booking, false);
      if (payment) {
        if (!priorPayment || String(payment._id) !== String(priorPayment._id) || payment.orderId !== priorPayment.orderId) {
          const error = new Error("Payment changed. Please retry the coupon."); error.status = 409; throw error;
        }
        assertCheckoutCanBeWaived(payment, { id: payment.orderId });
        payment.status = "CANCELLED";
        await payment.save({ session });
      }
      const now = new Date();
      // Claim the same unique payment slot as checkout, preventing a parallel
      // Razorpay order from being created after the coupon transaction commits.
      if (!payment) await BookingPayment.create([{ bookingId, parentId: parent._id, orderId: `coupon_${randomUUID()}`, idempotencyKey: randomUUID(), amount: 0, provider: "coupon", environment: "production", status: "WAIVED", quoteSnapshot: booking.toObject().quote, routeSnapshot: booking.toObject().route }], { session });
      booking.couponCode = "Asanrides0";
      booking.couponAppliedAt = now;
      booking.waivedAmount = booking.quote.totalMonthly;
      booking.serviceStartsAt = now;
      booking.serviceEndsAt = monthEnd(now);
      booking.status = "active";
      await booking.save({ session });
      const childIds = [...new Set((booking.childIds?.length ? booking.childIds : [booking.childId]).filter(Boolean).map(String))];
      const result = await Child.updateMany({ _id: { $in: childIds }, parentId: parent._id }, { $set: { driverId: booking.assignedDriverId, activeBookingId: booking._id } }, { session });
      if (!childIds.length || result.matchedCount !== childIds.length) throw new Error("Booking children were not found");
      await Parent.updateOne({ _id: parent._id }, { $addToSet: { driverIds: booking.assignedDriverId } }, { session });
      bookingNotices = await Notification.create([
        { parent: parent._id, recipientType: "parent", title: "Coupon applied", message: "Your monthly ride service is active. No payment was collected.", type: "general", notificationKey: "BOOKING_COUPON_APPLIED", meta: { bookingId: String(booking._id) } },
        { driver: booking.assignedDriverId, recipientType: "driver", title: "Ride service activated", message: "The parent used a payment-waiver coupon. No payment was collected for this booking.", type: "general", notificationKey: "BOOKING_COUPON_APPLIED", meta: { bookingId: String(booking._id) } },
      ], { session, ordered: true });
    });
  } finally { await session.endSession(); }
  for (const notice of bookingNotices) await deliverBookingNotice(notice, io);
  const payload = { bookingId: String(booking._id), status: booking.status, serviceEndsAt: booking.serviceEndsAt };
  io?.to(String(parent._id)).emit("booking_status_updated", payload);
  io?.to(booking.assignedDriverId).emit("booking_service_activated", payload);
  return booking;
}
