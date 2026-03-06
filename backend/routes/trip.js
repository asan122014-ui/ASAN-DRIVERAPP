import express from "express";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/* ================= START TRIP ================= */

router.post("/start", verifyToken, async (req, res) => {
  try {

    const { tripType } = req.body;

    const formattedTripType =
      tripType === "morning" ? "morning" : "afternoon";

    /* Prevent multiple active trips */

    const existingTrip = await Trip.findOne({
      driver: req.user.id,
      status: "active"
    });

    if (existingTrip) {
      return res.status(400).json({
        success: false,
        message: "Trip already active"
      });
    }

    const trip = await Trip.create({
      driver: req.user.id,
      tripType: formattedTripType,
      totalStudents: 0,
      amount: 0,
      startTime: new Date(),
      status: "active"
    });

    /* Notification */

    await Notification.create({
      driver: req.user.id,
      title: "Trip Started",
      message: `Your ${formattedTripType} trip has started.`,
      type: "trip_started"
    });

    res.status(201).json({
      success: true,
      message: "Trip started successfully",
      trip
    });

  } catch (error) {

    console.error("Start trip error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start trip"
    });

  }
});

/* ================= END TRIP ================= */

router.post("/end", verifyToken, async (req, res) => {
  try {

    const trip = await Trip.findOne({
      driver: req.user.id,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "No active trip found"
      });
    }

    trip.status = "completed";
    trip.endTime = new Date();

    /* Example earnings calculation */

    trip.amount = trip.totalStudents * 50;

    await trip.save();

    /* Trip completed notification */

    await Notification.create({
      driver: req.user.id,
      title: "Trip Completed",
      message: "Trip completed successfully",
      type: "trip_completed"
    });

    /* Payment notification */

    await Notification.create({
      driver: req.user.id,
      title: "Payment Credited",
      message: `₹${trip.amount} credited to your account`,
      type: "payment"
    });

    res.json({
      success: true,
      message: "Trip ended successfully",
      trip
    });

  } catch (error) {

    console.error("End trip error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to end trip"
    });

  }
});

/* ================= TRIP HISTORY ================= */

router.get("/history", verifyToken, async (req, res) => {
  try {

    const trips = await Trip.find({
      driver: req.user.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      trips
    });

  } catch (error) {

    console.error("Trip history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch trip history"
    });

  }
});

/* ================= LATEST TRIP ================= */

router.get("/latest", verifyToken, async (req, res) => {
  try {

    const trip = await Trip.findOne({
      driver: req.user.id
    }).sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "No trips found"
      });
    }

    res.json({
      success: true,
      trip
    });

  } catch (error) {

    console.error("Latest trip error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest trip"
    });

  }
});

export default router;
