import Trips from "../models/Trips.js";
import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */

export const startTripService = async (driverId, tripType, io) => {

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new Error("Driver not found");
  }

  /* prevent multiple active trips */

  const existingTrip = await Trips.findOne({
    driver: driverId,
    status: "active"
  });

  if (existingTrip) {
    throw new Error("Driver already has an active trip");
  }

  /* get assigned students */

  const students = await Students.find({ driver: driverId }).select("_id");

  if (!students.length) {
    throw new Error("No students assigned to this driver");
  }

  /* create trip */

  const trip = await Trips.create({
    driver: driverId,
    tripType,
    status: "active",
    students: students.map(s => s._id),
    startedAt: new Date()
  });

  /* notify driver */

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
  trip.endedAt = new Date();

  await trip.save();

  /* update driver stats */

  await Driver.findByIdAndUpdate(driverId, {
    $inc: {
      totalTrips: 1,
      todayTrips: 1
    }
  });

  const driver = await Driver.findById(driverId);

  /* notify driver */

  if (driver?.fcmToken) {
    await sendNotification({
      driverId: driver._id,
      title: "Trip Completed",
      message: "Your trip has been completed successfully",
      fcmToken: driver.fcmToken,
      io
    });
  }

  return trip;
};


/* ================= GET ACTIVE TRIP ================= */

export const getActiveTripService = async (driverId) => {

  const trip = await Trips.findOne({
    driver: driverId,
    status: "active"
  }).populate("students");

  return trip;
};


/* ================= UPDATE STUDENT STATUS ================= */

export const updateStudentStatusService = async (studentId, status) => {

  const student = await Students.findById(studentId);

  if (!student) {
    throw new Error("Student not found");
  }

  student.status = status;

  await student.save();

  return student;
};


/* ================= GET DRIVER TRIPS ================= */

export const getDriverTripsService = async (driverId) => {

  const trips = await Trips.find({
    driver: driverId
  })
  .sort({ createdAt: -1 })
  .lean();

  return trips;
};
