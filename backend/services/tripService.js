import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("🚀 Starting trip:", driverId);

    const driver = await Driver.findOne({ driverId });
    if (!driver) throw new Error("Driver not found");

    // Check existing active trip
    const existingTrip = await Trips.findOne({
      driverId,
      status: "active"
    });

    if (existingTrip) return existingTrip;

    // Get students assigned to driver
    const students = await Students.find({
      driver: driverId
    }).select("_id");

    // Create trip
    const trip = await Trips.create({
      driverId,
      tripType,
      status: "active",
      students: students.map(s => s._id),
      totalStudents: students.length,
      startTime: new Date()
    });

    // Notification
    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `${tripType} trip started`,
      fcmToken: driver.fcmToken,
      io
    });

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

    // Safe duration calc
    if (!trip.startTime) {
      trip.startTime = new Date();
    }

    trip.endTime = new Date();

    const durationMs = trip.endTime - trip.startTime;
    trip.duration = Math.max(1, Math.round(durationMs / 60000));

    trip.status = "completed";

    await trip.save();

    console.log("✅ Trip ended:", trip._id);

    // realtime event
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
    return await Trips.find({
      driverId
    })
      .sort({ createdAt: -1 })
      .lean();

  } catch (error) {
    console.error("🔥 getDriverTripsService error:", error);
    throw error;
  }
};
