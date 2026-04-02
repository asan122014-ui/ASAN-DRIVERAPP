import Notification from "../models/Notification.js";
import admin from "../config/firebaseAdmin.js";
import Parent from "../models/Parent.js";

/* ================= GET UNREAD (BADGE) ================= */
/**
 * GET /api/notifications?driverId=XXX OR parentId=XXX OR childId=XXX
 */
export const getNotifications = async (req, res) => {
  try {
    const { driverId, parentId, childId } = req.query;

    if (!driverId && !parentId && !childId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId or childId is required",
      });
    }

    let filter = { read: false };

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;
    if (childId) filter.child = childId; // ✅ FIXED

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });

  } catch (error) {
    console.error("❌ Get notifications error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/* ================= GET ALL (HISTORY) ================= */
/**
 * GET /api/notifications/all?driverId=XXX OR parentId=XXX OR childId=XXX
 */
export const getAllNotifications = async (req, res) => {
  try {
    const { driverId, parentId, childId, type, priority } = req.query;

    if (!driverId && !parentId && !childId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId or childId is required",
      });
    }

    let filter = {};

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;
    if (childId) filter.child = childId; // ✅ FIXED
    if (type) filter.type = type;
    if (priority) filter.priority = priority;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: notifications,
    });

  } catch (error) {
    console.error("❌ Get all notifications error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/* ================= 🔥 NEW: PARENT NOTIFICATIONS ================= */
/**
 * GET /api/notifications/parent/:parentId
 */
export const getParentNotifications = async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    const notifications = await Notification.find({ parent: parentId })
      .sort({ createdAt: -1 })
      .populate("child", "name") // optional
      .lean();

    return res.json({
      success: true,
      data: notifications,
    });

  } catch (error) {
    console.error("❌ Parent notifications error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch parent notifications",
    });
  }
};

/* ================= MARK SINGLE ================= */
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

    return res.json({
      success: true,
      data: updated,
    });

  } catch (error) {
    console.error("❌ Mark read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

/* ================= MARK ALL ================= */
/**
 * PUT /api/notifications/read-all?driverId=XXX OR parentId=XXX OR childId=XXX
 */
export const markAllAsRead = async (req, res) => {
  try {
    const { driverId, parentId, childId } = req.query;

    if (!driverId && !parentId && !childId) {
      return res.status(400).json({
        success: false,
        message: "driverId or parentId or childId is required",
      });
    }

    let filter = { read: false };

    if (driverId) filter.driver = driverId;
    if (parentId) filter.parent = parentId;
    if (childId) filter.child = childId; // ✅ FIXED

    await Notification.updateMany(filter, { read: true });

    return res.json({
      success: true,
      message: "All notifications marked as read",
    });

  } catch (error) {
    console.error("❌ Mark all read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};

/* ================= TEST FCM ================= */
/**
 * POST /api/notifications/test
 * body: { parentId }
 */
export const sendTestNotification = async (req, res) => {
  try {
    const { parentId } = req.body;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "parentId is required",
      });
    }

    const parent = await Parent.findById(parentId);

    if (!parent?.fcmToken) {
      return res.status(400).json({
        success: false,
        message: "FCM token not found",
      });
    }

    const message = {
      token: parent.fcmToken,
      notification: {
        title: "Test Notification 🚀",
        body: "FCM is working properly!",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      data: {
        type: "test",
      },
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Firebase response:", response);

    return res.json({
      success: true,
      message: "Notification sent successfully",
    });

  } catch (err) {
    console.error("❌ FCM ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send notification",
    });
  }
};
