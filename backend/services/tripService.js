import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error("Driver not found");

    /* Check existing active trip */
    const existingTrip = await Trips.findOne({
      driver: driverId,
      status: "active"
    });

    if (existingTrip) return existingTrip;

    /* Get assigned students */
    const students = await Students
      .find({ driver: driverId })
      .select("_id");

    const trip = await Trips.create({
      driver: driverId,
      tripType,
      status: "active",
      students: students.map(s => s._id),
      totalStudents: students.length,
      startTime: new Date()
    });

    /* 🔔 Notification (DB + socket + push) */
    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `Your ${tripType} trip has started`,
      fcmToken: driver.fcmToken,
      io
    });

    return trip;

  } catch (error) {
    throw new Error(error.message);
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
  try {
    const trip = await Trips.findOne({
      driver: driverId,
      status: "active"
    });

    if (!trip) throw new Error("Active trip not found");

    trip.status = "completed";
    trip.endTime = new Date();

    await trip.save();

    const driver = await Driver.findById(driverId);

    /* 🔔 Notification */
    await sendNotification({
      driverId,
      title: "Trip Completed",
      message: "Your trip has been completed successfully",
      fcmToken: driver?.fcmToken,
      io
    });

    return trip;

  } catch (error) {
    throw new Error(error.message);
  }
};

/* ================= ACTIVE TRIP ================= */
export const getActiveTripService = async (driverId) => {
  return await Trips
    .findOne({
      driver: driverId,
      status: "active"
    })
    .populate("students")
    .lean();
};

/* ================= DRIVER TRIPS ================= */
export const getDriverTripsService = async (driverId) => {
  return await Trips
    .find({ driver: driverId })
    .sort({ createdAt: -1 })
    .lean();
};
