import mongoose from "mongoose";
import { assertAdminOfferAllowed } from "./adminBookingOfferPolicy.js";
import PushDelivery from "../models/PushDelivery.js";
import { wakePushDeliveryWorker } from "../jobs/deliverPushNotifications.js";
import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import DriverRequest from "../models/DriverRequest.js";
import Notification from "../models/Notification.js";

const normalizeDriverId = (value) => String(value || "").trim().toUpperCase();

const notifyDriver = async ({ driver, request, booking, child, io }) => {
  const bookingChildren = booking.children?.length ? booking.children : [child || booking.child];
  const childNames = bookingChildren.map((item) => item?.name).filter(Boolean).join(", ") || "the child";
  const firstChild = bookingChildren[0] || booking.child;
  const children = bookingChildren.map(({ name, school, grade, age }) => ({ name, school, grade, age }));
  const monthlyRouteAmount = Number(booking.quote.distanceCharge || 0);
  const workingDays = Number(booking.quote.workingDays || 26);
  const dailyDistanceCharge = Number(booking.quote.dailyDistanceCharge ?? (monthlyRouteAmount / workingDays));
  const message = `New ASAN ride request for ${childNames}. Monthly route amount ₹${monthlyRouteAmount.toLocaleString("en-IN")} (distance charges only).`;
  let notificationId;
  try {
    const notification = await Notification.create({
      driver: normalizeDriverId(driver.driverId),
      recipientType: "driver",
      notificationKey: "BOOKING_DRIVER_OFFER",
      title: "New ride request",
      message,
      type: "general",
      priority: "high",
      meta: { requestId: String(request._id), bookingId: String(booking._id), monthlyRouteAmount, dailyDistanceCharge, workingDays, amountBasis: "distance_charges_only", expiresAt: request.offerExpiresAt },
    });
    notificationId = String(notification._id);
  } catch (error) {
    // Notification storage is secondary; the live offer and polling API must still work.
    console.error("BOOKING OFFER NOTIFICATION PERSISTENCE ERROR", error.message);
  }
  const tokens = [...new Set((driver.fcmTokens || []).filter((token) => typeof token === "string" && token.trim()))];
  if (tokens.length) {
    const deliveries = [];
    for (let index = 0; index < tokens.length; index += 500) deliveries.push({ recipientType: "driver", tokens: tokens.slice(index, index + 500), notification: { title: "New ride request", body: message }, data: { requestId: String(request._id), bookingId: String(booking._id), notificationKey: "BOOKING_DRIVER_OFFER", driverId: normalizeDriverId(driver.driverId), type: "general", priority: "high" } });
    try {
      await PushDelivery.insertMany(deliveries);
      wakePushDeliveryWorker();
    } catch (error) {
      console.error("BOOKING OFFER PUSH QUEUE ERROR", error.message);
    }
  }
  io?.to(normalizeDriverId(driver.driverId)).emit("booking_driver_offer", {
    requestId: String(request._id),
    bookingId: String(booking._id),
    child: { name: childNames, school: firstChild?.school || child?.school || booking.child.school, grade: firstChild?.grade || child?.grade || booking.child.grade || "" },
    children,
    childCount: children.length,
    route: {
      pickup: booking.route.pickup,
      dropoff: booking.route.dropoff,
      distanceKm: booking.route.distanceKm,
      durationMinutes: booking.route.durationMinutes,
      pickupTime: booking.route.pickupTime,
      schoolPickupTime: booking.route.schoolPickupTime,
    },
    vehicleType: booking.quote?.vehicleType,
    childName: childNames,
    school: firstChild?.school || child?.school || booking.child.school,
    pickup: booking.route.pickup,
    dropoff: booking.route.dropoff,
    distanceKm: booking.route.distanceKm,
    durationMinutes: booking.route.durationMinutes,
    pickupTime: booking.route.pickupTime,
    schoolPickupTime: booking.route.schoolPickupTime,
    monthlyRouteAmount,
    dailyDistanceCharge,
    workingDays,
    startDate: booking.startDate,
    expiresAt: request.offerExpiresAt,
    createdAt: request.createdAt,
    ...(notificationId ? { notificationId } : {}),
  });
};

