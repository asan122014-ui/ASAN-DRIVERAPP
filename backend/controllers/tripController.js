import Driver from "../models/Driver.js";
import Trip from "../models/Trips.js";
import { cloudinary } from "../config/cloudinary.js";

import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService,
  getParentTripsService,
  pickupStudentService,
  dropStudentService,
  getTripProgressService,
  receivePaymentService,
  uploadMorningDropPhotoService,
  uploadAfternoonPickupPhotoService,
} from "../services/tripService.js";

/* ================= START TRIP ================= */
export const startTrip = async (req, res) => {
  try {
    const { driverId, tripType } = req.body;

    if (!driverId || !tripType) {
      return res.status(400).json({
        success: false,
        message: "driverId and tripType are required",
      });
    }

    const trip = await startTripService(
      driverId,
      tripType,
      req.app.get("io")
    );

    await Driver.findOneAndUpdate(
      { driverId },
      {
        currentStatus: "on_trip",
        isOnline: true,
      }
    );

    return res.status(201).json({
      success: true,
      data: trip,
    });

  } catch (error) {
    console.error("🔥 Start trip error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start trip",
    });
  }
};

/* ================= END TRIP ================= */
export const endTrip = async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const trip = await endTripService(
      driverId,
      req.app.get("io")
    );

    await Driver.findOneAndUpdate(
      { driverId },
      {
        currentStatus: "idle",
        isOnline: false,
      }
    );

    return res.json({
      success: true,
      data: trip,
    });

  } catch (error) {
    console.error("🔥 End trip error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to end trip",
    });
  }
};

/* ================= PICKUP STUDENT ================= */
export const pickupStudent = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await pickupStudentService(
      tripId,
      req.app.get("io")
    );

    return res.status(200).json({
      success: true,
      message: "Student picked up successfully",
      data: trip,
    });
  } catch (error) {
    console.error("Pickup Student:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudent = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await dropStudentService(
      tripId,
      req.app.get("io")
    );

    return res.status(200).json({
      success: true,
      message: "Student dropped successfully",
      data: trip,
    });
  } catch (error) {
    console.error("Drop Student:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= UPLOAD MORNING DROP PHOTO ================= */
export const uploadMorningDropPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    const trip = await uploadMorningDropPhotoService(
      tripId,
      req.file,
      req.body
    );

    return res.json({
      success: true,
      message: "Morning drop photo uploaded successfully",
      data: trip,
    });
  } catch (error) {
    console.error("❌ Morning Drop Photo Error:", error);

    // ✅ FIXED: Check both filename and public_id
    if (req.file?.filename || req.file?.public_id) {
      try {
        const publicId = req.file.filename || req.file.public_id;
        await cloudinary.uploader.destroy(publicId);
        console.log(`🧹 Cleaned up: ${publicId}`);
      } catch (cleanupError) {
        console.error("Failed to cleanup Cloudinary file:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= UPLOAD AFTERNOON PICKUP PHOTO ================= */
export const uploadAfternoonPickupPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    const trip = await uploadAfternoonPickupPhotoService(
      tripId,
      req.file,
      req.body
    );

    return res.json({
      success: true,
      message: "Afternoon pickup photo uploaded successfully",
      data: trip,
    });
  } catch (error) {
    console.error("❌ Afternoon Pickup Photo Error:", error);

    // ✅ FIXED: Check both filename and public_id
    if (req.file?.filename || req.file?.public_id) {
      try {
        const publicId = req.file.filename || req.file.public_id;
        await cloudinary.uploader.destroy(publicId);
        console.log(`🧹 Cleaned up: ${publicId}`);
      } catch (cleanupError) {
        console.error("Failed to cleanup Cloudinary file:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= TRIP PROGRESS ================= */
export const getTripProgress = async (req, res) => {
  try {
    const { driverId } = req.params;

    const progress = await getTripProgressService(
      driverId
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Trip Progress:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= GET ACTIVE TRIP ================= */
export const getActiveTrip = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const trip = await getActiveTripService(driverId);

    // ✅ Hide verification photos from driver
    if (trip) {
      const sanitized = trip.toObject ? trip.toObject() : trip;
      delete sanitized.morningDrop;
      delete sanitized.afternoonPickup;
      return res.json({
        success: true,
        data: sanitized || null,
      });
    }

    return res.json({
      success: true,
      data: null,
    });

  } catch (error) {
    console.error("🔥 Active trip error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active trip",
    });
  }
};

/* ================= DRIVER TRIP HISTORY ================= */
export const getTripHistory = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const trips = await getDriverTripsService(driverId);

    // ✅ Strip verification photos from driver history
    const sanitizedTrips = trips.map(trip => {
      const tripObj = trip.toObject ? trip.toObject() : trip;
      delete tripObj.morningDrop;
      delete tripObj.afternoonPickup;
      return tripObj;
    });

    return res.json({
      success: true,
      data: sanitizedTrips || [],
    });

  } catch (error) {
    console.error("🔥 Trip history error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch trip history",
    });
  }
};

/* ================= PARENT TRIP HISTORY ================= */
export const getParentTripHistory = async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    const trips = await getParentTripsService(parentId);

    // ✅ Parent history includes verification photos
    return res.json({
      success: true,
      data: trips || [],
    });

  } catch (error) {
    console.error("🔥 Parent trip history error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch parent trips",
    });
  }
};

/* ================= RECEIVE PAYMENT ================= */
export const receivePayment = async (req, res) => {
  try {
    const { tripId, paymentMethod } = req.body;

    if (!tripId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "tripId and paymentMethod are required",
      });
    }

    const trip = await receivePaymentService(
      tripId,
      paymentMethod,
      req.app.get("io")
    );

    return res.status(200).json({
      success: true,
      message: "Payment received successfully",
      data: trip,
    });
  } catch (error) {
    console.error("Receive Payment:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= TRIP DETAILS ================= */
export const getTripDetails = async (req, res) => {
  try {
    const { driverId, tripType, date } = req.params;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const trips = await Trip.find({
      driverId,
      tripType: new RegExp(`^${tripType}$`, "i"),
      createdAt: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("child", "name")
      .sort({ createdAt: 1 });

    // ✅ Hide verification photos from driver-facing endpoint
    const sanitizedTrips = trips.map(trip => {
      const t = trip.toObject ? trip.toObject() : trip;
      delete t.morningDrop;
      delete t.afternoonPickup;
      return t;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedTrips.length,
      data: sanitizedTrips,
    });
  } catch (error) {
    console.error("Trip Details:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
