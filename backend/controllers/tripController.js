import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService
} from "../services/tripService.js";

/* ================= START TRIP ================= */

export const startTrip = async (req, res) => {
  try {

    const driverId = req.user?.id;
    const { tripType } = req.body;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const trip = await startTripService(
      driverId,
      tripType,
      req.app.get("io")
    );

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {

    console.error("Start trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

/* ================= END TRIP ================= */

export const endTrip = async (req, res) => {
  try {

    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const trip = await endTripService(driverId, req.app.get("io"));

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {

    console.error("End trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

/* ================= TRIP HISTORY ================= */

export const getTripHistory = async (req, res) => {
  try {

    const driverId = req.user?.id;

    const trips = await getDriverTripsService(driverId);

    res.json({
      success: true,
      data: trips
    });

  } catch (error) {

    console.error("Trip history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch trips"
    });

  }
};

/* ================= ACTIVE TRIP ================= */

export const getActiveTrip = async (req, res) => {
  try {

    const driverId = req.user?.id;

    const trip = await getActiveTripService(driverId);

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {

    console.error("Active trip error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active trip"
    });

  }
};

