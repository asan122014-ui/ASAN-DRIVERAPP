import Notification from "../models/Notification.js";

/* ================= GET DRIVER NOTIFICATIONS ================= */

export const getNotifications = async (req, res) => {
  try {

    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const notifications = await Notification
      .find({ driver: driverId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {

    console.error("GET NOTIFICATIONS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });

  }
};


/* ================= MARK NOTIFICATION AS READ ================= */

export const markAsRead = async (req, res) => {
  try {

    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    notification.read = true;

    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read"
    });

  } catch (error) {

    console.error("MARK AS READ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });

  }
};
