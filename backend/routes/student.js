import express from "express";
import Student from "../models/Students.js";
import Trip from "../models/Trips.js";

const router = express.Router();

/* ================= GET ALL ASSIGNED STUDENTS ================= */
router.get("/", async (req, res) => {
  try {
    const { driverId } = req.query;

    const students = await Student.find({
      driverId: driverId // ✅ FIXED
    }).lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* ================= GET ACTIVE STUDENTS ================= */
router.get("/active", async (req, res) => {
  try {
    const { driverId } = req.query;

    console.log("driverId:", driverId); // debug

    const students = await Student.find({
      driverId: driverId, // ✅ FIXED
      status: { $ne: "dropped" }
    }).lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error("🔥 Active students error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* ================= PICKUP ================= */
router.put("/:id/pickup", async (req, res) => {
  try {
    const { driverId } = req.body;

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        driverId: driverId, // ✅ FIXED
        status: "waiting"
      },
      { status: "onboard" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or already picked"
      });
    }

    res.json({
      success: true,
      student
    });

  } catch (error) {
    console.error("Pickup error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* ================= DROP ================= */
router.put("/:id/drop", async (req, res) => {
  try {
    const { driverId } = req.body;

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        driverId: driverId, // ✅ FIXED
        status: "onboard"
      },
      { status: "dropped" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not onboard"
      });
    }

    res.json({
      success: true,
      student
    });

  } catch (error) {
    console.error("Drop error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* ================= END TRIP ================= */
router.post("/end", async (req, res) => {
  try {
    const { driverId } = req.body;

    const trip = await Trip.findOne({
      driverId: driverId, // ✅ FIXED
      status: "active"
    }).sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "No active trip"
      });
    }

    trip.endTime = new Date();
    trip.duration = Math.round(
      (trip.endTime - trip.startTime) / 60000
    );
    trip.status = "completed";

    await trip.save();

    res.json({
      success: true,
      trip
    });

  } catch (error) {
    console.error("🔥 End trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
