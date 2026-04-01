import Students from "../models/Students.js";
import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";

/* ================= ADD STUDENT ================= */
export const addStudent = async (req, res) => {
  try {
    const {
  name,
  age,
  school,
  grade,
  parentId,
  driverId,
  location,
  dropLocationCoords
} = req.body;

    if (!name || !parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Name, parentId, and driverId are required"
      });
    }

    const student = new Students({
  name,
  age,
  school,
  grade,
  parentId,

  // 🔥 THIS LINE FIXES EVERYTHING
  driver: driverId,

  location: {
    type: "Point",
    coordinates: [
      location?.lng || 0,
      location?.lat || 0
    ]
  },

  dropLocationCoords: {
    lat: dropLocationCoords?.lat || 0,
    lng: dropLocationCoords?.lng || 0
  }
});
    await student.save();

    res.status(201).json({
      success: true,
      data: student
    });

  } catch (error) {
    console.error("🔥 Add student error:", error);

    res.status(500).json({
      success: false,
      message: error.message
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
      driverId: driverId, // 🔥 FIXED (was driver)
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
export const pickupStudent = async (req, res) => {
  try {
    const student = await Students.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    student.status = "onboard";
    await student.save();

    res.json({
      success: true,
      message: "Student picked up successfully"
    });

  } catch (error) {
    console.error("Pickup error:", error);
    res.status(500).json({
      success: false,
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
        success: false,
        message: "Student not found"
      });
    }

    student.status = "dropped";
    await student.save();

    res.json({
      success: true,
      message: "Student dropped successfully"
    });

  } catch (error) {
    console.error("Drop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to drop student"
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
      driverId: driverId, // 🔥 FIXED
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Active trip not found"
      });
    }

    // prevent duplicates
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
