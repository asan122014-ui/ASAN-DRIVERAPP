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
  getTripDetailsService,
  getTodayTripStatusService,
} from "../services/tripService.js";

/* ================= HELPER: Error Handler ================= */
const handleError = (error) => {
  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  console.error("Unhandled error:", error);
  return {
    statusCode: 500,
    message: error.message || "Internal server error",
  };
};

/* ================= HELPER: Response Helper ================= */
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, error) => {
  const { statusCode, message } = handleError(error);
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/* ================= HELPER: Cloudinary Cleanup ================= */
const cleanupCloudinary = async (file) => {
  if (!file?.filename && !file?.public_id) return;

  try {
    const publicId = file.filename || file.public_id;
    await cloudinary.uploader.destroy(publicId);
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

    return successResponse(res, trip, "Trip started successfully", 201);
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Trip ended successfully");
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trips || []);
  } catch (error) {
    return errorResponse(res, error);
  }
};

/* ================= GET SINGLE TRIP BY ID ================= */
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

    return successResponse(res, trip);
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trips || []);
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trips || []);
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Student picked up successfully");
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Student dropped successfully");
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, progress);
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Payment received successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/* ================= UPLOAD MORNING DROP PHOTO ================= */
export const uploadMorningDropPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

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

    return successResponse(res, trip, "Morning drop photo uploaded successfully");
  } catch (error) {
    await cleanupCloudinary(req.file);
    return errorResponse(res, error);
  }
};

/* ================= UPLOAD AFTERNOON PICKUP PHOTO ================= */
export const uploadAfternoonPickupPhoto = async (req, res) => {
  try {
    const { tripId } = req.params;

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

    return successResponse(res, trip, "Afternoon pickup photo uploaded successfully");
  } catch (error) {
    await cleanupCloudinary(req.file);
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Morning drop photo verified successfully");
  } catch (error) {
    return errorResponse(res, error);
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

    return successResponse(res, trip, "Afternoon pickup photo verified successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

/* ================= TRIP DETAILS (BY DATE) ================= */
export const getTripDetails = async (req, res) => {
  try {
    const { driverId, tripType, date } = req.params;

    const trips = await getTripDetailsService(driverId, tripType, date);

    return successResponse(res, {
      count: trips.length,
      trips,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

/* ================= TODAY'S TRIP STATUS ================= */
export const getTodayTripStatus = async (req, res) => {
  try {
    const { driverId } = req.params;

    const status = await getTodayTripStatusService(driverId);

    return successResponse(res, status);
  } catch (error) {
    return errorResponse(res, error);
  }
};
