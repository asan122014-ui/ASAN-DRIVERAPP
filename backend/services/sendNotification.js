import admin from "firebase-admin";
import Notification from "../models/Notification.js";

/*
 Utility function to send notification

 Used across system:
 - Admin approval
 - Trip events
 - Broadcast notifications
*/

export const sendNotification = async ({
  driverId,
  title,
  message,
  fcmToken,
  io
}) => {

  try {

    /* ================= SAVE TO DATABASE ================= */

    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    /* ================= REALTIME SOCKET ================= */

    if (io && driverId) {
      io.to(driverId.toString()).emit("newNotification", notification);
    }

    /* ================= FIREBASE PUSH ================= */

    if (fcmToken && admin?.apps?.length) {

      try {

        const payload = {
          notification: {
            title,
            body: message
          },
          token: fcmToken
        };

        await admin.messaging().send(payload);

      } catch (firebaseError) {

        console.error("Firebase push error:", firebaseError);

      }

    }

    return notification;

  } catch (error) {

    console.error("Send notification error:", error);

    return null;

  }

};
