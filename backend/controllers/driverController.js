import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";

/* ================= GET DRIVER PROFILE ================= */

export const getDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id).select("-password");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch driver profile"
    });
  }
};

/* ================= DRIVER DASHBOARD ================= */

export const getDriverDashboard = async (req, res) => {
  try {

    const driver = await Driver.findById(req.user.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalTrips = await Trips.countDocuments({
      driver: driver._id,
      status: "completed"
    });

    const todayTrips = await Trips.countDocuments({
      driver: driver._id,
      createdAt: { $gte: today }
    });

    const studentsAssigned = await Students.countDocuments({
      driver: driver._id
    });

    res.json({
      success: true,
      data: {
        name: driver.name,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType,
        rating: driver.rating || 0,
        totalTrips,
        todayTrips,
        studentsAssigned,
        status: driver.status
      }
    });

  } catch (error) {
    console.error("Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard"
    });
  }
};

/* ================= GET ASSIGNED STUDENTS ================= */

export const getAssignedStudents = async (req, res) => {
  try {

    const students = await Students.find({
      driver: req.user.id,
      active: true
    });

    res.json({
      success: true,
      data: students
    });

  } catch (error) {

    console.error("Students Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned students"
    });

  }
};

/* ================= UPDATE DRIVER LOCATION ================= */

export const updateDriverLocation = async (req, res) => {

  try {

    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: "Point",
          coordinates: [longitude, latitude]
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      location: driver.location
    });

  } catch (error) {

    console.error("Location Update Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update driver location"
    });

  }
};

/* ================= GET DRIVER NOTIFICATIONS ================= */

export const getDriverNotifications = async (req, res) => {

  try {

    const notifications = await Notification.find({
      driver: req.user.id
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {

    console.error("Notification Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });

  }

};
