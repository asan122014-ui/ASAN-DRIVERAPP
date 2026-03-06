import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";
import admin from "firebase-admin";

/* ================= DASHBOARD STATS ================= */

export const getDashboardStats = async (req, res) => {

  try {

    const totalDrivers = await Driver.countDocuments();
    const approvedDrivers = await Driver.countDocuments({ status: "approved" });
    const pendingDrivers = await Driver.countDocuments({ status: "pending" });

    const totalStudents = await Students.countDocuments();

    const activeTrips = await Trips.countDocuments({ status: "active" });
    const completedTrips = await Trips.countDocuments({ status: "completed" });

    res.json({
      totalDrivers,
      approvedDrivers,
      pendingDrivers,
      totalStudents,
      activeTrips,
      completedTrips
    });

  } catch (error) {

    console.error("Dashboard Error:", error);

    res.status(500).json({
      message: "Failed to fetch dashboard statistics"
    });

  }

};


/* ================= GET ALL DRIVERS ================= */

export const getDrivers = async (req, res) => {

  try {

    const drivers = await Driver.find().select("-password");

    res.json(drivers);

  } catch (error) {

    console.error(error);

    res.status(500).json({
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
        message: "Driver not found"
      });
    }

    driver.status = "approved";
    await driver.save();

    /* Save notification in database */

    await Notification.create({
      driver: driver._id,
      title: "Account Approved",
      message: "Your driver account has been approved"
    });

    /* Send push notification */

    if (driver.fcmToken) {

      await admin.messaging().send({
        notification: {
          title: "Account Approved",
          body: "Your driver account has been approved. You can start trips."
        },
        token: driver.fcmToken
      });

    }

    res.json({
      message: "Driver approved successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
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
        message: "Driver not found"
      });
    }

    driver.status = "rejected";

    await driver.save();

    res.json({
      message: "Driver rejected successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to reject driver"
    });

  }

};


/* ================= GET ALL STUDENTS ================= */

export const getStudents = async (req, res) => {

  try {

    const students = await Students.find();

    res.json(students);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to fetch students"
    });

  }

};


/* ================= BROADCAST NOTIFICATION ================= */

export const broadcastNotification = async (req, res) => {

  try {

    const { title, message } = req.body;

    const drivers = await Driver.find({ status: "approved" });

    for (const driver of drivers) {

      /* Save notification */

      await Notification.create({
        driver: driver._id,
        title,
        message
      });

      /* Push notification */

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
      message: "Notification sent to all drivers"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to send notifications"
    });

  }

};
