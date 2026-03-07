import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */

export const startTripService = async (driverId, tripType, io) => {

  console.log("Driver ID received:", driverId);

  const driver = await Driver.findById(driverId);

  console.log("Driver found:", driver);

  if (!driver) {
    throw new Error("Driver not found");
  }
  const existingTrip = await Trips.findOne({
    driver: driverId,
    status: "active"
  });

  if (existingTrip) {
    throw new Error("Driver already has an active trip");
  }

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

  if (driver.fcmToken) {

    await sendNotification({
      driverId: driver._id,
      title: "Trip Started",
      message: `Your ${tripType} trip has started`,
      fcmToken: driver.fcmToken,
      io
    });

  }

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
  trip.amount = (trip.totalStudents || 0) * 50;

  await trip.save();

  await Driver.findByIdAndUpdate(driverId, {
    $inc: {
      totalTrips: 1,
      todayTrips: 1
    }
  });

  const driver = await Driver
    .findById(driverId)
    .select("fcmToken");

  if (driver?.fcmToken) {

    await sendNotification({
      driverId: driverId,
      title: "Trip Completed",
      message: "Your trip has been completed successfully",
      fcmToken: driver.fcmToken,
      io
    });

    await sendNotification({
      driverId: driverId,
      title: "Payment Credited",
      message: `₹${trip.amount} credited to your account`,
      fcmToken: driver.fcmToken,
      io
    });

  }

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

