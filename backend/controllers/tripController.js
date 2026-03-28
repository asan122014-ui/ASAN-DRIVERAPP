import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService
} from "../services/tripService.js";

import mongoose from "mongoose";

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

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Driver ID"
      });
    }

    const trip = await startTripService(
      driverId,
      tripType,
      req.app.get("io")
    );

    res.status(201).json({
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

/* ================= ACTIVE TRIP ================= */
export const getActiveTrip = async (req, res) => {
  try {
    const { driverId } = req.params; // ✅ FIX

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
    console.error("Active trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active trip"
    });
  }
};

/* ================= TRIP HISTORY ================= */
export const getActiveTrip = async (req, res) => {
  try {
    const { driverId } = req.params; // ✅ FIX

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
    console.error("Active trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active trip"
    });
  }
};
