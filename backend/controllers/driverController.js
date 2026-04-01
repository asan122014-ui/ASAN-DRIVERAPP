import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";
import Child from "../models/Child.js"; // 🔥 IMPORTANT

/* ================= GET DRIVER PROFILE ================= */
export const getDriverProfile = async (req, res) => {
  try {
    const driverId = req.params.driverId;

    const driver = await Driver.findOne({ driverId })
      .select("-password")
      .lean();

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
    const driverId = req.params.driverId;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalTrips, todayTrips, studentsAssigned] =
      await Promise.all([
        // ✅ TOTAL COMPLETED TRIPS
        Trips.countDocuments({
          driverId: driverId,
          status: "completed"
        }),

        // ✅ TODAY TRIPS
        Trips.countDocuments({
          driverId: driverId,
          createdAt: { $gte: today }
        }),

        // 🔥 FIXED: USE CHILD MODEL
        Child.countDocuments({
          driverId: driverId
        })
      ]);

    res.json({
      success: true,
      data: {
        name: driver.name,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType,
        totalTrips,
        todayTrips,
        studentsAssigned
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
    const driverId = req.params.driverId;

    const students = await Child.find({
      driverId: driverId
    }).lean();

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
    const driverId = req.params.driverId;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
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
    const driverId = req.params.driverId;

    const notifications = await Notification.find({
      driver: driverId
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
