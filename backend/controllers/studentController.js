import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";

/* ================= GET ALL STUDENTS ================= */

export const getAllStudents = async (req, res) => {
  try {

    const students = await Students.find();

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

    const trip = await Trips.findOne({
      driver: req.user.id,
      status: "active"
    });

    if (!trip) {
      return res.json([]);
    }

    const students = await Students.find({
      _id: { $in: trip.students }
    });

    res.json(students);

  } catch (error) {

    console.error("Active students error:", error);

    res.status(500).json({
      message: "Failed to fetch active students"
    });

  }
};


/* ================= PICKUP STUDENT ================= */

export const pickupStudent = async (req, res) => {

  try {

    const student = await Students.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    student.status = "onboard";

    await student.save();

    res.json({
      message: "Student picked up successfully"
    });

  } catch (error) {

    console.error("Pickup error:", error);

    res.status(500).json({
      message: "Failed to pickup student"
    });

  }

};


/* ================= DROP STUDENT ================= */

export const dropStudent = async (req, res) => {

  try {

    const student = await Students.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    student.status = "dropped";

    await student.save();

    res.json({
      message: "Student dropped successfully"
    });

  } catch (error) {

    console.error("Drop error:", error);

    res.status(500).json({
      message: "Failed to drop student"
    });

  }

};


/* ================= ASSIGN STUDENT TO DRIVER ================= */

export const assignStudent = async (req, res) => {

  try {

    const { driverId, studentId } = req.body;

    const trip = await Trips.findOne({
      driver: driverId,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({
        message: "Active trip not found for driver"
      });
    }

    trip.students.push(studentId);

    await trip.save();

    res.json({
      message: "Student assigned to trip"
    });

  } catch (error) {

    console.error("Assign student error:", error);

    res.status(500).json({
      message: "Failed to assign student"
    });

  }

};


/* ================= UPDATE STUDENT LOCATION ================= */

export const updateStudentLocation = async (req, res) => {

  try {

    const { latitude, longitude } = req.body;

    const student = await Students.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    student.location = {
      type: "Point",
      coordinates: [longitude, latitude]
    };

    await student.save();

    res.json({
      message: "Student location updated"
    });

  } catch (error) {

    console.error("Update location error:", error);

    res.status(500).json({
      message: "Failed to update location"
    });

  }

};