import mongoose from "mongoose";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= CONSTANTS ================= */
const TRIP_TYPES = Object.freeze(["morning", "afternoon"]);
const PAYMENT_METHODS = Object.freeze(["cash", "upi", "card"]);

/* ================= EVENT CONSTANTS ================= */
export const EVENTS = Object.freeze({
  TRIP_STARTED: "trip_started",
  TRIP_ENDED: "trip_ended",
  STUDENT_PICKED_UP: "student_picked_up",
  STUDENT_DROPPED: "student_dropped",
  PAYMENT_RECEIVED: "payment_received",
  MORNING_DROP_VERIFIED: "morning_drop_verified",
  AFTERNOON_PICKUP_VERIFIED: "afternoon_pickup_verified",
  MORNING_DROP_PHOTO_UPLOADED: "morning_drop_photo_uploaded",
  AFTERNOON_PICKUP_PHOTO_UPLOADED: "afternoon_pickup_photo_uploaded",
  DRIVER_ARRIVED_PICKUP: "driver_arrived_pickup",
  APPROACHING_SCHOOL: "approaching_school",
  DRIVER_ARRIVED_SCHOOL: "driver_arrived_school",
  APPROACHING_HOME: "approaching_home",
  TRIP_DELAYED: "trip_delayed",
  TRIP_CANCELLED: "trip_cancelled",
});

/* ================= CUSTOM ERRORS ================= */
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

/* ================= TIMEZONE HELPERS ================= */
const getCurrentHourInIST = () => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return istTime.getHours();
};

/* ================= NOTIFICATION HELPER ================= */
const notifyDriver = async (
  driverId,
  {
    notificationKey,
    childId = null,
    event,
    payload,
    priority = "medium",
    io,
  }
) => {
  await sendNotification({
    driverId,
    childId,
    notificationKey,
    priority,
    io,
  });

  // Only emit the custom event with payload
  if (io) {
    io.to(String(driverId)).emit(event, payload);
  }
};

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  const session = await mongoose.startSession();

  try {
    if (!driverId || !tripType) {
      throw new ValidationError("driverId and tripType are required");
    }

    if (!TRIP_TYPES.includes(tripType)) {
      throw new ValidationError("Invalid trip type. Must be 'morning' or 'afternoon'");
    }

    const hour = getCurrentHourInIST();

    if (tripType === "morning" && hour >= 12) {
      throw new ValidationError("Morning trip is no longer available.");
    }

    if (tripType === "afternoon" && hour < 12) {
      throw new ValidationError("Afternoon trip has not started yet.");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const alreadyCompleted = await Trips.findOne({
      driverId,
      tripType,
      status: "completed",
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    });

    if (alreadyCompleted) {
      throw new ConflictError(`${tripType} trip already completed today`);
    }

    session.startTransaction();

    const driver = await Driver.findOne({ driverId }).session(session);

    if (!driver) {
      throw new NotFoundError("Driver not found");
    }

    const existingTrip = await Trips.findOne({
      driverId,
      status: "in_transit",
    }).session(session);

    if (existingTrip) {
      throw new ConflictError("Driver already has an active trip.");
    }

    const children = await Child.find({
      driverId,
    })
      .populate("parentId")
      .session(session);

    if (!children.length) {
      throw new ValidationError("No children assigned to this driver");
    }

    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      },
      { session }
    );

    driver.currentStatus = "on_trip";
    driver.isOnline = true;
    await driver.save({ session });

    const studentIds = children.map((c) => c._id);
    const startTime = new Date();

    const tripDocs = children
      .filter((child) => child.parentId)
      .map((child) => ({
        driverId,
        parent: child.parentId._id || child.parentId,
        child: child._id,
        tripType,
        status: "in_transit",
        students: studentIds,
        totalStudents: children.length,
        childName: child.name,
        route: {
          from: child.pickupLocation || "Home",
          to: child.dropoffLocation || child.school || "School",
        },
        eta: "30 mins",
        startTime,
      }));

    const createdTrips = await Trips.insertMany(tripDocs, { session });

    await session.commitTransaction();

    const notificationKey =
      tripType === "morning"
        ? "TRIP_STARTED"
        : "RETURN_TRIP_STARTED";

    await notifyDriver(driverId, {
      notificationKey,
      event: EVENTS.TRIP_STARTED,
      payload: createdTrips,
      io,
    });

    return createdTrips;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("startTripService error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

/* ================= END TRIP - NO TRANSACTION ================= */
export const endTripService = async (driverId, io) => {
  try {
    // ✅ Get all active trips with child status populated
    const trips = await Trips.find({
      driverId,
      status: "in_transit",
    }).populate("child", "status");

    if (!trips.length) {
      return [];
    }

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      throw new NotFoundError("Driver not found");
    }

    // ✅ Skip validation for absent students
    for (const trip of trips) {
      // Ignore absent students
      if (trip.child?.status === "absent") {
        console.log(`⏭️ Skipping absent student: ${trip.childName}`);
        continue;
      }

      if (trip.tripType === "morning" && !Boolean(trip.morningDrop?.imageUrl)) {
        throw new ValidationError(`Drop photo missing for ${trip.childName}`);
      }

      if (trip.tripType === "afternoon" && !Boolean(trip.afternoonPickup?.imageUrl)) {
        throw new ValidationError(`Pickup photo missing for ${trip.childName}`);
      }

      if (!trip.pickupStatus) {
        throw new ValidationError(`${trip.childName} was not picked up`);
      }

      if (!trip.dropStatus) {
        throw new ValidationError(`${trip.childName} was not dropped`);
      }
    }

    const endTime = new Date();

    // ✅ Complete all child trips
    for (const trip of trips) {
      if (!trip.startTime) {
        trip.startTime = endTime;
      }

      trip.endTime = endTime;
      const durationMs = endTime - trip.startTime;
      trip.duration = Math.max(1, Math.round(durationMs / 60000));
      trip.status = "completed";

      await trip.save();
    }

    // ✅ Reset child status
    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      }
    );

    // ✅ Update driver status
    driver.currentStatus = "idle";
    driver.isOnline = false;
    await driver.save();

    // ✅ Send notification using notificationKey
    await notifyDriver(driverId, {
      notificationKey: "TRIP_COMPLETED",
      event: EVENTS.TRIP_ENDED,
      payload: trips,
      priority: "low",
      io,
    });

    return trips;
  } catch (error) {
    console.error("endTripService error:", error.message);
    throw error;
  }
};

