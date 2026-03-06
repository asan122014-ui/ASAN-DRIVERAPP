import admin from "firebase-admin";
import Notification from "../models/Notification.js";

/*
  Utility function to send notification
  Used across the system:
  - Admin approval
  - New trip assigned
  - Broadcast messages
*/

export const sendNotification = async ({
  driverId,
  title,
  message,
  fcmToken,
  io
}) => {
  try {

    /* Save notification in database */

    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    /* Send realtime socket notification */

    if (io) {
      io.to(driverId.toString()).emit("newNotification", notification);
    }

    /* Send push notification via Firebase */

    if (fcmToken) {

      const payload = {
        notification: {
          title: title,
          body: message
        },
        token: fcmToken
      };

      await admin.messaging().send(payload);
    }

    return notification;

  } catch (error) {

    console.error("Notification Error:", error);

    return null;
  }
};
