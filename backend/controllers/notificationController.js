import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS (UNREAD ONLY) ================= */
export const getNotifications = async (req, res) => {
  try {
    // ✅ SUPPORT BOTH PARAMS & QUERY
    const driverId = req.params.driverId || req.query.driverId;

    console.log("📥 Fetch notifications for:", driverId);

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

    // 🔥 ONLY UNREAD (FOR BADGE)
    const notifications = await Notification.find({
      driver: driverId,
      read: false
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log("📊 Found unread notifications:", notifications.length);

    res.json({
      success: true,
      count: notifications.length, // ✅ helpful for badge
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

/* ================= GET ALL NOTIFICATIONS (OPTIONAL HISTORY) ================= */
export const getAllNotifications = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.query.driverId;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

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
    console.error("❌ Get all notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });
  }
};

/* ================= MARK SINGLE AS READ ================= */
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

/* ================= MARK ALL AS READ (🔥 BEST PRACTICE) ================= */
export const markAllAsRead = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.query.driverId;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required"
      });
    }

    await Notification.updateMany(
      { driver: driverId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read"
    });

  } catch (error) {
    console.error("❌ Mark all read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notifications"
    });
  }
};
