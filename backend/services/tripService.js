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

    const existingTrip = await Trips.findOne({
      $or: [{ driver: driverId }, { driverId }],
      status: "active"
    });

    if (existingTrip) return existingTrip;

    const students = await Students.find({
      $or: [{ driver: driverId }, { driverId }]
    }).select("_id");

    const trip = await Trips.create({
      driver: driverId, // keep your current DB structure
      tripType,
      status: "active",
      students: students.map(s => s._id),
      totalStudents: students.length,
      startTime: new Date()
    });

    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `${tripType} trip started`,
      fcmToken: driver.fcmToken,
      io
    });

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
      $or: [{ driver: driverId }, { driverId }],
      status: "active"
    }).sort({ createdAt: -1 });

    if (!trip) {
      console.log("❌ No active trip");
      return null; // prevent crash
    }

    trip.endTime = new Date();
    trip.duration = Math.round(
      (trip.endTime - trip.startTime) / 60000
    );
    trip.status = "completed";

    await trip.save();

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
  return await Trips.findOne({
    $or: [{ driver: driverId }, { driverId }],
    status: "active"
  })
    .populate("students")
    .lean();
};

/* ================= DRIVER TRIPS ================= */
export const getDriverTripsService = async (driverId) => {
  return await Trips.find({
    $or: [{ driver: driverId }, { driverId }]
  })
    .sort({ createdAt: -1 })
    .lean();
};
