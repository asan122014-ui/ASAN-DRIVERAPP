import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= START TRIP ================= */
export const startTripService = async (driverId, tripType, io) => {
  try {
    console.log("🚀 Starting trip:", driverId);

    if (!driverId || !tripType) {
      throw new Error("driverId and tripType are required");
    }

    /* ✅ DRIVER */
    const driver = await Driver.findOne({ driverId });
    if (!driver) throw new Error("Driver not found");

    /* ✅ PREVENT MULTIPLE ACTIVE TRIPS */
    const existingTrip = await Trips.findOne({
      driverId,
      status: "in_transit",
    });

    if (existingTrip) {
      console.log("⚠️ Existing active trip found");
      return existingTrip;
    }

    /* ✅ FETCH CHILDREN WITH PARENT */
    const children = await Child.find({ driverId }).populate("parentId");

    if (!children.length) {
      throw new Error("No children assigned to this driver");
    }

    const firstChild = children[0];

    /* ================= CREATE TRIP ================= */
    const trip = await Trips.create({
      driverId,
      tripType,
      status: "in_transit",

      students: children.map((c) => c._id),
      totalStudents: children.length,

      // 🔥 IMPORTANT: store relation
      parent: firstChild.parentId?._id,
      child: firstChild._id,

      childName: firstChild.name,

      route: {
        from: firstChild?.pickupLocation || "Home",
        to: firstChild?.schoolName || "School",
      },

      eta: "30 mins",
      startTime: new Date(),
    });

    /* ✅ RESET CHILD STATUS */
    await Child.updateMany(
      { driverId },
      { status: "waiting" }
    );

    /* 🔥 SEND NOTIFICATION */
    await sendNotification({
      driverId,
      title: "Trip Started",
      message: `Trip started (${tripType}). ETA: ${trip.eta}`,
      type: "trip_start",
      priority: "medium",
      io,
    });

    /* 🔥 SOCKET BACKUP */
    if (io) {
      const room = String(driverId);

      io.to(room).emit("trip_started", trip);

      io.to(room).emit("notification", {
        _id: Date.now(),
        title: "Trip Started",
        message: `Trip started (${tripType}). ETA: ${trip.eta}`,
        createdAt: new Date(),
      });
    }

    console.log("✅ Trip created:", trip._id);
    return trip;

  } catch (error) {
    console.error("🔥 startTripService error:", error.message);
    throw error;
  }
};

/* ================= END TRIP ================= */
export const endTripService = async (driverId, io) => {
  try {
    console.log("🔥 Ending trip:", driverId);

    const trip = await Trips.findOne({
      driverId,
      status: "in_transit",
    }).sort({ createdAt: -1 });

    if (!trip) {
      console.log("❌ No active trip found");
      return null;
    }

    /* ✅ TIME */
    if (!trip.startTime) {
      trip.startTime = new Date();
    }

    trip.endTime = new Date();

    const durationMs = trip.endTime - trip.startTime;
    trip.duration = Math.max(1, Math.round(durationMs / 60000));

    /* ✅ COMPLETE */
    trip.status = "completed";
    await trip.save();

    console.log("✅ Trip ended:", trip._id);

    /* ✅ RESET CHILD STATUS */
    await Child.updateMany(
      { driverId },
      { status: "waiting" }
    );

    /* 🔥 SEND NOTIFICATION */
    await sendNotification({
      driverId,
      title: "Trip Completed",
      message: `Trip completed in ${trip.duration} mins`,
      type: "trip_end",
      priority: "low",
      io,
    });

    /* 🔥 SOCKET BACKUP */
    if (io) {
      const room = String(driverId);

      io.to(room).emit("trip_ended", trip);

      io.to(room).emit("notification", {
        _id: Date.now(),
        title: "Trip Completed",
        message: `Trip completed in ${trip.duration} mins`,
        createdAt: new Date(),
      });
    }

    return trip;

  } catch (error) {
    console.error("🔥 endTripService error:", error.message);
    throw error;
  }
};

/* ================= ACTIVE TRIP ================= */
export const getActiveTripService = async (driverId) => {
  try {
    return await Trips.findOne({
      driverId,
      status: "in_transit",
    })
      .populate("students", "name status")
      .populate("child", "name status")
      .populate("parent", "name")
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
      .lean();

  } catch (error) {
    console.error("🔥 getDriverTripsService error:", error);
    throw error;
  }
};

/* ================= 🔥 PARENT TRIPS (FINAL FIX) ================= */
export const getParentTripsService = async (parentId) => {
  try {
    return await Trips.find({ parent: parentId })
      .sort({ createdAt: -1 })
      .populate("child", "name status pickupLocation schoolName")
      .lean();

  } catch (error) {
    console.error("🔥 getParentTripsService error:", error);
    throw error;
  }
};
