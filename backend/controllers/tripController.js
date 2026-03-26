import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService
} from "../services/tripService.js";
import mongoose from "mongoose";

/* ================= START TRIP ================= */
export const getActiveTrip = async (req, res) => {
  try {
    const { driverId } = req.params;

    console.log("DriverId received:", driverId);

    // ✅ FIX 1: check empty
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

    // ✅ FIX 2: validate Mongo ObjectId (THIS IS YOUR ISSUE 🔥)
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Driver ID"
      });
    }

    const trip = await getActiveTripService(driverId);

    return res.status(200).json({
      success: true,
      data: trip || null
    });

  } catch (error) {
    console.error("Active trip error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch active trip"
    });
  }
};
/* ================= END TRIP ================= */
export const endTrip = async (req, res) => {
  try {
    const { driverId } = req.body; // ✅ FIXED

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

/* ================= TRIP HISTORY ================= */
export const getTripHistory = async (req, res) => {
  try {
    const { driverId } = req.query; // ✅ FIXED

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

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
    const { driverId } = req.query; // ✅ FIXED

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required"
      });
    }

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
