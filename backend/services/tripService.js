import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("Starting trip for:", driverId);

    // ✅ FIX: use driverId string
    const driver = await Driver.findOne({ driverId });
    if (!driver) throw new Error("Driver not found");

    /* ===== CHECK EXISTING ACTIVE TRIP ===== */
    const existingTrip = await Trips.findOne({
      driver: driverId,
      status: "active"
    });

    if (existingTrip) return existingTrip;

    /* ===== GET ASSIGNED STUDENTS ===== */
    const students = await Students.find({
      driver: driverId
    }).select("_id");

    /* ===== CREATE TRIP ===== */
    const trip = await Trips.create({
      driver: driverId, // ✅ keep consistent
      tripType,
      status: "active",
      students: students.map(s => s._id),
      totalStudents: students.length,
      startTime: new Date()
    });

    /* ===== SEND NOTIFICATION ===== */
    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `Your ${tripType} trip has started`,
      fcmToken: driver.fcmToken,
      io
    });

    console.log("✅ Trip started:", trip._id);

    return trip;

  } catch (error) {
    console.error("🔥 startTripService error:", error);
    throw error;
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
  try {
    console.log("Ending trip for:", driverId);

    // ✅ FIX: Trips (NOT Trip)
    const trip = await Trips.findOne({
      driver: driverId, // ⚠️ keep same field as DB
      status: "active"
    }).sort({ createdAt: -1 });

    if (!trip) {
      console.log("❌ No active trip found");
      throw new Error("No active trip found");
    }

    /* ===== UPDATE TRIP ===== */
    trip.endTime = new Date();
    trip.duration = Math.round(
      (trip.endTime - trip.startTime) / 60000
    );
    trip.status = "completed";

    await trip.save();

    console.log("✅ Trip ended:", trip._id);

    /* ===== REALTIME EVENT ===== */
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
      driver: driverId,
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
    return await Trips.find({
      driver: driverId
    })
      .sort({ createdAt: -1 })
      .lean();

  } catch (error) {
    console.error("🔥 getDriverTripsService error:", error);
    throw error;
  }
};
