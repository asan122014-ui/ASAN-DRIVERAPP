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
    const notification = await Notification.create({
      driver: driverId,
      parent: null, // (optional: you can store per parent separately if needed)
      childId,
      title,
      message,
      type,
      priority,
      read: false,
    });

    console.log("✅ Notification SAVED:", notification._id);

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      // DRIVER SOCKET
      io.to(driverRoom).emit("new_notification", notification);

      // PARENT SOCKET (loop all parents)
      parents.forEach((parent) => {
        if (!parent?._id) return;

        io.to(parent._id.toString()).emit("notification", {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          childId: notification.childId,
          createdAt: notification.createdAt,
          driverId: notification.driver,
        });
      });
    }

    /* ================= FCM TOKENS ================= */
    const tokens = [];

    // collect parent tokens
    parents.forEach((p) => {
      if (p?.fcmToken) tokens.push(p.fcmToken);
    });

    // driver token (optional)
    if (driver?.fcmToken) {
      tokens.push(driver.fcmToken);
    }

    console.log("📱 FCM TOKENS:", tokens);

    /* ================= FIREBASE ================= */
    if (tokens.length > 0 && admin.apps.length) {
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
        const invalidTokens = [];

        response.responses.forEach((res, index) => {
          if (!res.success) {
            console.log("❌ Invalid token:", tokens[index]);
            invalidTokens.push(tokens[index]);
          }
        });

        if (invalidTokens.length > 0) {
          await Parent.updateMany(
            { fcmToken: { $in: invalidTokens } },
            { $unset: { fcmToken: "" } }
          );

          await Driver.updateMany(
            { fcmToken: { $in: invalidTokens } },
            { $unset: { fcmToken: "" } }
          );
        }

      } catch (err) {
        console.error("❌ Firebase error:", err.message);
      }
    } else {
      console.log("⚠️ No tokens found or Firebase not initialized");
    }

    return notification;

  } catch (error) {
    console.error("❌ sendNotification FAILED:", error.message);
    throw error;
  }
};
