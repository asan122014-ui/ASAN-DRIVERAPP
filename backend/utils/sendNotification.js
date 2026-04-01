import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import admin from "../config/firebaseAdmin.js";
export const sendNotification = async ({
  driverId,
  title,
  message,
  io
}) => {
  try {
    console.log("🔥 sendNotification CALLED");

    if (!driverId || !title || !message) {
      throw new Error("Missing fields");
    }

    /* ================= SAVE TO DB ================= */
    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    console.log("✅ Notification SAVED:", notification._id);

    /* ================= FETCH USERS ================= */
    const parent = await Parent.findOne({ driverId });
    const driver = await Driver.findOne({ driverId });

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      // ✅ DRIVER SOCKET
      io.to(driverRoom).emit("new_notification", notification);

      // ✅ PARENT SOCKET
      if (parent?._id) {
        const parentRoom = parent._id.toString();

        io.to(parentRoom).emit("notification", {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
          driverId: notification.driver
        });
      }
    }

    /* ================= FCM TOKENS ================= */
    const tokens = [];

    if (parent?.fcmToken) {
      tokens.push(parent.fcmToken);
    }

    if (driver?.fcmToken) {
      tokens.push(driver.fcmToken);
    }

    console.log("📱 FCM TOKENS:", tokens);

    /* ================= FIREBASE ================= */
    if (tokens.length > 0 && admin.apps.length) {
      try {
        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title,
            body: message
          },
          data: {
            driverId: String(driverId),
            type: "trip_update"
          }
        });

        console.log("✅ FCM sent to all devices");

      } catch (err) {
        console.error("❌ Firebase error:", err.message);
      }
    }

    return notification;

  } catch (error) {
    console.error("❌ sendNotification FAILED:", error);
    throw error;
  }
};
