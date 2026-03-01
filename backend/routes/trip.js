import express from "express";
import Trip from "../models/Trips.js";
import verifyToken from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/* ================= START TRIP ================= */
router.post("/start", verifyToken, async (req, res) => {
  try {
    const formattedTripType =
      req.body.tripType === "morning" ? "Morning" : "Afternoon";

    const trip = await Trip.create({
      driver: req.user.id,
      tripType: formattedTripType,
      students: 0,
      amount: 0,
      startTime: new Date(),
      status: "Active",
    });

    // 🔔 CREATE NOTIFICATION
    await Notification.create({
      driver: req.user.id,
      title: "Trip Started",
      message: `Your ${trip.tripType} trip has started.`,
      type: "trip_start",
    });

    res.status(201).json(trip);
  } catch (err) {
    console.error("Start trip error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

/* ================= END TRIP ================= */
router.post("/end", verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      driver: req.user.id,
      status: "Active",
    });

    if (!trip) {
      return res.status(404).json({ message: "No active trip found" });
    }

    trip.status = "Completed";
    trip.endTime = new Date();

    // Example calculation (optional)
    trip.amount = trip.students * 50; // or your logic

    await trip.save();

    // 🔔 Trip Completed Notification
    await Notification.create({
      driver: req.user.id,
      title: "Trip Completed",
      message: "Trip completed successfully.",
      type: "trip_end",
    });

    // 💰 Payment Notification
    await Notification.create({
      driver: req.user.id,
      title: "Payment Credited",
      message: `₹${trip.amount} has been credited to your account.`,
      type: "payment",
    });

    res.status(200).json(trip);
  } catch (err) {
    console.error("End trip error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

/* ================= TRIP HISTORY ================= */
router.get("/history", verifyToken, async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json(trips);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

/* ================= LATEST TRIP ================= */
router.get("/latest", verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findOne({ driver: req.user.id })
      .sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({ message: "No trips found" });
    }

    res.status(200).json(trip);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;