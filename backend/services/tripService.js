import mongoose from "mongoose";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= EVENT CONSTANTS ================= */
export const EVENTS = {
  TRIP_STARTED: "trip_started",
  TRIP_ENDED: "trip_ended",
  STUDENT_PICKED_UP: "student_picked_up",
  STUDENT_DROPPED: "student_dropped",
  PAYMENT_RECEIVED: "payment_received",
  MORNING_DROP_VERIFIED: "morning_drop_verified",
  AFTERNOON_PICKUP_VERIFIED: "afternoon_pickup_verified",
  MORNING_DROP_PHOTO_UPLOADED: "morning_drop_photo_uploaded",
  AFTERNOON_PICKUP_PHOTO_UPLOADED: "afternoon_pickup_photo_uploaded",
};

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
  // Convert to IST (UTC +5:30)
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return istTime.getHours();
};

/* ================= NOTIFICATION HELPER ================= */
const notifyDriver = async (
  driverId,
  {
    title,
    message,
    event,
    payload,
    priority = "medium",
    io,
  }
) => {
  await sendNotification({
    driverId,
    title,
    message,
    type: event,
    priority,
    io,
  });

  if (io) {
    io.to(String(driverId)).emit(event, payload);
    io.to(String(driverId)).emit("notification", {
      _id: Date.now(),
      title,
      message,
      createdAt: new Date(),
    });
  }
};

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  const session = await mongoose.startSession();

  try {
    console.log("🚀 Starting trip:", driverId);

    if (!driverId || !tripType) {
      throw new ValidationError("driverId and tripType are required");
    }

    /* ================= VALIDATE TRIP TYPE BASED ON TIME (IST) ================= */

    const hour = getCurrentHourInIST();

    if (tripType === "morning" && hour >= 12) {
      throw new ValidationError("Morning trip is no longer available.");
    }

    if (tripType === "afternoon" && hour < 12) {
      throw new ValidationError("Afternoon trip has not started yet.");
    }

    /* ================= PREVENT DUPLICATE TRIP OF SAME TYPE ON SAME DAY ================= */

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

    /* ================= DRIVER ================= */

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      throw new NotFoundError("Driver not found");
    }

    /* ================= PREVENT MULTIPLE ACTIVE TRIPS ================= */

    const existingTrip = await Trips.findOne({
      driverId,
      status: "in_transit",
    });

    if (existingTrip) {
      throw new ConflictError("Driver already has an active trip.");
    }

    /* ================= GET ALL CHILDREN ================= */

    const children = await Child.find({
      driverId,
    }).populate("parentId");

    if (!children.length) {
      throw new ValidationError("No children assigned to this driver");
    }

    /* ================= START TRANSACTION ================= */

    session.startTransaction();

    /* ================= RESET CHILD STATUS ================= */

    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      },
      { session }
    );

    /* ================= CREATE TRIPS USING insertMany ================= */

    const tripDocs = children
      .filter((child) => child.parentId)
      .map((child) => ({
        driverId,
        parent: child.parentId._id || child.parentId,
        child: child._id,
        tripType,
        status: "in_transit",
        students: children.map((c) => c._id),
        totalStudents: children.length,
        childName: child.name,
        route: {
          from: child.pickupLocation || "Home",
          to: child.dropoffLocation || child.school || "School",
        },
        eta: "30 mins",
        startTime: new Date(),
      }));

    const createdTrips = await Trips.insertMany(tripDocs, { session });

    /* ================= COMMIT TRANSACTION ================= */

    await session.commitTransaction();

    /* ================= SEND NOTIFICATION ================= */

    await notifyDriver(driverId, {
      title: "Trip Started",
      message: `Trip started (${tripType})`,
      event: EVENTS.TRIP_STARTED,
      payload: createdTrips,
      io,
    });

    console.log(`✅ ${createdTrips.length} child trips created`);

    return createdTrips;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("🔥 startTripService error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
  const session = await mongoose.startSession();

  try {
    console.log("🔥 Ending trip:", driverId);

    /* ================= GET ALL ACTIVE TRIPS ================= */

    const trips = await Trips.find({
      driverId,
      status: "in_transit",
    });

    if (!trips.length) {
      console.log("❌ No active trips found");
      return [];
    }

    /* ================= VALIDATE EACH TRIP BEFORE COMPLETING ================= */

    for (const trip of trips) {
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

    /* ================= START TRANSACTION ================= */

    session.startTransaction();

    const endTime = new Date();

    /* ================= COMPLETE ALL CHILD TRIPS ================= */

    await Promise.all(
      trips.map(async (trip) => {
        if (!trip.startTime) {
          trip.startTime = endTime;
        }

        trip.endTime = endTime;

        const durationMs = endTime - trip.startTime;

        trip.duration = Math.max(1, Math.round(durationMs / 60000));

        trip.status = "completed";

        return trip.save({ session });
      })
    );

    /* ================= RESET CHILD STATUS ================= */

    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      },
      { session }
    );

    /* ================= COMMIT TRANSACTION ================= */

    await session.commitTransaction();

    console.log(`✅ ${trips.length} trips completed`);

    /* ================= SEND NOTIFICATION ================= */

    await notifyDriver(driverId, {
      title: "Trip Completed",
      message: `${trips.length} child trips completed`,
      event: EVENTS.TRIP_ENDED,
      payload: trips,
      priority: "low",
      io,
    });

    return trips;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("🔥 endTripService error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

/* ================= GET ALL ACTIVE TRIPS (FOR DRIVER DASHBOARD) ================= */
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
    console.error("🔥 getActiveTripsService error:", error);
    throw error;
  }
};

