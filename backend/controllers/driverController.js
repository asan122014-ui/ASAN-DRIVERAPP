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

    const totalTrips = await Trips.countDocuments({
      driver: driver._id,
      status: "completed"
    });

    const todayTrips = await Trips.countDocuments({
      driver: driver._id,
      date: {
        $gte: new Date().setHours(0,0,0,0)
      }
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
      driver: req.user.id
    });

    res.json(students);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to fetch students"
    });

  }

};


/* ================= UPDATE DRIVER LOCATION ================= */

export const updateDriverLocation = async (req, res) => {

  try {

    const { latitude, longitude } = req.body;

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

    console.error(error);

    res.status(500).json({
      message: "Failed to update location"
    });

  }

};


/* ================= START TRIP ================= */

export const startTrip = async (req, res) => {

  try {

    const { tripType } = req.body;

    const trip = await Trips.create({
      driver: req.user.id,
      tripType,
      status: "active",
      startTime: new Date()
    });

    res.json({
      success: true,
      message: "Trip started",
      trip
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to start trip"
    });

  }

};


/* ================= END TRIP ================= */

export const endTrip = async (req, res) => {

  try {

    const trip = await Trips.findOne({
      driver: req.user.id,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({
        message: "No active trip found"
      });
    }

    trip.status = "completed";
    trip.endTime = new Date();

    await trip.save();

    res.json({
      success: true,
      message: "Trip completed",
      trip
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to end trip"
    });

  }

};


/* ================= GET DRIVER NOTIFICATIONS ================= */

export const getDriverNotifications = async (req, res) => {

  try {

    const notifications = await Notification.find({
      driver: req.user.id
    }).sort({ createdAt: -1 });

    res.json(notifications);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to fetch notifications"
    });

  }

};