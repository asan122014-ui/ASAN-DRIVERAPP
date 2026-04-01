import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS ================= */
export const getNotifications = async (req, res) => {
  try {
    // 🔥 SUPPORT BOTH query & params
    const driverId = req.params.driverId || req.query.driverId;

    console.log("📥 Fetch notifications for:", driverId);

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

    const notifications = await Notification.find({
      driver: driverId // ✅ matches schema field
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

    const updated = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error("❌ Mark read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });
  }
};
