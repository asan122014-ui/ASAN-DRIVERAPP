import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Parent from "../models/Parent.js";

export function startBookingServiceExpiryWorker(io) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await Booking.find({ status: "active", serviceEndsAt: { $lte: new Date() } }).select("_id parentId assignedDriverId").limit(100);
      for (const booking of expired) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const result = await Booking.updateOne({ _id: booking._id, status: "active", serviceEndsAt: { $lte: new Date() } }, { $set: { status: "expired" } }, { session });
            if (result.modifiedCount) {
              await Child.updateMany({ activeBookingId: booking._id }, { $set: { driverId: "", activeBookingId: null } }, { session });
              const remaining = await Child.countDocuments({ parentId: booking.parentId, driverId: booking.assignedDriverId }).session(session);
              if (!remaining) await Parent.updateOne({ _id: booking.parentId, driverId: booking.assignedDriverId }, { $set: { driverId: "" } }, { session });
            }
          });
          io?.to(String(booking.parentId)).emit("booking_status_updated", { bookingId: String(booking._id), status: "expired" });
        } finally { await session.endSession(); }
      }
    } catch (error) { console.error("BOOKING SERVICE EXPIRY ERROR", error.message); }
    finally { running = false; }
  };
  tick();
  const timer = setInterval(tick, 60000);
  timer.unref();
  return timer;
}
