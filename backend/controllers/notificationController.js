import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS ================= */
export const getNotifications = async (req, res) => {
  try {
    const { driverId } = req.query; // ✅ IMPORTANT FIX

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

    const notifications = await Notification.find({ driverId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error("Get notifications error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });
  }
};

/* ================= MARK AS READ ================= */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error("Mark as read error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });
  }
};
