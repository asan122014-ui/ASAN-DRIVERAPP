import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import PushDelivery from "../models/PushDelivery.js";
import { wakePushDeliveryWorker } from "../jobs/deliverPushNotifications.js";

// Call after the booking transition commits; notification failure must not undo it.
export async function deliverBookingNotice(notice, io) {
  try {
    const parentRecipient = notice.recipientType === "parent";
    const recipient = parentRecipient
      ? await Parent.findById(notice.parent).select("fcmTokens")
      : await Driver.findOne({ driverId: notice.driver }).select("fcmTokens");
    const room = String(parentRecipient ? notice.parent : notice.driver);
    io?.to(room).emit("notification", notice.toObject ? notice.toObject() : notice);
    const tokens = [...new Set((recipient?.fcmTokens || []).filter((token) => typeof token === "string" && token.trim()))];
    const data = Object.fromEntries(Object.entries({
      notificationId: notice._id, notificationKey: notice.notificationKey,
      type: notice.type, recipientType: notice.recipientType,
      ...(notice.meta?.toObject ? notice.meta.toObject() : notice.meta || {}),
    }).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]));
    const jobs = [];
    for (let index = 0; index < tokens.length; index += 500) jobs.push({
      recipientType: notice.recipientType, tokens: tokens.slice(index, index + 500),
      notification: { title: notice.title, body: notice.message }, data,
    });
    if (jobs.length) { await PushDelivery.insertMany(jobs); wakePushDeliveryWorker(); }
  } catch (error) { console.error("BOOKING NOTICE DELIVERY ERROR", error.message); }
}

export async function notifyBookingStatus(details, io) {
  try {
    const notice = await Notification.create({ priority: "high", ...details });
    await deliverBookingNotice(notice, io);
  } catch (error) { console.error("BOOKING NOTICE STORAGE ERROR", error.message); }
}
