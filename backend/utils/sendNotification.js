import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import admin from "../config/firebaseAdmin.js";

export const sendNotification = async ({
  driverId,
  title,
  message,
  io,
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
      read: false,
    });

    console.log("✅ Notification SAVED:", notification._id);

    /* ================= FETCH USERS ================= */

    // ✅ MULTIPLE parents support (IMPORTANT FIX)
    const parents = await Parent.find({ driverId });
    const driver = await Driver.findOne({ driverId });

    /* ================= SOCKET ================= */

    if (io) {
      const driverRoom = String(driverId);

      // ✅ DRIVER SOCKET
      io.to(driverRoom).emit("new_notification", notification);

      // ✅ PARENT SOCKET (send individually)
      for (const parent of parents) {
        if (!parent?._id) continue;

        const parentRoom = parent._id.toString();

        io.to(parentRoom).emit("notification", {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
          driverId: notification.driver,
        });
      }
    }

    /* ================= FCM TOKENS ================= */

    const tokens = [];

    // ✅ collect all parent tokens
    parents.forEach((p) => {
      if (p?.fcmToken) tokens.push(p.fcmToken);
    });

    // ✅ driver token (optional)
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
          data: {
            driverId: String(driverId),
            type: "trip_update",
          },
        });

        console.log("✅ FCM sent:", response.successCount);

        /* ================= CLEAN INVALID TOKENS ================= */

        response.responses.forEach(async (res, index) => {
          if (!res.success) {
            console.log("❌ Invalid token:", tokens[index]);

            // OPTIONAL: remove invalid token from DB
            await Parent.updateMany(
              { fcmToken: tokens[index] },
              { $unset: { fcmToken: "" } }
            );

            await Driver.updateMany(
              { fcmToken: tokens[index] },
              { $unset: { fcmToken: "" } }
            );
          }
        });

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
