import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS ================= */
export const getNotifications = async (req, res) => {
  try {
    const { driverId } = req.query;

    console.log("📥 Fetch notifications for:", driverId);

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

    const notifications = await Notification.find({
      driver: driverId   // 🔥 MUST MATCH MODEL FIELD
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log("📊 Found notifications:", notifications.length);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error("❌ Get notifications error:", error);
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

    await Notification.findByIdAndUpdate(id, {
      read: true
    });

    res.json({
      success: true,
      message: "Marked as read"
    });

  } catch (error) {
    console.error("❌ Mark read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update"
    });
  }
};
