import Students from "../models/Students.js";
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
/* ================= GET ALL STUDENTS ================= */
export const getAllStudents = async (req, res) => {
  try {
    const students = await Students.find().lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error("Fetch students error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch students"
    });
  }
};

/* ================= GET ACTIVE TRIP STUDENTS ================= */
export const getActiveStudents = async (req, res) => {
  try {
    const driverId = req.params.driverId;

    const trip = await Trips.findOne({
      driverId,
      status: "active"
    });

    if (!trip) {
      return res.json({
        success: true,
        data: []
      });
    }

    const students = await Students.find({
      _id: { $in: trip.students }
    }).lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error("Active students error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active students"
    });
  }
};

/* ================= PICKUP STUDENT ================= */
import { sendNotification } from "../utils/sendNotification.js";

export const pickupStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

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
      message: "Your child has been picked up",
      type: "pickup",
      priority: "high",
      io
    });

    res.json({
      success: true,
      message: "Student picked up"
    });

  } catch (err) {
    console.error("Pickup error:", err);
    res.status(500).json({
      success: false,
      message: "Pickup failed"
    });
  }
};

/* ================= DROP STUDENT ================= */
export const dropStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

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
      message: "Your child has been dropped safely",
      type: "drop",
      priority: "high",
      io
    });

    res.json({
      success: true,
      message: "Student dropped"
    });

  } catch (err) {
    console.error("Drop error:", err);
    res.status(500).json({
      success: false,
      message: "Drop failed"
    });
  }
};

/* ================= ASSIGN STUDENT TO TRIP ================= */
export const assignStudent = async (req, res) => {
  try {
    const { driverId, studentId } = req.body;

    if (!driverId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "driverId and studentId are required"
      });
    }

    const trip = await Trips.findOne({
      driverId,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Active trip not found"
      });
    }

    if (!trip.students.includes(studentId)) {
      trip.students.push(studentId);
      await trip.save();
    }

    res.json({
      success: true,
      message: "Student assigned to trip"
    });

  } catch (error) {
    console.error("Assign student error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign student"
    });
  }
};

/* ================= UPDATE STUDENT LOCATION ================= */
export const updateStudentLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const student = await Students.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    student.location = {
      type: "Point",
      coordinates: [longitude, latitude]
    };

    await student.save();

    res.json({
      success: true,
      message: "Student location updated"
    });

  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update location"
    });
  }
};
