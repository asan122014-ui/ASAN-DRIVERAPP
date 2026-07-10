import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import admin from "../config/firebaseAdmin.js";
import {
  PARENT_NOTIFICATIONS,
  DRIVER_NOTIFICATIONS,
} from "../utils/notificationMessages.js";

export const sendNotification = async ({
  driverId,
  childId = null,
  notificationKey,
  type = "general",
  priority = "low",
  io,
}) => {
  try {
    console.log("🔥 sendNotification CALLED");

    if (!driverId || !notificationKey) {
      throw new Error("Missing required fields: driverId and notificationKey");
    }

    /* ================= FETCH NOTIFICATION OBJECTS ================= */
    const parentNotification = PARENT_NOTIFICATIONS[notificationKey];
    const driverNotification = DRIVER_NOTIFICATIONS[notificationKey];

    if (!parentNotification || !driverNotification) {
      throw new Error(`Invalid notificationKey: ${notificationKey}`);
    }

    /* ================= DRIVER ================= */
    const driver = await Driver.findOne({ driverId }).lean();

    if (!driver) {
      throw new Error("Driver not found");
    }

    /* ================= FETCH PARENTS ================= */
    let parents = [];

    if (childId) {
      const child = await Child.findById(childId).lean();

      if (child?.parentId) {
        const parent = await Parent.findById(child.parentId).lean();
        if (parent) parents = [parent];
      }
    } else {
      parents = await Parent.find({ driverId }).lean();
    }

    console.log("👨‍👩‍👧 PARENTS FOUND:", parents.length);

    /* ================= SAVE NOTIFICATIONS FOR PARENTS ================= */
    let notifications = [];

    if (parents.length) {
      notifications = await Promise.all(
        parents.map((parent) =>
          Notification.create({
            driver: driverId,
            parent: parent._id,
            childId,
            recipientType: "parent",
            title: parentNotification.title,
            message: parentNotification.message,
            type,
            priority,
            read: false,
          })
        )
      );
    } else {
      console.log("⚠️ No parents found - skipping parent DB save");
    }

    /* ================= SAVE DRIVER NOTIFICATION ================= */
    let driverNotificationRecord = null;

    if (driverId) {
      driverNotificationRecord = await Notification.create({
        driver: driverId,
        parent: null,
        childId: childId || null,
        recipientType: "driver",
        title: driverNotification.title,
        message: driverNotification.message,
        type,
        priority,
        read: false,
      });
      console.log("✅ Driver notification saved to DB");
    }

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      // Driver socket notification (always sent)
      io.to(driverRoom).emit("notification", {
        _id: driverNotificationRecord?._id,
        title: driverNotification.title,
        message: driverNotification.message,
        type,
        priority,
        recipientType: "driver",
        createdAt: new Date(),
      });

      // Parent socket notifications (only if parents exist)
      notifications.forEach((notif) => {
        io.to(String(notif.parent)).emit("notification", {
          _id: notif._id,
          title: parentNotification.title,
          message: parentNotification.message,
          type: notif.type,
          priority: notif.priority,
          childId: notif.childId,
          recipientType: "parent",
          createdAt: notif.createdAt,
          driverId: notif.driver,
        });
      });
    }

    /* ================= TOKEN COLLECTION (DEDUPLICATED) ================= */
    // Deduplicate parent tokens using Set
    const parentTokens = [
      ...new Set(
        parents.flatMap((p) => p.fcmTokens || [])
      )
    ].filter((token) => token && typeof token === "string" && token.trim() !== "");

    const driverToken = driver?.fcmToken || null;

    console.log("📱 PARENT TOKENS (deduplicated):", parentTokens);
    console.log("📱 DRIVER TOKEN:", driverToken);

    if (!admin.apps.length) {
      console.log("⚠️ Firebase not initialized");
      return notifications;
    }

    /* ================= PARENT FCM ================= */
    if (parentTokens.length) {
      try {
        const parentResponse = await admin.messaging().sendEachForMulticast({
          tokens: parentTokens,
          notification: {
            title: parentNotification.title,
            body: parentNotification.message,
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
            childId: childId ? String(childId) : "",
            type: String(type),
            priority: String(priority),
          },
        });

        console.log("✅ Parent FCM sent:", parentResponse.successCount);
        console.log(JSON.stringify(parentResponse.responses, null, 2));

        /* ================= CLEAN INVALID PARENT TOKENS ================= */
        const invalidTokens = [];

        parentResponse.responses.forEach((response, index) => {
          if (!response.success) {
            console.log(
              "FCM Error:",
              response.error?.code,
              response.error?.message
            );

            if (
              response.error?.code === "messaging/registration-token-not-registered" ||
              response.error?.code === "messaging/invalid-registration-token"
            ) {
              invalidTokens.push(parentTokens[index]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log("🧹 Removing invalid parent tokens:", invalidTokens);

          await Parent.updateMany(
            { fcmTokens: { $in: invalidTokens } },
            { $pull: { fcmTokens: { $in: invalidTokens } } }
          );
        }
      } catch (err) {
        console.error("❌ Parent FCM error:", err.message);
      }
    }

    /* ================= DRIVER FCM ================= */
    if (driverToken) {
      try {
        await admin.messaging().send({
          token: driverToken,
          notification: {
            title: driverNotification.title,
            body: driverNotification.message,
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
            childId: childId ? String(childId) : "",
            type: String(type),
            priority: String(priority),
          },
        });

        console.log("✅ Driver FCM sent");
      } catch (err) {
        console.error("❌ Driver FCM error:", err.message);

        // Clean invalid driver token
        if (err.code === "messaging/invalid-registration-token" ||
            err.code === "messaging/registration-token-not-registered") {
          await Driver.updateOne(
            { driverId },
            { $unset: { fcmToken: "" } }
          );
        }
      }
    }

    return notifications;

  } catch (error) {
    console.error("❌ sendNotification FAILED:", error.message);
    throw error;
  }
};
