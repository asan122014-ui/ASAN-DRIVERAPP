import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import DriverRequest from "../models/DriverRequest.js";
import Notification from "../models/Notification.js";

const OFFER_BATCH_SIZE = 3;
const OFFER_TTL_MS = 5 * 60 * 1000;

const normalizeDriverId = (value) => String(value || "").trim().toUpperCase();

const getDriverCoordinates = (driver) => {
  const live = driver.location?.coordinates;
  if (Array.isArray(live) && live.length === 2) return { lat: Number(live[1]), lng: Number(live[0]) };
  const home = driver.homeLocation?.coordinates;
  if (Array.isArray(home) && home.length === 2) return { lat: Number(home[1]), lng: Number(home[0]) };
  return null;
};

const haversineKm = (a, b) => {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const notifyDriver = async ({ driver, request, booking, child, io }) => {
  const message = `New ASAN ride request for ${child?.name || booking.child.name}. Monthly price ₹${Number(booking.quote.totalMonthly).toLocaleString("en-IN")}.`;
  const notification = await Notification.create({
    driver: driver.driverId,
    recipientType: "driver",
    notificationKey: "BOOKING_DRIVER_OFFER",
    title: "New ride request",
    message,
    type: "general",
    priority: "high",
    meta: { requestId: String(request._id), bookingId: String(booking._id), monthlyPrice: booking.quote.totalMonthly, expiresAt: request.offerExpiresAt },
  });
  io?.to(driver.driverId).emit("booking_driver_offer", {
    requestId: String(request._id),
    bookingId: String(booking._id),
    childName: child?.name || booking.child.name,
    school: child?.school || booking.child.school,
    pickup: booking.route.pickup,
    dropoff: booking.route.dropoff,
    distanceKm: booking.route.distanceKm,
    monthlyPrice: booking.quote.totalMonthly,
    expiresAt: request.offerExpiresAt,
    notificationId: String(notification._id),
  });
};

export const dispatchNextOfferBatch = async ({ requestId, io }) => {
  const request = await DriverRequest.findById(requestId);
  if (!request || request.status !== "Pending" || request.matchingStatus === "Accepted") return { request, offersSent: 0 };
  if (request.matchingStatus === "Offered" && request.offerExpiresAt?.getTime() > Date.now()) return { request, offersSent: 0 };
  if (request.matchingStatus === "Offered") {
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
    request.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
    await request.save();
    await notifyDriver({ driver, request, booking, child, io });
    return { request, offersSent: 1 };
  }

  const pickup = booking.route?.pickupCoordinates;
  const origin = { lat: Number(pickup?.lat), lng: Number(pickup?.lng) };
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    request.matchingStatus = "Exhausted";
    request.rejectionReason = "Pickup map coordinates are missing; administrator review is required.";
    await request.save();
    return { request, offersSent: 0 };
  }

  const excluded = new Set([...(request.offeredDriverIds || []), ...(request.rejectedDriverIds || [])].map(normalizeDriverId));
  const available = await Driver.find({ status: "approved", isOnline: true, currentStatus: "idle" }).select("name driverId phone vehicleNumber vehicleType location homeLocation");
  const candidates = available
    .map((driver) => {
      const point = getDriverCoordinates(driver);
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
      return { driver, distanceKm: haversineKm(origin, point) };
    })
    .filter((candidate) => candidate && !excluded.has(normalizeDriverId(candidate.driver.driverId)))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, OFFER_BATCH_SIZE);

  if (!candidates.length) {
    request.matchingStatus = "Exhausted";
    request.currentOfferDriverIds = [];
    request.offerExpiresAt = null;
    request.rejectionReason = "No eligible nearby drivers are available yet.";
    await request.save();
    io?.to("admin").emit("booking_matching_exhausted", { requestId: String(request._id), bookingId: String(booking._id) });
    return { request, offersSent: 0 };
  }

  const driverIds = candidates.map(({ driver }) => normalizeDriverId(driver.driverId));
  request.matchingStatus = "Offered";
  request.offeredDriverIds = [...new Set([...(request.offeredDriverIds || []), ...driverIds])];
  request.currentOfferDriverIds = driverIds;
  request.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
  request.rejectionReason = "";
  await request.save();

  await Promise.all(candidates.map(({ driver }) => notifyDriver({ driver, request, booking, child, io }).catch((error) => console.error("BOOKING OFFER NOTIFICATION ERROR", error.message))));
  io?.to("admin").emit("booking_matching_offers_sent", { requestId: String(request._id), bookingId: String(booking._id), driverIds });
  return { request, offersSent: candidates.length };
};
