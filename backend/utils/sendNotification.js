import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
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

    /* ================= FETCH DRIVER ================= */
    const driver = await Driver.findOne({ driverId });

    /* ================= FETCH PARENTS ================= */
    let parents = [];

    if (childId) {
      const child = await Child.findById(childId);

      if (!child) {
        console.log("❌ Child not found");
        return [];
      }

      if (child.parentId) {
        const parent = await Parent.findById(child.parentId)
          .select("fcmTokens");

        if (parent) parents = [parent];
      }
    } else {
      parents = await Parent.find({ driverId })
        .select("fcmTokens"); // ✅ ONLY ARRAY
    }

    console.log("👨‍👩‍👧 PARENTS FOUND:", parents.length);

    if (!parents.length) {
      console.log("❌ No parents → skipped");
      return [];
    }

    /* ================= SAVE TO DB ================= */
    const notifications = await Promise.all(
      parents.map((parent) =>
        Notification.create({
          driver: driverId,
          parent: parent._id,
          childId,
          title,
          message,
          type,
          priority,
          read: false,
        })
      )
    );

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      io.to(driverRoom).emit("new_notification", notifications[0]);

      notifications.forEach((notif) => {
        io.to(notif.parent.toString()).emit("notification", {
          ...notif._doc,
          driverId: notif.driver,
        });
      });
    }

    /* ================= TOKEN COLLECTION (ARRAY ONLY) ================= */
    const tokenSet = new Set();

    parents.forEach((p) => {
      if (Array.isArray(p.fcmTokens)) {
        p.fcmTokens.forEach((t) => {
          if (t && typeof t === "string" && t.trim() !== "") {
            tokenSet.add(t.trim());
          }
        });
      }
    });

    const tokens = [...tokenSet];

    console.log("📱 FINAL TOKENS:", tokens);

    /* ================= FCM ================= */
    if (!admin.apps.length) {
      console.log("⚠️ Firebase not initialized");
      return notifications;
    }

    if (!tokens.length) {
      console.log("❌ No tokens → FCM skipped");
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
          notification: { sound: "default" },
        },
        apns: {
          payload: {
            aps: { sound: "default" },
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

      /* ================= CLEAN INVALID ================= */
      const invalidTokens = tokens.filter(
        (_, i) => !response.responses[i].success
      );

      if (invalidTokens.length) {
        console.log("🧹 Removing invalid:", invalidTokens);

        await Parent.updateMany(
          { fcmTokens: { $in: invalidTokens } },
          { $pull: { fcmTokens: { $in: invalidTokens } } }
        );
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
