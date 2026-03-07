import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";
import Notification from "../models/Notification.js";

/* ================= START TRIP ================= */

export const startTripService = async (driverId, tripType, io) => {

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new Error("Driver not found");
  }

  const existingTrip = await Trips.findOne({
    driver: driverId,
    status: "active"
  });

  if (existingTrip) {
    return existingTrip;
  }

  const students = await Students
    .find({ driver: driverId })
    .select("_id");

  const trip = await Trips.create({
    driver: driverId,
    tripType,
    status: "active",
    students: students.map(s => s._id),
    startTime: new Date()
  });

  /* CREATE NOTIFICATION */
  await Notification.create({
    driver: driverId,
    title: "Trip Started",
    message: `Your ${tripType} trip has started`
  });

  return trip;
};
/* ================= END TRIP ================= */

export const endTripService = async (driverId, io) => {

  const trip = await Trips.findOne({
    driver: driverId,
    status: "active"
  });

  if (!trip) {
    throw new Error("Active trip not found");
  }

  trip.status = "completed";
  trip.endTime = new Date();

  await trip.save();

  /* CREATE NOTIFICATION */
  await Notification.create({
    driver: driverId,
    title: "Trip Completed",
    message: "Your trip has been completed successfully"
  });

  return trip;
};

/* ================= ACTIVE TRIP ================= */

export const getActiveTripService = async (driverId) => {

  return await Trips
    .findOne({
      driver: driverId,
      status: "active"
    })
    .populate("students");

};

/* ================= DRIVER TRIPS ================= */

export const getDriverTripsService = async (driverId) => {

  return await Trips
    .find({ driver: driverId })
    .sort({ createdAt: -1 })
    .lean();

};




