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
    let parentNotifications = [];

    if (parents.length) {
      parentNotifications = await Promise.all(
        parents.map((parent) =>
          Notification.create({
            driver: driverId,
            parent: parent._id,
            child: childId || null,
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
        child: childId || null,
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
        _id: driverNotificationRecord._id,
        title: driverNotification.title,
        message: driverNotification.message,
        type,
        priority,
        child: driverNotificationRecord.child,
        recipientType: "driver",
        createdAt: driverNotificationRecord.createdAt,
      });

      // Parent socket notifications (only if parents exist)
      parentNotifications.forEach((notif) => {
        io.to(String(notif.parent)).emit("notification", {
          _id: notif._id,
          title: parentNotification.title,
          message: parentNotification.message,
          type: notif.type,
          priority: notif.priority,
          child: notif.child,
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

    // Deduplicate driver tokens using Set
    const driverTokens = [
      ...new Set(driver?.fcmTokens || [])
    ].filter((token) => token && typeof token === "string" && token.trim() !== "");

    console.log("📱 PARENT TOKENS (deduplicated):", parentTokens);
    console.log("📱 DRIVER TOKENS (deduplicated):", driverTokens);

    if (!admin.apps.length) {
      console.log("⚠️ Firebase not initialized");
      return {
        parentNotifications,
        driverNotification: driverNotificationRecord,
      };
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
    if (driverTokens.length) {
      try {
        const driverResponse = await admin.messaging().sendEachForMulticast({
          tokens: driverTokens,
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

        console.log("✅ Driver FCM sent:", driverResponse.successCount);

        /* ================= CLEAN INVALID DRIVER TOKENS ================= */
        const invalidDriverTokens = [];

        driverResponse.responses.forEach((response, index) => {
          if (!response.success) {
            console.log(
              "Driver FCM Error:",
              response.error?.code,
              response.error?.message
            );

            if (
              response.error?.code === "messaging/registration-token-not-registered" ||
              response.error?.code === "messaging/invalid-registration-token"
            ) {
              invalidDriverTokens.push(driverTokens[index]);
            }
          }
        });

        if (invalidDriverTokens.length > 0) {
          console.log("🧹 Removing invalid driver tokens:", invalidDriverTokens);

          // Use driver._id for safer matching
          await Driver.updateOne(
            { _id: driver._id },
            { $pull: { fcmTokens: { $in: invalidDriverTokens } } }
          );
        }
      } catch (err) {
        console.error("❌ Driver FCM error:", err.message);
      }
    }

    // Return both parent and driver notifications
    return {
      parentNotifications,
      driverNotification: driverNotificationRecord,
    };

  } catch (error) {
    console.error("❌ sendNotification FAILED:", error.message);
    throw error;
  }
};
