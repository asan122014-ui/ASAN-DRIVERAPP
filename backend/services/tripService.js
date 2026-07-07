import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js"; // 🔥 ensure model is registered
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("🚀 Starting trip:", driverId);

    if (!driverId || !tripType) {
      throw new Error("driverId and tripType are required");
    }

    /* ================= VALIDATE TRIP TYPE BASED ON TIME ================= */

    const hour = new Date().getHours();

    if (tripType === "morning" && hour >= 12) {
      throw new Error("Morning trip is no longer available.");
    }

    if (tripType === "afternoon" && hour < 12) {
      throw new Error("Afternoon trip has not started yet.");
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
      throw new Error(`${tripType} trip already completed today`);
    }

    /* ================= DRIVER ================= */

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      throw new Error("Driver not found");
    }

    /* ================= PREVENT MULTIPLE ACTIVE TRIPS ================= */
    // ✅ FIX: Use findOne and throw error instead of returning

    const existingTrip = await Trips.findOne({
      driverId,
      status: "in_transit",
    });

    if (existingTrip) {
      throw new Error("Driver already has an active trip.");
    }

    /* ================= GET ALL CHILDREN ================= */

    const children = await Child.find({
      driverId,
    }).populate("parentId");

    if (!children.length) {
      throw new Error("No children assigned to this driver");
    }

    /* ================= RESET CHILD STATUS ================= */

    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      }
    );

    /* ================= CREATE ONE TRIP PER CHILD ================= */

    const createdTrips = [];

    for (const child of children) {
      if (!child.parentId) continue;

      const trip = await Trips.create({
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
      });

      createdTrips.push(trip);
    }

    /* ================= SEND NOTIFICATION ================= */

    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `Trip started (${tripType})`,
      type: "trip_start",
      priority: "medium",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(driverId)).emit("trip_started", createdTrips);

      io.to(String(driverId)).emit("notification", {
        _id: Date.now(),
        title: "Trip Started",
        message: `Trip started (${tripType})`,
        createdAt: new Date(),
      });
    }

    console.log(`✅ ${createdTrips.length} child trips created`);

    return createdTrips;
  } catch (error) {
    console.error("🔥 startTripService error:", error.message);
    throw error;
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
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
      // ✅ FIX: Check the actual image exists, not just the object
      if (trip.tripType === "morning" && !trip.morningDrop?.image) {
        throw new Error(`Drop photo missing for ${trip.childName}`);
      }

      if (trip.tripType === "afternoon" && !trip.afternoonPickup?.image) {
        throw new Error(`Pickup photo missing for ${trip.childName}`);
      }

      if (!trip.pickupStatus) {
        throw new Error(`${trip.childName} was not picked up`);
      }

      if (!trip.dropStatus) {
        throw new Error(`${trip.childName} was not dropped`);
      }
    }

    const endTime = new Date();

    /* ================= COMPLETE ALL CHILD TRIPS ================= */

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

    console.log(`✅ ${trips.length} trips completed`);

    /* ================= RESET CHILD STATUS ================= */

    await Child.updateMany(
      { driverId },
      {
        status: "waiting",
      }
    );

    /* ================= SEND NOTIFICATION ================= */

    await sendNotification({
      driverId,
      title: "Trip Completed",
      message: `${trips.length} child trips completed`,
      type: "trip_end",
      priority: "low",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(driverId)).emit("trip_ended", trips);

      io.to(String(driverId)).emit("notification", {
        _id: Date.now(),
        title: "Trip Completed",
        message: `${trips.length} child trips completed`,
        createdAt: new Date(),
      });
    }

    return trips;
  } catch (error) {
    console.error("🔥 endTripService error:", error.message);
    throw error;
  }
};

/* ================= ACTIVE TRIP ================= */
export const getActiveTripService = async (driverId) => {
  try {
    return await Trips.find({
      driverId,
      status: "in_transit",
    })
      .populate("child", "name status")
      .populate("parent", "name")
      .sort({ createdAt: -1 })
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
      throw new Error("Trip not found");
    }

    if (trip.pickupStatus) {
      return trip;
    }

    /* ================= VALIDATE PHOTO FOR AFTERNOON TRIPS ================= */
    // ✅ FIX: Check the actual image exists

    if (trip.tripType === "afternoon" && !trip.afternoonPickup?.image) {
      throw new Error("Upload pickup photo before picking up student.");
    }

    trip.pickupStatus = true;
    trip.pickupTime = new Date();

    await trip.save();

    await Child.findByIdAndUpdate(trip.child._id, {
      status: "onboard",
    });

    await sendNotification({
      driverId: trip.driverId,
      title: "Student Picked Up",
      message: `${trip.child.name} has been picked up`,
      type: "pickup",
      priority: "medium",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(trip.driverId)).emit("student_picked_up", trip);
      io.to(String(trip.driverId)).emit("notification", {
        _id: Date.now(),
        title: "Student Picked Up",
        message: `${trip.child.name} has been picked up`,
        createdAt: new Date(),
      });
    }

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
      throw new Error("Trip not found");
    }

    if (trip.dropStatus) {
      return trip;
    }

    /* ================= VALIDATE PHOTO FOR MORNING TRIPS ================= */
    // ✅ FIX: Check the actual image exists

    if (trip.tripType === "morning" && !trip.morningDrop?.image) {
      throw new Error("Upload drop photo before completing drop.");
    }

    trip.dropStatus = true;
    trip.dropTime = new Date();

    await Child.findByIdAndUpdate(trip.child._id, {
      status: "dropped",
    });

    // Do NOT mark trip as completed here
    // Let endTripService() handle completion of all trips together

    await trip.save();

    await sendNotification({
      driverId: trip.driverId,
      title: "Student Dropped",
      message: `${trip.child.name} reached destination`,
      type: "drop",
      priority: "medium",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(trip.driverId)).emit("student_dropped", trip);
      io.to(String(trip.driverId)).emit("notification", {
        _id: Date.now(),
        title: "Student Dropped",
        message: `${trip.child.name} reached destination`,
        createdAt: new Date(),
      });
    }

    return trip;
  } catch (error) {
    console.error("dropStudentService:", error);
    throw error;
  }
};

