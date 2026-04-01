import Notification from "../models/Notification.js";

/* ================= GET NOTIFICATIONS (UNREAD ONLY) ================= */
/**
 * GET /api/notifications?driverId=XXX OR parentId=XXX
 */
export const getNotifications = async (req, res) => {
  try {
    const { driverId, parentId } = req.query;

    if (!driverId && !parentId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId is required",
      });
    }

    // ✅ Dynamic filter
    let filter = { read: false };

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });

  } catch (error) {
    console.error("❌ Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/* ================= GET ALL NOTIFICATIONS ================= */
/**
 * GET /api/notifications/all?driverId=XXX OR parentId=XXX
 */
export const getAllNotifications = async (req, res) => {
  try {
    const { driverId, parentId } = req.query;

    if (!driverId && !parentId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId is required",
      });
    }

    let filter = {};

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: notifications,
    });

  } catch (error) {
    console.error("❌ Get all notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/* ================= MARK SINGLE AS READ ================= */
/**
 * PUT /api/notifications/:id/read
 */
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
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      data: updated,
    });

  } catch (error) {
    console.error("❌ Mark read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

/* ================= MARK ALL AS READ ================= */
/**
 * PUT /api/notifications/read-all?driverId=XXX OR parentId=XXX
 */
export const markAllAsRead = async (req, res) => {
  try {
    const { driverId, parentId } = req.query;

    if (!driverId && !parentId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId is required",
      });
    }

    let filter = { read: false };

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;

    await Notification.updateMany(filter, { read: true });

    res.json({
      success: true,
      message: "All notifications marked as read",
    });

  } catch (error) {
    console.error("❌ Mark all read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};
