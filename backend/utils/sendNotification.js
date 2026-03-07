import Notification from "../models/Notification.js";

export const sendNotification = async ({
  driverId,
  title,
  message
}) => {
  try {

    if (!driverId || !title || !message) {
      throw new Error("Missing notification fields");
    }

    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    return notification;

  } catch (error) {

    console.error("Notification Error:", error);

    return null;

  }
};
