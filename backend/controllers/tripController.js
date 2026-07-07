import Trip from "../models/Trips.js";
import { cloudinary } from "../config/cloudinary.js";

import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripsService,
  getActiveTripService,
  getParentTripsService,
  pickupStudentService,
  dropStudentService,
  getTripProgressService,
  receivePaymentService,
  uploadMorningDropPhotoService,
  uploadAfternoonPickupPhotoService,
  verifyMorningDropPhotoService,
  verifyAfternoonPickupPhotoService,
} from "../services/tripService.js";

/* ================= HELPER: Error Handler ================= */
const handleError = (error) => {
  // Custom errors have statusCode property
  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  // Default to 500 for unknown errors
  console.error("🔥 Unhandled error:", error);
  return {
    statusCode: 500,
    message: error.message || "Internal server error",
  };
};

/* ================= HELPER: Cloudinary Cleanup ================= */
const cleanupCloudinary = async (file) => {
  if (!file?.filename && !file?.public_id) return;

  try {
    const publicId = file.filename || file.public_id;
    await cloudinary.uploader.destroy(publicId);
    console.log(`🧹 Cleaned up: ${publicId}`);
  } catch (err) {
    console.error("Cloudinary cleanup failed:", err);
  }
};

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

    return res.status(201).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
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

    return res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= GET ACTIVE TRIPS (DRIVER DASHBOARD) ================= */
export const getActiveTrips = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const trips = await getActiveTripsService(driverId);

    return res.json({
      success: true,
      data: trips || [],
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= GET SINGLE TRIP BY ID (PARENT/STUDENT VIEW) ================= */
export const getTripById = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const trip = await getActiveTripService(tripId);

    return res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
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

    return res.json({
      success: true,
      data: trips || [],
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
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

    return res.json({
      success: true,
      data: trips || [],
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= PICKUP STUDENT ================= */
export const pickupStudent = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

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
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudent = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

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
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= TRIP PROGRESS ================= */
export const getTripProgress = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const progress = await getTripProgressService(driverId);

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
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
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= UPLOAD MORNING DROP PHOTO ================= */
export const uploadMorningDropPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    // ✅ Validate tripId
    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    const trip = await uploadMorningDropPhotoService(
      tripId,
      req.file,
      req.body,
      req.app.get("io")
    );

    return res.json({
      success: true,
      message: "Morning drop photo uploaded successfully",
      data: trip,
    });
  } catch (error) {
    console.error("❌ Morning Drop Photo Error:", error);

    // ✅ Use helper for cleanup
    await cleanupCloudinary(req.file);

    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= UPLOAD AFTERNOON PICKUP PHOTO ================= */
export const uploadAfternoonPickupPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    // ✅ Validate tripId
    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    const trip = await uploadAfternoonPickupPhotoService(
      tripId,
      req.file,
      req.body,
      req.app.get("io")
    );

    return res.json({
      success: true,
      message: "Afternoon pickup photo uploaded successfully",
      data: trip,
    });
  } catch (error) {
    console.error("❌ Afternoon Pickup Photo Error:", error);

    // ✅ Use helper for cleanup
    await cleanupCloudinary(req.file);

    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= VERIFY MORNING DROP PHOTO ================= */
export const verifyMorningDropPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const trip = await verifyMorningDropPhotoService(
      tripId,
      req.app.get("io")
    );

    return res.json({
      success: true,
      message: "Morning drop photo verified successfully",
      data: trip,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= VERIFY AFTERNOON PICKUP PHOTO ================= */
export const verifyAfternoonPickupPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    const trip = await verifyAfternoonPickupPhotoService(
      tripId,
      req.app.get("io")
    );

    return res.json({
      success: true,
      message: "Afternoon pickup photo verified successfully",
      data: trip,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/* ================= TRIP DETAILS (BY DATE) ================= */
export const getTripDetails = async (req, res) => {
  try {
    const { driverId, tripType, date } = req.params;

    // ✅ Validate driverId and tripType
    if (!driverId || !tripType) {
      return res.status(400).json({
        success: false,
        message: "driverId and tripType are required",
      });
    }

    // ✅ Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD format.",
      });
    }

    // ✅ Reuse validated dateObj
    const start = new Date(dateObj);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateObj);
    end.setHours(23, 59, 59, 999);

    const trips = await Trip.find({
      driverId,
      tripType: new RegExp(`^${tripType}$`, "i"),
      createdAt: {
        $gte: start,
        $lte: end,
      },
    })
      .select("-morningDrop -afternoonPickup") // Hide verification photos from driver
      .populate("child", "name")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: trips.length,
      data: trips,
    });
  } catch (error) {
    const { statusCode, message } = handleError(error);
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};