export const dispatchNextOfferBatch = async ({ requestId, io }) => {
  const request = await DriverRequest.findById(requestId);
  if (!request || request.status !== "Pending" || request.matchingStatus === "Accepted") return { request, offersSent: 0 };
  if (request.matchingStatus === "Offered" && (!request.offerExpiresAt || request.offerExpiresAt.getTime() > Date.now())) {
    return { request, offersSent: (request.currentOfferDriverIds || []).length };
  }
  if (request.matchingStatus === "Offered") {
    if (request.requestType === "existing_driver") {
      request.offerExpiresAt = null;
      await request.save();
      return { request, offersSent: (request.currentOfferDriverIds || []).length };
    }
    request.rejectedDriverIds = [...new Set([...(request.rejectedDriverIds || []), ...(request.currentOfferDriverIds || [])])];
    request.currentOfferDriverIds = [];
    request.matchingStatus = "Searching";
  }
  const booking = await Booking.findById(request.bookingId);
  if (!booking) throw new Error("Booking linked to this request was not found");
  const child = request.childId ? await Child.findById(request.childId).select("name school") : null;

  if (request.requestType === "existing_driver") {
    if ((request.rejectedDriverIds || []).includes(normalizeDriverId(request.requestedDriverId))) {
      request.matchingStatus = "Exhausted";
      request.currentOfferDriverIds = [];
      request.offerExpiresAt = null;
      request.rejectionReason = "The selected driver declined or did not respond to the request.";
      await request.save();
      return { request, offersSent: 0 };
    }
    const driver = await Driver.findOne({ driverId: normalizeDriverId(request.requestedDriverId), status: "approved" });
    if (!driver) {
      request.matchingStatus = "Exhausted";
      request.rejectionReason = "The selected driver is no longer available.";
      await request.save();
      return { request, offersSent: 0 };
    }
    request.matchingStatus = "Offered";
    request.offeredDriverIds = [driver.driverId];
    request.currentOfferDriverIds = [driver.driverId];
    // A direct request stays available until this specific driver accepts or declines.
    request.offerExpiresAt = null;
    await request.save();
    await notifyDriver({ driver, request, booking, child, io });
    return { request, offersSent: 1 };
  }

  // Parents requesting a new driver wait for an administrator to select one.
  request.matchingStatus = "Searching";
  request.currentOfferDriverIds = [];
  request.offerExpiresAt = null;
  request.rejectionReason = "Waiting for the institute to assign a driver.";
  await request.save();
  return { request, offersSent: 0 };

};

export async function dispatchSelectedDriverOffer({ requestId, driverId, io }) {
  const normalizedId = normalizeDriverId(driverId);
  if (!normalizedId) { const error = new Error("Choose a driver"); error.statusCode = 400; throw error; }
  const driver = await Driver.findOne({ driverId: normalizedId, status: "approved" });
  const session = await mongoose.startSession();
  let offered, booking, child;
  try {
    await session.withTransaction(async () => {
      const request = await DriverRequest.findById(requestId).session(session);
      booking = request?.bookingId ? await Booking.findById(request.bookingId).session(session) : null;
      assertAdminOfferAllowed(request, booking, driver);
      offered = await DriverRequest.findOneAndUpdate(
        { _id: request._id, status: "Pending", matchingStatus: { $ne: "Offered" } },
        { $set: { matchingStatus: "Offered", currentOfferDriverIds: [normalizedId], offerExpiresAt: null, rejectionReason: "", respondedAt: null }, $addToSet: { offeredDriverIds: normalizedId } },
        { new: true, session }
      );
      if (!offered) { const error = new Error("This request has already changed. Refresh and try again."); error.statusCode = 409; throw error; }
      booking.status = "driver_searching";
      await booking.save({ session });
    });
  } finally { await session.endSession(); }
  child = offered.childId ? await Child.findById(offered.childId).select("name school grade") : null;
  await notifyDriver({ driver, request: offered, booking, child, io });
  const payload = { requestId: String(offered._id), bookingId: String(booking._id), driverIds: [normalizedId] };
  io?.to("admin").emit("booking_matching_offers_sent", payload);
  return { request: offered, offersSent: 1 };
}
