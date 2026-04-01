import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("🚀 Starting trip:", driverId);

    /* ✅ VALIDATION */
    if (!driverId || !tripType) {
      throw new Error("driverId and tripType are required");
    }

    /* ✅ FIND DRIVER */
    const driver = await Driver.findOne({ driverId });
    if (!driver) throw new Error("Driver not found");

    /* ✅ PREVENT MULTIPLE ACTIVE TRIPS */
    const existingTrip = await Trips.findOne({
      driverId,
      status: "active"
    });

    if (existingTrip) {
      console.log("⚠️ Existing active trip found");
      return existingTrip;
    }

    /* ✅ FETCH CHILDREN */
    const children = await Child.find({ driverId }).select("_id");

    /* ✅ CREATE TRIP */
    const trip = await Trips.create({
      driverId,
      tripType,
      status: "active",
      students: children.map((c) => c._id),
      totalStudents: children.length,
      startTime: new Date()
    });

    /* ✅ RESET CHILD STATUS */
    await Child.updateMany(
      { driverId },
      { status: "waiting" }
    );

    /* ✅ SEND NOTIFICATION */
    try {
      if (driver.fcmToken) {
        await sendNotification({
          driverId,
          title: "Trip Started",
          message: `${tripType} trip started`,
          fcmToken: driver.fcmToken,
          io
        });
      }
    } catch (err) {
      console.warn("⚠️ Notification failed:", err.message);
    }

    /* ✅ SOCKET */
    if (io) {
      io.to(driverId).emit("trip_started", trip);
    }

    console.log("✅ Trip created:", trip._id);

    return trip;

  } catch (error) {
    console.error("🔥 startTripService error:", error);
    throw error;
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
  try {
    console.log("🔥 Ending trip:", driverId);

    const trip = await Trips.findOne({
      driverId,
      status: "active"
    }).sort({ createdAt: -1 });

    if (!trip) {
      console.log("❌ No active trip found");
      return null;
    }

    /* ✅ SAFE TIME HANDLING */
    if (!trip.startTime) {
      trip.startTime = new Date();
    }

    trip.endTime = new Date();

    const durationMs = trip.endTime - trip.startTime;
    trip.duration = Math.max(1, Math.round(durationMs / 60000));

    trip.status = "completed";

    await trip.save();

    console.log("✅ Trip ended:", trip._id);

    /* ✅ RESET CHILDREN */
    await Child.updateMany(
      { driverId },
      { status: "waiting" }
    );

    /* ✅ SOCKET */
    if (io) {
      io.to(driverId).emit("trip_ended", {
        message: "Trip completed"
      });
    }

    return trip;

  } catch (error) {
    console.error("🔥 endTripService error:", error);
    throw error;
  }
};

/* ================= ACTIVE TRIP ================= */
export const getActiveTripService = async (driverId) => {
  try {
    return await Trips.findOne({
      driverId,
      status: "active"
    })
      .populate("students")
      .lean();
  } catch (error) {
    console.error("🔥 getActiveTripService error:", error);
    throw error;
  }
};

/* ================= DRIVER TRIPS ================= */
export const getDriverTripsService = async (driverId) => {
  try {
    return await Trips.find({ driverId })
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    console.error("🔥 getDriverTripsService error:", error);
    throw error;
  }
};
