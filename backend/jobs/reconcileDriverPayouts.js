import Invoice from "../models/Invoice.js";
import Booking from "../models/Booking.js";
import { ensureDriverPayouts, ensureBookingPayouts } from "../controllers/driverPayoutController.js";

export function startPayoutReconciliationWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const [invoices, bookings] = await Promise.all([
        Invoice.find().select("_id driverId baseAmount totalAmount month childId couponAppliedAt").lean(),
        Booking.find({ status: { $in: ["active", "expired"] }, paymentId: { $ne: null }, assignedDriverId: { $ne: "" } }).select("_id assignedDriverId quote childIds childId startDate serviceStartsAt").lean(),
      ]);
      await ensureDriverPayouts(invoices, bookings);
      await ensureBookingPayouts(bookings);
    } catch (error) { console.error("Payout reconciliation failed:", error.message); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 300000);
  timer.unref();
  return timer;
}