/* ================= GET SINGLE ACTIVE TRIP (FOR PARENT/STUDENT VIEW) ================= */
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
    console.error("🔥 getActiveTripService error:", error);
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
    console.error("🔥 getDriverTripsService error:", error);
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
    console.error("🔥 getParentTripsService error:", error);
    throw error;
  }
};

/* ================= PICKUP STUDENT ================= */
export const pickupStudentService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId)
      .populate("child")
      .populate("parent");

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.pickupStatus) {
      throw new ConflictError("Student already picked up");
    }

    if (trip.tripType === "afternoon" && !Boolean(trip.afternoonPickup?.imageUrl)) {
      throw new ValidationError("Upload pickup photo before picking up student.");
    }

    trip.pickupStatus = true;
    trip.pickupTime = new Date();

    await trip.save();

    await Child.findByIdAndUpdate(trip.child._id, {
      status: "onboard",
    });

    await notifyDriver(trip.driverId, {
      title: "Student Picked Up",
      message: `${trip.child.name} has been picked up`,
      event: EVENTS.STUDENT_PICKED_UP,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("pickupStudentService:", error);
    throw error;
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudentService = async (tripId, io) => {
  try {
    const trip = await Trips.findById(tripId)
      .populate("child")
      .populate("parent");

    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    if (trip.dropStatus) {
      throw new ConflictError("Student already dropped");
    }

    if (trip.tripType === "morning" && !Boolean(trip.morningDrop?.imageUrl)) {
      throw new ValidationError("Upload drop photo before completing drop.");
    }

    trip.dropStatus = true;
    trip.dropTime = new Date();

    await Child.findByIdAndUpdate(trip.child._id, {
      status: "dropped",
    });

    await trip.save();

    await notifyDriver(trip.driverId, {
      title: "Student Dropped",
      message: `${trip.child.name} reached destination`,
      event: EVENTS.STUDENT_DROPPED,
      payload: trip,
      io,
    });

    return trip;
  } catch (error) {
    console.error("dropStudentService:", error);
    throw error;
  }
};

/* ================= TRIP PROGRESS ================= */
export const getTripProgressService = async (driverId) => {
  try {
    if (!driverId) {
      throw new ValidationError("driverId is required");
    }

    // ✅ Optimized: Use countDocuments for each status instead of loading all children
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
    const trip = await Trips.findById(tripId)
      .populate("child")
      .populate("parent");

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
      title: "Payment Received",
      message: `Payment received for ${trip.child.name}`,
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
      title: "Morning Drop Photo Verified",
      message: `Drop photo verified for ${trip.childName || "student"}`,
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
      title: "Afternoon Pickup Photo Verified",
      message: `Pickup photo verified for ${trip.childName || "student"}`,
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
    console.log("📸 Uploading morning drop photo:", tripId);

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
      title: "Morning Drop Photo Uploaded",
      message: `Drop photo uploaded for ${trip.childName || "student"}`,
      event: EVENTS.MORNING_DROP_PHOTO_UPLOADED,
      payload: trip,
      io,
    });

    console.log("✅ Morning drop photo uploaded successfully");

    return trip;
  } catch (error) {
    console.error("🔥 uploadMorningDropPhotoService error:", error.message);
    throw error;
  }
};

/* ================= UPLOAD AFTERNOON PICKUP PHOTO ================= */
export const uploadAfternoonPickupPhotoService = async (tripId, file, body, io) => {
  try {
    console.log("📸 Uploading afternoon pickup photo:", tripId);

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
      title: "Afternoon Pickup Photo Uploaded",
      message: `Pickup photo uploaded for ${trip.childName || "student"}`,
      event: EVENTS.AFTERNOON_PICKUP_PHOTO_UPLOADED,
      payload: trip,
      io,
    });

    console.log("✅ Afternoon pickup photo uploaded successfully");

    return trip;
  } catch (error) {
    console.error("🔥 uploadAfternoonPickupPhotoService error:", error.message);
    throw error;
  }
};
