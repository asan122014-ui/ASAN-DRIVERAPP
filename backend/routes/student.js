import express from "express";
import Student from "../models/Students.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// Get students assigned to logged-in driver
router.get("/", verifyToken, async (req, res) => {
  try {
    const students = await Student.find({
      driver: req.user.id,
    });

    res.json(students);

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});
router.get("/active", verifyToken, async (req, res) => {
  try {
    const students = await Student.find({
      driver: req.user.id,
      status: { $ne: "dropped" }
    });

    res.json(students);

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});
router.put("/:id/pickup", verifyToken, async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.params.id, {
      status: "onboard",
    });

    res.json({ message: "Student picked up" });

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});
router.put("/:id/drop", verifyToken, async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.params.id, {
      status: "dropped",
    });

    res.json({ message: "Student dropped" });

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});
router.post("/end", verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      driver: req.user.id,
    }).sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({ message: "No active trip" });
    }

    trip.endTime = new Date();
    trip.duration =
      Math.round(
        (trip.endTime - trip.createdAt) / 60000
      ) + " min";

    await trip.save();

    res.json(trip);

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});
export default router;