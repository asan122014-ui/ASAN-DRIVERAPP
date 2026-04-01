import Driver from "../models/Driver.js";
import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService
} from "../services/tripService.js";

/* ================= START TRIP ================= */
export const startTrip = async (req, res) => {
  try {
    const { driverId, tripType } = req.body;

    // ✅ VALIDATION
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

    if (!tripType) {
      return res.status(400).json({
        success: false,
        message: "Trip type is required"
      });
    }

    // ✅ CREATE TRIP
    const trip = await startTripService(
      driverId,
      tripType,
      req.app.get("io")
    );

    // ✅ UPDATE DRIVER STATUS ONLY (NO COUNTERS)
    await Driver.findOneAndUpdate(
      { driverId },
      {
        currentStatus: "on_trip",
        isOnline: true
      }
    );

    res.status(201).json({
      success: true,
      data: trip
    });

  } catch (error) {
    console.error("🔥 Start trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to start trip"
    });
  }
};

/* ================= END TRIP ================= */
export const endTrip = async (req, res) => {
  try {
    const { driverId } = req.body;

    // ✅ VALIDATION
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

    // ✅ END TRIP
    const trip = await endTripService(
      driverId,
      req.app.get("io")
    );

    // ✅ RESET DRIVER STATUS
    await Driver.findOneAndUpdate(
      { driverId },
      {
        currentStatus: "idle",
        isOnline: false
      }
    );

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {
    console.error("🔥 End trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to end trip"
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
        message: "Driver ID is required"
      });
    }

    const trip = await getActiveTripService(driverId);

    res.json({
      success: true,
      data: trip || null
    });

  } catch (error) {
    console.error("🔥 Active trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active trip"
    });
  }
};

/* ================= GET TRIP HISTORY ================= */
export const getTripHistory = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

    const trips = await getDriverTripsService(driverId);

    res.json({
      success: true,
      data: trips || []
    });

  } catch (error) {
    console.error("🔥 Trip history error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch trip history"
    });
  }
};
