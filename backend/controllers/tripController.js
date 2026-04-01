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

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

    // ✅ create trip
    const trip = await startTripService(
      driverId,
      tripType,
      req.app.get("io")
    );

    // ✅ UPDATE DRIVER STATS (🔥 IMPORTANT FIX)
    await Driver.findOneAndUpdate(
      { driverId },
      {
        $inc: {
          totalTrips: 1,
          todayTrips: 1
        },
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
      message: error.message
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
        message: "Driver ID is required"
      });
    }

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
      message: error.message
    });
  }
};


/* ================= ACTIVE TRIP ================= */
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
      message: error.message
    });
  }
};


/* ================= TRIP HISTORY ================= */
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
      message: error.message
    });
  }
};
