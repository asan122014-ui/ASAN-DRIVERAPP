import Student from "../models/Students.js"; // ✅ FIXED
import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ================= ADD STUDENT ================= */
export const addStudent = async (req, res) => {
  try {
    const {
      name,
      className,
      schoolName,
      parentId,
      parentName,
      parentPhone,
      driverId,
      pickupLocation,
      dropLocation
    } = req.body;

    if (!name || !parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Name, parentId, driverId required"
      });
    }

    const student = new Student({
      name,
      className,
      schoolName,
      parentId,
      parentName,
      parentPhone,
      driver: driverId,
      pickupLocation,
      dropLocation
    });

    await student.save();

    res.status(201).json({
      success: true,
      data: student
    });

  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* ================= PICKUP STUDENT ================= */
export const pickupStudent = async (req, res) => {
  try {
    const { childId } = req.body; // ✅ FIXED

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "childId required"
      });
    }

    const student = await Student.findById(childId); // ✅ FIXED

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    student.status = "onboard";
    student.pickupTime = new Date();
    await student.save();

    const io = req.app.get("io");

    await sendNotification({
      driverId: student.driver,
      childId: student._id,
      title: "Pickup Update",
      message: `${student.name} has been picked up`,
      type: "pickup",
      priority: "high",
      io
    });

    console.log("✅ PICKUP NOTIFICATION SENT");

    res.json({
      success: true,
      message: "Student picked up"
    });

  } catch (err) {
    console.error("❌ Pickup error:", err);
    res.status(500).json({
      success: false,
      message: "Pickup failed"
    });
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudent = async (req, res) => {
  try {
    const { childId } = req.body; // ✅ FIXED

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "childId required"
      });
    }

    const student = await Student.findById(childId); // ✅ FIXED

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    student.status = "dropped";
    student.dropTime = new Date();
    await student.save();

    const io = req.app.get("io");

    await sendNotification({
      driverId: student.driver,
      childId: student._id,
      title: "Drop Update",
      message: `${student.name} has been dropped safely`,
      type: "drop",
      priority: "high",
      io
    });

    console.log("✅ DROP NOTIFICATION SENT");

    res.json({
      success: true,
      message: "Student dropped"
    });

  } catch (err) {
    console.error("❌ Drop error:", err);
    res.status(500).json({
      success: false,
      message: "Drop failed"
    });
  }
};
