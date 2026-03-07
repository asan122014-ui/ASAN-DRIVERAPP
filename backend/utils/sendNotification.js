import Notification from "../models/Notification.js";

export const sendNotification = async ({
  driverId,
  title,
  message
}) => {
  try {

    const notification = await Notification.create({
      driver: driverId,
      title,
      message
    });

    return notification;

  } catch (error) {

    console.error("Notification Error:", error);
    return null;

  }
};