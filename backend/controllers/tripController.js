import Driver from "../models/Driver.js";
import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService,
  getParentTripsService,
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

    /* ✅ UPDATE DRIVER STATUS */
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

    /* ✅ UPDATE DRIVER STATUS */
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

    return res.json({
      success: true,
      data: trip || null,
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

    return res.json({
      success: true,
      data: trips || [],
    });

  } catch (error) {
    console.error("🔥 Trip history error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch trip history",
    });
  }
};

/* ================= 🔥 PARENT TRIP HISTORY ================= */
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
    console.error("🔥 Parent trip history error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch parent trips",
    });
  }
};
