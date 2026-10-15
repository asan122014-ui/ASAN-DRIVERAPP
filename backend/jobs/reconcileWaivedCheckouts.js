import Booking from "../models/Booking.js";
import BookingPayment from "../models/BookingPayment.js";
import { reconcilePayment } from "../services/bookingPaymentService.js";

// Keep abandoned order references: a late capture must be refunded, not activate
// the booking a second time or create a driver payout for a waived service.
export function startWaivedCheckoutWorker(io) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const bookings = await Booking.find({ couponAppliedAt: { $ne: null } }).select("_id").lean();
      const payments = await BookingPayment.find({ bookingId: { $in: bookings.map((b) => b._id) }, provider: "razorpay", status: { $in: ["CANCELLED", "REFUND_FAILED"] } });
      for (const payment of payments) {
        try { await reconcilePayment(payment, io); }
        catch (error) { console.error("WAIVED CHECKOUT RECONCILIATION ERROR", error.message); }
      }
    } catch (error) { console.error("WAIVED CHECKOUT WORKER ERROR", error.message); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 300000);
  timer.unref();
  return timer;
}