/* ================= GET ALL ACTIVE TRIPS ================= */
export const getActiveTripsService = async (driverId) => {
  try {
    if (!driverId) {
      throw new ValidationError("driverId is required");
    }

    const trips = await Trips.find({
      driverId,
      status: "in_transit",
    })
      .select("-morningDrop -afternoonPickup")
      .populate("child", "name status")
      .populate("parent", "name")
      .sort({ createdAt: -1 })
      .lean();

    return trips;
  } catch (error) {
    console.error("getActiveTripsService error:", error);
    throw error;
  }
};

/* ================= GET SINGLE ACTIVE TRIP ================= */
export const getActiveTripService = async (tripId) => {
  try {
    if (!tripId) {
      throw new ValidationError("tripId is required");
    }

    const trip = await Trips.findById(tripId)
      .populate("child", "name status")
      .populate("parent", "name")
      .lean();

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    return trip;
  } catch (error) {
    console.error("getActiveTripService error:", error);
    throw error;
  }
};

/* ================= DRIVER TRIPS ================= */
export const getDriverTripsService = async (driverId) => {
  try {
    if (!driverId) {
      throw new ValidationError("driverId is required");
    }

    return await Trips.find({ driverId })
      .select("-morningDrop -afternoonPickup")
      .sort({ createdAt: -1 })
      .populate("child", "name")
      .populate("parent", "name")
      .lean();
  } catch (error) {
    console.error("getDriverTripsService error:", error);
    throw error;
  }
};

