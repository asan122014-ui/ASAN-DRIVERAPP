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

    /* ================= DRIVER ================= */

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      throw new Error("Driver not found");
    }

    /* ================= PREVENT MULTIPLE ACTIVE TRIPS ================= */

    const existingTrips = await Trips.find({
      driverId,
      status: "in_transit",
    });

    if (existingTrips.length > 0) {
      console.log("⚠️ Active trips already exist");
      return existingTrips;
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
      io.to(String(driverId)).emit(
        "trip_started",
        createdTrips
      );

      io.to(String(driverId)).emit("notification", {
        _id: Date.now(),
        title: "Trip Started",
        message: `Trip started (${tripType})`,
        createdAt: new Date(),
      });
    }

    console.log(
      `✅ ${createdTrips.length} child trips created`
    );

    return createdTrips;
  } catch (error) {
    console.error(
      "🔥 startTripService error:",
      error.message
    );
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

    const endTime = new Date();

    /* ================= COMPLETE ALL CHILD TRIPS ================= */

    for (const trip of trips) {
      if (!trip.startTime) {
        trip.startTime = endTime;
      }

      trip.endTime = endTime;

      const durationMs = endTime - trip.startTime;

      trip.duration = Math.max(
        1,
        Math.round(durationMs / 60000)
      );

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
      io.to(String(driverId)).emit(
        "trip_ended",
        trips
      );

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

    trip.dropStatus = true;
    trip.dropTime = new Date();

    await Child.findByIdAndUpdate(trip.child._id, {
      status: "dropped",
    });

    // Complete child trip
    trip.status = "completed";

    if (!trip.endTime) {
      trip.endTime = new Date();
    }

    trip.duration = Math.max(
      1,
      Math.round(
        (trip.endTime - trip.startTime) / 60000
      )
    );

    await trip.save();

    await sendNotification({
      driverId: trip.driverId,
      title: "Student Dropped",
      message: `${trip.child.name} reached destination`,
      type: "drop",
      priority: "medium",
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
    // Get all children assigned to this driver
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

    // Only waiting and onboard students are still remaining
    const remainingStudents = children.filter(
      (child) =>
        child.status === "waiting" ||
        child.status === "onboard"
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
export const receivePaymentService = async (
  tripId,
  paymentMethod,
  io
) => {
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

    return trip;
  } catch (error) {
    console.error("receivePaymentService:", error);
    throw error;
  }
};
