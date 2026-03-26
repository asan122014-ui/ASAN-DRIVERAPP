import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    const notifications = await Notification.find({ driverId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: notifications
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