/* ================= PARENT TRIPS ================= */
export const getParentTripsService = async (parentId) => {
  try {
    if (!parentId) {
      throw new ValidationError("parentId is required");
    }

    return await Trips.find({ parent: parentId })
      .sort({ createdAt: -1 })
      .populate("child", "name status pickupLocation dropoffLocation")
      .lean();
  } catch (error) {
    console.error("getParentTripsService error:", error);
    throw error;
  }
};

/* ================= TRIP DETAILS (BY DATE) ================= */
export const getTripDetailsService = async (driverId, tripType, date) => {
  try {
    if (!driverId || !tripType) {
      throw new ValidationError("driverId and tripType are required");
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new ValidationError("Invalid date format. Please use YYYY-MM-DD format.");
    }

    const start = new Date(dateObj);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateObj);
    end.setHours(23, 59, 59, 999);

    const trips = await Trips.find({
      driverId,
      tripType: new RegExp(`^${tripType}$`, "i"),
      createdAt: {
        $gte: start,
        $lte: end,
      },
    })
      .select("-morningDrop -afternoonPickup")
      .populate("child", "name")
      .sort({ createdAt: 1 })
      .lean();

    return trips;
  } catch (error) {
    console.error("getTripDetailsService error:", error);
    throw error;
  }
};

