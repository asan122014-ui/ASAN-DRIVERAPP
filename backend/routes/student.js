import express from "express";
import Student from "../models/Students.js";
import Trip from "../models/Trips.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/* ================= GET ALL ASSIGNED STUDENTS ================= */

router.get("/", verifyToken, async (req, res) => {
  try {

    const students = await Student.find({
      driver: req.user.id
    });

    res.json({
      success: true,
      students
    });

  } catch (error) {

    console.error("Get students error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch students"
    });

  }
});

/* ================= GET ACTIVE STUDENTS ================= */

router.get("/active", verifyToken, async (req, res) => {
  try {

    const students = await Student.find({
      driver: req.user.id,
      status: { $ne: "dropped" }
    });

    res.json({
      success: true,
      students
    });

  } catch (error) {

    console.error("Active students error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active students"
    });

  }
});

/* ================= PICKUP STUDENT ================= */

router.put("/:id/pickup", verifyToken, async (req, res) => {
  try {

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        driver: req.user.id
      },
      { status: "onboard" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.json({
      success: true,
      message: "Student picked up",
      student
    });

  } catch (error) {

    console.error("Pickup error:", error);

    res.status(500).json({
      success: false,
      message: "Pickup failed"
    });

  }
});

/* ================= DROP STUDENT ================= */

router.put("/:id/drop", verifyToken, async (req, res) => {
  try {

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        driver: req.user.id
      },
      { status: "dropped" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.json({
      success: true,
      message: "Student dropped",
      student
    });

  } catch (error) {

    console.error("Drop error:", error);

    res.status(500).json({
      success: false,
      message: "Drop failed"
    });

  }
});

/* ================= END TRIP ================= */

router.post("/end", verifyToken, async (req, res) => {
  try {

    const trip = await Trip.findOne({
      driver: req.user.id,
      status: "active"
    }).sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "No active trip found"
      });
    }

    trip.endTime = new Date();
    trip.duration = Math.round(
      (trip.endTime - trip.createdAt) / 60000
    );

    trip.status = "completed";

    await trip.save();

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

export default router;
