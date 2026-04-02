import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import admin from "../config/firebaseAdmin.js";

export const sendNotification = async ({
  driverId,
  childId = null,
  title,
  message,
  type = "general",
  priority = "low",
  io,
}) => {
  try {
    console.log("🔥 sendNotification CALLED");

    if (!driverId || !title || !message) {
      throw new Error("Missing fields");
    }

    /* ================= FETCH USERS ================= */
    const parents = await Parent.find({ driverId });
    const driver = await Driver.findOne({ driverId });

    /* ================= SAVE TO DB ================= */
    // 🔥 PRO VERSION: save per parent (better filtering)
    const notifications = [];

    for (const parent of parents) {
      const notif = await Notification.create({
        driver: driverId,
        parent: parent._id, // ✅ important
        childId,
        title,
        message,
        type,
        priority,
        read: false,
      });

      notifications.push(notif);
    }

    console.log("✅ Notifications saved:", notifications.length);

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      // DRIVER
      io.to(driverRoom).emit("new_notification", notifications[0]);

      // PARENTS
      notifications.forEach((notif) => {
        if (!notif.parent) return;

        io.to(notif.parent.toString()).emit("notification", {
          _id: notif._id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          priority: notif.priority,
          childId: notif.childId,
          createdAt: notif.createdAt,
          driverId: notif.driver,
        });
      });
    }

    /* ================= FCM TOKENS ================= */
    const tokenSet = new Set();

    parents.forEach((p) => {
      if (p?.fcmToken) tokenSet.add(p.fcmToken);
    });

    if (driver?.fcmToken) {
      tokenSet.add(driver.fcmToken);
    }

    const tokens = Array.from(tokenSet); // ✅ remove duplicates

    console.log("📱 FCM TOKENS:", tokens);

    /* ================= FIREBASE ================= */
    if (!admin.apps.length) {
      console.log("⚠️ Firebase not initialized");
      return notifications;
    }

    if (tokens.length === 0) {
      console.log("⚠️ No tokens found");
      return notifications;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title,
          body: message,
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
          driverId: String(driverId),
          childId: childId || "",
          type,
          priority,
        },
      });

      console.log("✅ FCM sent:", response.successCount);

      /* ================= CLEAN INVALID TOKENS ================= */
      const invalidTokens = tokens.filter(
        (_, i) => !response.responses[i].success
      );

      if (invalidTokens.length > 0) {
        console.log("🧹 Cleaning invalid tokens:", invalidTokens.length);

        await Promise.all([
          Parent.updateMany(
            { fcmToken: { $in: invalidTokens } },
            { $unset: { fcmToken: "" } }
          ),
          Driver.updateMany(
            { fcmToken: { $in: invalidTokens } },
            { $unset: { fcmToken: "" } }
          ),
        ]);
      }
    } catch (err) {
      console.error("❌ Firebase error:", err.message);
    }

    return notifications;
  } catch (error) {
    console.error("❌ sendNotification FAILED:", error.message);
    throw error;
  }
};