/* ================= TODAY'S TRIP STATUS ================= */
export const getTodayTripStatusService = async (driverId) => {
  try {
    if (!driverId) {
      throw new ValidationError("driverId is required");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trips = await Trips.find(
      {
        driverId,
        createdAt: {
          $gte: today,
          $lt: tomorrow,
        },
      },
      "tripType status"
    ).lean();

    console.log("Today's trips:", trips);

    let morningTrips = 0;
    let afternoonTrips = 0;
    let morningCompleted = true;
    let afternoonCompleted = true;

    for (const trip of trips) {
      if (trip.tripType === "morning") {
        morningTrips++;
        if (trip.status !== "completed") {
          morningCompleted = false;
        }
      }

      if (trip.tripType === "afternoon") {
        afternoonTrips++;
        if (trip.status !== "completed") {
          afternoonCompleted = false;
        }
      }
    }

    morningCompleted = morningTrips > 0 && morningCompleted;
    afternoonCompleted = afternoonTrips > 0 && afternoonCompleted;

    console.log({
      morningTrips,
      afternoonTrips,
      morningCompleted,
      afternoonCompleted,
    });

    return {
      morningTrips,
      afternoonTrips,
      morningCompleted,
      afternoonCompleted,
    };
  } catch (error) {
    console.error("getTodayTripStatusService error:", error);
    throw error;
  }
};

/* ================= PICKUP STUDENT ================= */
export const pickupStudentService = async (tripId, io) => {
  const session = await mongoose.startSession();

  try {
    const trip = await Trips.findById(tripId)
      .populate("child", "name status")
      .populate("parent", "name")
      .session(session);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.pickupStatus) {
      throw new ConflictError("Student already picked up");
    }

    if (trip.child?.status !== "absent" && 
        trip.tripType === "afternoon" && 
        !Boolean(trip.afternoonPickup?.imageUrl)) {
      throw new ValidationError("Upload pickup photo before picking up student.");
    }

    session.startTransaction();

    trip.pickupStatus = true;
    trip.pickupTime = new Date();

    await trip.save({ session });

    await Child.findByIdAndUpdate(
      trip.child._id,
      { status: "onboard" },
      { session }
    );

    await session.commitTransaction();

    const notificationKey =
      trip.tripType === "morning"
        ? "CHILD_PICKED_UP"
        : "PICKED_UP_FROM_SCHOOL";

    await notifyDriver(trip.driverId, {
      notificationKey,
      childId: trip.child._id,
      event: EVENTS.STUDENT_PICKED_UP,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("pickupStudentService:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudentService = async (tripId, io) => {
  const session = await mongoose.startSession();

  try {
    const trip = await Trips.findById(tripId)
      .populate("child", "name status")
      .populate("parent", "name")
      .session(session);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.dropStatus) {
      throw new ConflictError("Student already dropped");
    }

    if (trip.child?.status !== "absent" &&
        trip.tripType === "morning" && 
        !Boolean(trip.morningDrop?.imageUrl)) {
      throw new ValidationError("Upload drop photo before completing drop.");
    }

    session.startTransaction();

    trip.dropStatus = true;
    trip.dropTime = new Date();

    await trip.save({ session });

    await Child.findByIdAndUpdate(
      trip.child._id,
      { status: "dropped" },
      { session }
    );

    await session.commitTransaction();

    const notificationKey =
      trip.tripType === "morning"
        ? "DROPPED_AT_SCHOOL"
        : "DROPPED_AT_HOME";

    await notifyDriver(trip.driverId, {
      notificationKey,
      childId: trip.child._id,
      event: EVENTS.STUDENT_DROPPED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("dropStudentService:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

/* ================= TRIP PROGRESS ================= */
export const getTripProgressService = async (driverId) => {
  try {
    if (!driverId) {
      throw new ValidationError("driverId is required");
    }

    const [totalStudents, pickedStudents, droppedStudents, absentStudents] =
      await Promise.all([
        Child.countDocuments({ driverId }),
        Child.countDocuments({ driverId, status: "onboard" }),
        Child.countDocuments({ driverId, status: "dropped" }),
        Child.countDocuments({ driverId, status: "absent" }),
      ]);

    const remainingStudents = await Child.countDocuments({
      driverId,
      status: { $in: ["waiting", "onboard"] },
    });

    return {
      totalStudents,
      pickedStudents,
      droppedStudents,
      absentStudents,
      remainingStudents,
    };
  } catch (error) {
    console.error("getTripProgressService:", error);
    throw error;
  }
};

/* ================= RECEIVE PAYMENT ================= */
export const receivePaymentService = async (tripId, paymentMethod, io) => {
  try {
    if (!paymentMethod) {
      throw new ValidationError("Payment method is required");
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ValidationError("Invalid payment method. Must be 'cash', 'upi', or 'card'");
    }

    const trip = await Trips.findById(tripId)
      .populate("child", "name")
      .populate("parent", "name");

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.paymentReceived) {
      throw new ConflictError("Payment already received");
    }

    trip.paymentReceived = true;
    trip.paymentMethod = paymentMethod;
    trip.paymentReceivedAt = new Date();

    await trip.save();

    await notifyDriver(trip.driverId, {
      notificationKey: "PAYMENT_RECEIVED",
      childId: trip.child._id,
      event: EVENTS.PAYMENT_RECEIVED,
      payload: trip,
      priority: "low",
      io,
    });

    return trip;
  } catch (error) {
    console.error("receivePaymentService:", error);
    throw error;
  }
};

/* ================= VERIFY MORNING DROP PHOTO ================= */
export const verifyMorningDropPhotoService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (!trip.morningDrop?.imageUrl) {
      throw new ValidationError("No morning drop photo to verify");
    }

    if (trip.morningDrop.verified) {
      throw new ConflictError("Morning drop photo already verified");
    }

    trip.morningDrop.verified = true;
    await trip.save();

    await notifyDriver(trip.driverId, {
      notificationKey: "MORNING_DROP_VERIFIED",
      childId: trip.child,
      event: EVENTS.MORNING_DROP_VERIFIED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("verifyMorningDropPhotoService:", error);
    throw error;
  }
};

/* ================= VERIFY AFTERNOON PICKUP PHOTO ================= */
export const verifyAfternoonPickupPhotoService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (!trip.afternoonPickup?.imageUrl) {
      throw new ValidationError("No afternoon pickup photo to verify");
    }

    if (trip.afternoonPickup.verified) {
      throw new ConflictError("Afternoon pickup photo already verified");
    }

    trip.afternoonPickup.verified = true;
    await trip.save();

    await notifyDriver(trip.driverId, {
      notificationKey: "AFTERNOON_PICKUP_VERIFIED",
      childId: trip.child,
      event: EVENTS.AFTERNOON_PICKUP_VERIFIED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("verifyAfternoonPickupPhotoService:", error);
    throw error;
  }
};

/* ================= UPLOAD MORNING DROP PHOTO ================= */
export const uploadMorningDropPhotoService = async (tripId, file, body, io) => {
  try {
    if (!tripId || !file) {
      throw new ValidationError("tripId and file are required");
    }

    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.tripType !== "morning") {
      throw new ValidationError("This is not a morning trip.");
    }

    if (Boolean(trip.morningDrop?.imageUrl)) {
      throw new ConflictError("Morning drop photo already uploaded");
    }

    await trip.addMorningDropPhoto(
      file.secure_url || file.path || file.url,
      file.public_id || null,
      body?.latitude || null,
      body?.longitude || null,
      body?.address || null,
      body?.distanceInMeters || null,
      body?.deviceInfo || null,
      body?.width || null,
      body?.height || null,
      body?.capturedAt ? new Date(body.capturedAt) : new Date()
    );

    await notifyDriver(trip.driverId, {
      notificationKey: "MORNING_DROP_PHOTO_UPLOADED",
      childId: trip.child,
      event: EVENTS.MORNING_DROP_PHOTO_UPLOADED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("uploadMorningDropPhotoService error:", error.message);
    throw error;
  }
};

/* ================= UPLOAD AFTERNOON PICKUP PHOTO ================= */
export const uploadAfternoonPickupPhotoService = async (tripId, file, body, io) => {
  try {
    if (!tripId || !file) {
      throw new ValidationError("tripId and file are required");
    }

    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.tripType !== "afternoon") {
      throw new ValidationError("This is not an afternoon trip.");
    }

    if (Boolean(trip.afternoonPickup?.imageUrl)) {
      throw new ConflictError("Afternoon pickup photo already uploaded");
    }

    await trip.addAfternoonPickupPhoto(
      file.secure_url || file.path || file.url,
      file.public_id || null,
      body?.latitude || null,
      body?.longitude || null,
      body?.address || null,
      body?.distanceInMeters || null,
      body?.deviceInfo || null,
      body?.width || null,
      body?.height || null,
      body?.capturedAt ? new Date(body.capturedAt) : new Date()
    );

    await notifyDriver(trip.driverId, {
      notificationKey: "AFTERNOON_PICKUP_PHOTO_UPLOADED",
      childId: trip.child,
      event: EVENTS.AFTERNOON_PICKUP_PHOTO_UPLOADED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("uploadAfternoonPickupPhotoService error:", error.message);
    throw error;
  }
};

/* ================= NEW NOTIFICATION SERVICES ================= */

/* ================= DRIVER ARRIVED PICKUP ================= */
export const driverArrivedPickupService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "DRIVER_ARRIVED_PICKUP",
      childId: trip.child,
      event: EVENTS.DRIVER_ARRIVED_PICKUP,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("driverArrivedPickupService:", error);
    throw error;
  }
};

/* ================= APPROACHING SCHOOL ================= */
export const approachingSchoolService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "APPROACHING_SCHOOL",
      childId: trip.child,
      event: EVENTS.APPROACHING_SCHOOL,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("approachingSchoolService:", error);
    throw error;
  }
};

/* ================= DRIVER ARRIVED SCHOOL ================= */
export const driverArrivedSchoolService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "DRIVER_ARRIVED_SCHOOL",
      childId: trip.child,
      event: EVENTS.DRIVER_ARRIVED_SCHOOL,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("driverArrivedSchoolService:", error);
    throw error;
  }
};

/* ================= APPROACHING HOME ================= */
export const approachingHomeService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "APPROACHING_HOME",
      childId: trip.child,
      event: EVENTS.APPROACHING_HOME,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("approachingHomeService:", error);
    throw error;
  }
};

/* ================= TRIP DELAYED ================= */
export const tripDelayedService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "TRIP_DELAYED",
      childId: trip.child,
      event: EVENTS.TRIP_DELAYED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("tripDelayedService:", error);
    throw error;
  }
};

/* ================= TRIP CANCELLED ================= */
export const tripCancelledService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    await notifyDriver(trip.driverId, {
      notificationKey: "TRIP_CANCELLED",
      childId: trip.child,
      event: EVENTS.TRIP_CANCELLED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("tripCancelledService:", error);
    throw error;
  }
};
