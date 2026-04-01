import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("🚀 Starting trip:", driverId);

    if (!driverId || !tripType) {
      throw new Error("driverId and tripType are required");
    }

    /* ✅ FIND DRIVER */
    const driver = await Driver.findOne({ driverId });
    if (!driver) throw new Error("Driver not found");

    /* ✅ PREVENT MULTIPLE ACTIVE TRIPS */
    const existingTrip = await Trips.findOne({
      driverId,
      status: "in_transit"
    });

    if (existingTrip) {
      console.log("⚠️ Existing active trip found");
      return existingTrip;
    }

    /* 🔥 FIXED: CORRECT FIELD NAME */
    const children = await Child.find({ driverId: driverId });

    console.log("👶 children:", children);

    const firstChild = children?.[0];

    /* ✅ CREATE TRIP */
    const trip = await Trips.create({
      driverId,
      tripType,
      status: "in_transit",

      students: children.map((c) => c._id),
      totalStudents: children.length,

      // ✅ FIX FOR UI
      childName: firstChild?.name || "Student",

      route: {
        from: firstChild?.pickupLocation || "Home",
        to: firstChild?.schoolName || "School"
      },

      eta: "30 mins",
      startTime: new Date()
    });

    /* 🔥 FIXED: CORRECT FIELD NAME */
    await Child.updateMany(
      { driverId: driverId },
      { status: "waiting" }
    );

    /* ✅ SEND NOTIFICATION */
    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `${tripType} trip started`,
      fcmToken: driver?.fcmToken,
      io
    });

    /* ✅ SOCKET */
    if (io) {
      const room = String(driverId);
      console.log("📡 Emitting trip_started to:", room);
      io.to(room).emit("trip_started", trip);
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

    /* ✅ FIND ACTIVE TRIP */
    const trip = await Trips.findOne({
      driverId,
      status: "in_transit"
    }).sort({ createdAt: -1 });

    if (!trip) {
      console.log("❌ No active trip found");
      return null;
    }

    /* ✅ SAFE TIME */
    if (!trip.startTime) {
      trip.startTime = new Date();
    }

    trip.endTime = new Date();

    const durationMs = trip.endTime - trip.startTime;
    trip.duration = Math.max(1, Math.round(durationMs / 60000));

    /* ✅ COMPLETE TRIP */
    trip.status = "completed";
    await trip.save();

    console.log("✅ Trip ended:", trip._id);

    /* 🔥 FIXED: CORRECT FIELD NAME */
    await Child.updateMany(
      { driverId: driverId },
      { status: "waiting" }
    );

    /* ✅ SEND NOTIFICATION */
    await sendNotification({
      driverId,
      title: "Trip Completed",
      message: "Trip ended successfully",
      io
    });

    /* ✅ SOCKET */
    if (io) {
      const room = String(driverId);
      console.log("📡 Emitting trip_ended to:", room);
      io.to(room).emit("trip_ended", trip);
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
      status: "in_transit"
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
