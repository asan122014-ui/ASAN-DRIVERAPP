import express from "express";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";
import Driver from "../models/Driver.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/* ================= START TRIP ================= */

router.post("/start", verifyToken, startTrip);

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

    trip.amount = trip.totalStudents * 50;

    await trip.save();

    /* Update driver stats */

    await Driver.findByIdAndUpdate(req.user.id, {
      $inc: {
        totalTrips: 1,
        todayTrips: 1
      }
    });

    await Notification.create({
      driver: req.user.id,
      title: "Trip Completed",
      message: "Your trip has been completed successfully"
    });

    await Notification.create({
      driver: req.user.id,
      title: "Payment Credited",
      message: `₹${trip.amount} credited to your account`
    });

    res.json({
      success: true,
      message: "Trip ended successfully",
      trip
    });

  } catch (error) {

    console.error("END TRIP ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to end trip"
    });

  }

});


/* ================= TRIP HISTORY ================= */

router.get("/history", verifyToken, async (req, res) => {

  try {

    const trips = await Trip.find({
      driver: req.user.id
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      trips
    });

  } catch (error) {

    console.error("TRIP HISTORY ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch trip history"
    });

  }

});


/* ================= ACTIVE TRIP ================= */

router.get("/active", verifyToken, async (req, res) => {

  try {

    const trip = await Trip.findOne({
      driver: req.user.id,
      status: "active"
    }).lean();

    res.json({
      success: true,
      trip
    });

  } catch (error) {

    console.error("ACTIVE TRIP ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active trip"
    });

  }

});


/* ================= LATEST TRIP ================= */

router.get("/latest", verifyToken, async (req, res) => {

  try {

    const trip = await Trip.findOne({
      driver: req.user.id
    })
    .sort({ createdAt: -1 })
    .lean();

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

    console.error("LATEST TRIP ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest trip"
    });

  }

});

export default router;
