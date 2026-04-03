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
    const driver = await Driver.findOne({ driverId }).select("+fcmToken");

    /* ================= FETCH PARENTS (🔥 FIX HERE) ================= */
    let parents = [];

    if (childId) {
      const child = await Child.findById(childId);

      if (!child) {
        console.log("❌ Child not found");
        return [];
      }

      if (child.parentId) {
        const parent = await Parent.findById(child.parentId)
          .select("+fcmToken +fcmTokens");

        if (parent) parents = [parent];
      }
    } else {
      parents = await Parent.find({ driverId })
        .select("+fcmToken +fcmTokens"); // ✅ CRITICAL FIX
    }

    console.log("👨‍👩‍👧 PARENTS FOUND:", parents.length);

    parents.forEach(p => {
      console.log("🔍 DEBUG TOKEN:", p.fcmToken, p.fcmTokens);
    });

    if (parents.length === 0) {
      console.log("❌ No parents found → skipped");
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

    /* ================= SOCKET.IO ================= */
    if (io) {
      const driverRoom = String(driverId);

      if (notifications[0]) {
        io.to(driverRoom).emit("new_notification", notifications[0]);
      }

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

    /* ================= TOKEN COLLECTION (🔥 FINAL FIX) ================= */
    const tokenSet = new Set();

    parents.forEach((p) => {
      // ✅ SINGLE TOKEN
      if (
        p.fcmToken &&
        typeof p.fcmToken === "string" &&
        p.fcmToken.trim() !== ""
      ) {
        tokenSet.add(p.fcmToken.trim());
      }

      // ✅ MULTIPLE TOKENS
      if (Array.isArray(p.fcmTokens)) {
        p.fcmTokens.forEach((t) => {
          if (t && typeof t === "string" && t.trim() !== "") {
            tokenSet.add(t.trim());
          }
        });
      }
    });

    // ✅ DRIVER TOKEN
    if (
      driver?.fcmToken &&
      typeof driver.fcmToken === "string" &&
      driver.fcmToken.trim() !== ""
    ) {
      tokenSet.add(driver.fcmToken.trim());
    }

    const tokens = [...tokenSet];

    console.log("📱 FINAL TOKENS:", tokens);

    /* ================= FCM SEND ================= */
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

      /* ================= CLEAN INVALID TOKENS ================= */
      const invalidTokens = tokens.filter(
        (_, i) => !response.responses[i].success
      );

      if (invalidTokens.length > 0) {
        console.log("🧹 Removing invalid tokens:", invalidTokens);

        await Promise.all([
          Parent.updateMany(
            { fcmTokens: { $in: invalidTokens } },
            { $pull: { fcmTokens: { $in: invalidTokens } } }
          ),
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
