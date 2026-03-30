import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS ================= */
export const getNotifications = async (req, res) => {
  try {
    const { driverId } = req.query;

    // ✅ Only check if exists (NOT ObjectId)
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    // ✅ Fetch using STRING driverId
    const notifications = await Notification.find({ driverId })
      .select("title message read createdAt")
      .sort({ createdAt: -1 })
      .limit(50);

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

    // ✅ Keep ObjectId validation (this is correct)
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID required"
      });
    }

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