/* ================= TRIP PROGRESS ================= */
export const getTripProgressService = async (driverId) => {
  try {
    const children = await Child.find({ driverId });

    const totalStudents = children.length;

    const pickedStudents = children.filter(
      (child) => child.status === "onboard"
    ).length;

    const droppedStudents = children.filter(
      (child) => child.status === "dropped"
    ).length;

    const absentStudents = children.filter(
      (child) => child.status === "absent"
    ).length;

    const remainingStudents = children.filter(
      (child) => child.status === "waiting" || child.status === "onboard"
    ).length;

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
      throw new Error("Trip not found");
    }

    if (trip.paymentReceived) {
      throw new Error("Payment already received");
    }

    trip.paymentReceived = true;
    trip.paymentMethod = paymentMethod;
    trip.paymentReceivedAt = new Date();

    await trip.save();

    await sendNotification({
      driverId: trip.driverId,
      title: "Payment Received",
      message: `Payment received for ${trip.child.name}`,
      type: "payment",
      priority: "low",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(trip.driverId)).emit("payment_received", trip);
      io.to(String(trip.driverId)).emit("notification", {
        _id: Date.now(),
        title: "Payment Received",
        message: `Payment received for ${trip.child.name}`,
        createdAt: new Date(),
      });
    }

    return trip;
  } catch (error) {
    console.error("receivePaymentService:", error);
    throw error;
  }
};

/* ================= UPLOAD MORNING DROP PHOTO ================= */
export const uploadMorningDropPhotoService = async (tripId, file, body, io) => {
  try {
    console.log("📸 Uploading morning drop photo:", tripId);

    if (!tripId || !file) {
      throw new Error("tripId and file are required");
    }

    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new Error("Trip not found");
    }

    /* ================= VALIDATE TRIP TYPE ================= */

    if (trip.tripType !== "morning") {
      throw new Error("This is not a morning trip.");
    }

    /* ================= CHECK IF PHOTO ALREADY EXISTS ================= */
    // ✅ FIX: Check the actual image exists

    if (trip.morningDrop?.image) {
      throw new Error("Morning drop photo already uploaded");
    }

    /* ================= SAVE PHOTO DATA ================= */
    // ✅ FIX: Use secure_url first (Cloudinary)
    // ✅ FIX: Convert capturedAt to Date object

    trip.morningDrop = {
      image: file.secure_url || file.path || file.url,
      latitude: body?.latitude || null,
      longitude: body?.longitude || null,
      capturedAt: body?.capturedAt ? new Date(body.capturedAt) : new Date(),
      uploadedAt: new Date(),
    };

    await trip.save();

    /* ================= SEND NOTIFICATION ================= */

    await sendNotification({
      driverId: trip.driverId,
      title: "Morning Drop Photo Uploaded",
      message: `Drop photo uploaded for ${trip.childName || "student"}`,
      type: "morning_drop",
      priority: "medium",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(trip.driverId)).emit("morning_drop_photo_uploaded", trip);
      io.to(String(trip.driverId)).emit("notification", {
        _id: Date.now(),
        title: "Morning Drop Photo Uploaded",
        message: `Drop photo uploaded for ${trip.childName || "student"}`,
        createdAt: new Date(),
      });
    }

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
      throw new Error("tripId and file are required");
    }

    const trip = await Trips.findById(tripId);

    if (!trip) {
      throw new Error("Trip not found");
    }

    /* ================= VALIDATE TRIP TYPE ================= */

    if (trip.tripType !== "afternoon") {
      throw new Error("This is not an afternoon trip.");
    }

    /* ================= CHECK IF PHOTO ALREADY EXISTS ================= */
    // ✅ FIX: Check the actual image exists

    if (trip.afternoonPickup?.image) {
      throw new Error("Afternoon pickup photo already uploaded");
    }

    /* ================= SAVE PHOTO DATA ================= */
    // ✅ FIX: Use secure_url first (Cloudinary)
    // ✅ FIX: Convert capturedAt to Date object

    trip.afternoonPickup = {
      image: file.secure_url || file.path || file.url,
      latitude: body?.latitude || null,
      longitude: body?.longitude || null,
      capturedAt: body?.capturedAt ? new Date(body.capturedAt) : new Date(),
      uploadedAt: new Date(),
    };

    await trip.save();

    /* ================= SEND NOTIFICATION ================= */

    await sendNotification({
      driverId: trip.driverId,
      title: "Afternoon Pickup Photo Uploaded",
      message: `Pickup photo uploaded for ${trip.childName || "student"}`,
      type: "afternoon_pickup",
      priority: "medium",
      io,
    });

    /* ================= SOCKET ================= */

    if (io) {
      io.to(String(trip.driverId)).emit("afternoon_pickup_photo_uploaded", trip);
      io.to(String(trip.driverId)).emit("notification", {
        _id: Date.now(),
        title: "Afternoon Pickup Photo Uploaded",
        message: `Pickup photo uploaded for ${trip.childName || "student"}`,
        createdAt: new Date(),
      });
    }

    console.log("✅ Afternoon pickup photo uploaded successfully");

    return trip;
  } catch (error) {
    console.error("🔥 uploadAfternoonPickupPhotoService error:", error.message);
    throw error;
  }
};
