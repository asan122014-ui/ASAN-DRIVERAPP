import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";
import admin from "firebase-admin";

/* ================= DASHBOARD STATS ================= */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalDrivers,
      approvedDrivers,
      pendingDrivers,
      totalStudents,
      activeTrips,
      completedTrips
    ] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ status: "approved" }),
      Driver.countDocuments({ status: "pending" }),
      Students.countDocuments(),
      Trips.countDocuments({ status: "active" }),
      Trips.countDocuments({ status: "completed" })
    ]);

    res.json({
      success: true,
      data: {
        totalDrivers,
        approvedDrivers,
        pendingDrivers,
        totalStudents,
        activeTrips,
        completedTrips
      }
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
};

/* ================= GET ALL DRIVERS ================= */
export const getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().select("-password").lean();

    res.json({
      success: true,
      data: drivers
    });

  } catch (error) {
    console.error("Get Drivers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers"
    });
  }
};

/* ================= APPROVE DRIVER ================= */
export const approveDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    driver.status = "approved";
    await driver.save();

    // Save notification
    await Notification.create({
      driver: driver._id,
      title: "Account Approved",
      message: "Your driver account has been approved"
    });

    // Push notification (safe check)
    if (driver.fcmToken) {
      await admin.messaging().send({
        notification: {
          title: "Account Approved",
          body: "Your account has been approved. You can start trips."
        },
        token: driver.fcmToken
      });
    }

    res.json({
      success: true,
      message: "Driver approved successfully"
    });

  } catch (error) {
    console.error("Approve Driver Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve driver"
    });
  }
};

/* ================= REJECT DRIVER ================= */
export const rejectDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    driver.status = "rejected";
    await driver.save();

    res.json({
      success: true,
      message: "Driver rejected successfully"
    });

  } catch (error) {
    console.error("Reject Driver Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject driver"
    });
  }
};

/* ================= GET ALL STUDENTS ================= */
export const getStudents = async (req, res) => {
  try {
    const students = await Students.find().lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error("Get Students Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch students"
    });
  }
};

/* ================= BROADCAST NOTIFICATION ================= */
export const broadcastNotification = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    const drivers = await Driver.find({ status: "approved" });

    for (const driver of drivers) {
      // Save notification
      await Notification.create({
        driver: driver._id,
        title,
        message
      });

      // Push notification
      if (driver.fcmToken) {
        await admin.messaging().send({
          notification: {
            title,
            body: message
          },
          token: driver.fcmToken
        });
      }
    }

    res.json({
      success: true,
      message: "Notification sent to all drivers"
    });

  } catch (error) {
    console.error("Broadcast Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notifications"
    });
  }
};
