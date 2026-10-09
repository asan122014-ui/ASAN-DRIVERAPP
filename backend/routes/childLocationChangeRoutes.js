import express from "express";
import mongoose from "mongoose";
import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Child from "../models/Child.js";
import Booking from "../models/Booking.js";
import Notification from "../models/Notification.js";
import ChildLocationChangeRequest from "../models/ChildLocationChangeRequest.js";
import { quoteForDistance } from "../services/bookingPricing.js";
import { priceLocationChange } from "../services/locationChangePricing.js";
import { getTrafficRoute } from "../services/googleRouteService.js";
import { razorpayClient, razorpayConfig } from "../services/razorpayService.js";
import { confirmedRazorpayPayment, verifyCheckoutSignature } from "../services/paymentRules.js";

const router = express.Router();
const validId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const fail = (res, error) => {
  console.error("CHILD LOCATION CHANGE ERROR", error?.message || error);
  const status = Number(error?.status) || 500;
  const message = status < 500 ? error.message : error.publicMessage || "Unable to process the location change right now. Please try again later.";
  return res.status(status).json({ success: false, message });
};

async function getRoute(pickup, dropoff) {
  if (![pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng].every((value) => Number.isFinite(Number(value)))) {
    const error = new Error("Both home and school map locations must be set before changing this route."); error.status = 400; throw error;
  }
  try {
    const route = await getTrafficRoute(
      { lat: Number(pickup.lat), lng: Number(pickup.lng) },
      { lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
    );
    return { distanceKm: route.distanceKm, durationMinutes: route.durationMinutes };
  } catch (cause) {
    const error = new Error(cause.publicMessage || "Google Maps could not calculate this route. Check the pinned locations and try again.", { cause });
    error.status = cause.code === "INVALID_ROUTE_COORDINATES" ? 400 : 503;
    error.code = cause.code || "MAPS_ROUTE_UNAVAILABLE";
    error.publicMessage = cause.publicMessage;
    throw error;
  }
}

async function parentNotification(request, title, message) {
  try {
    await Notification.create({ parent: request.parentId, recipientType: "parent", title, message, type: "general", notificationKey: "CHILD_LOCATION_CHANGE", meta: { requestId: String(request._id), childId: String(request.childId), status: request.status } });
  } catch (error) { console.warn("Location change notification could not be saved:", error.message); }
}

async function applyLocation(request, child, booking, session) {
  const isHome = request.locationType === "home";
  if (isHome) {
    child.pickupLocation = request.proposedAddress;
    child.location = request.proposedCoordinates;
  } else {
    child.dropoffLocation = request.proposedAddress;
    child.dropLocationCoords = request.proposedCoordinates;
  }
  child.routeDistance = request.newDistanceKm;
  child.estimatedDuration = request.proposedDurationMinutes || child.estimatedDuration || 0;
  await child.save(session ? { session } : undefined);
  if (booking) {
    booking.route.distanceKm = request.newDistanceKm;
    booking.route.durationMinutes = request.proposedDurationMinutes || booking.route.durationMinutes;
    if (isHome) { booking.route.pickup = request.proposedAddress; booking.route.pickupCoordinates = request.proposedCoordinates; }
    else { booking.route.dropoff = request.proposedAddress; booking.route.dropoffCoordinates = request.proposedCoordinates; }
    if (request.newMonthlyPrice < request.oldMonthlyPrice) {
      booking.renewalQuote = request.nextQuote;
      booking.renewalEffectiveAt = booking.serviceEndsAt || null;
    } else if (request.amountDue > 0) booking.quote = request.nextQuote;
    await booking.save(session ? { session } : undefined);
  }
  request.status = "completed";
  request.appliedAt = new Date();
  await request.save(session ? { session } : undefined);
}

// Parent: see requests for one child and submit a reason for a home/school location change.
router.get("/children/:childId", verifyParent, async (req, res) => {
  try {
    if (!validId(req.params.childId)) return res.status(400).json({ success: false, message: "Invalid child ID." });
    const child = await Child.findOne({ _id: req.params.childId, parentId: req.parent._id }).select("_id");
    if (!child) return res.status(404).json({ success: false, message: "Child not found." });
    const requests = await ChildLocationChangeRequest.find({ childId: child._id, parentId: req.parent._id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: requests });
  } catch (error) { return fail(res, error); }
});

router.post("/children/:childId", verifyParent, async (req, res) => {
  try {
    if (!validId(req.params.childId)) return res.status(400).json({ success: false, message: "Invalid child ID." });
    const locationType = String(req.body?.locationType || "").toLowerCase();
    const reason = String(req.body?.reason || "").trim();
    if (!["home", "school"].includes(locationType) || reason.length < 5 || reason.length > 1000) return res.status(400).json({ success: false, message: "Choose a location and explain the reason in at least 5 characters." });
    const child = await Child.findOne({ _id: req.params.childId, parentId: req.parent._id });
    if (!child) return res.status(404).json({ success: false, message: "Child not found." });
    const open = await ChildLocationChangeRequest.findOne({ childId: child._id, locationType, status: { $in: ["pending", "approved", "awaiting_payment"] } });
    if (open) return res.status(409).json({ success: false, message: "A request for this location is already in progress." });
    const request = await ChildLocationChangeRequest.create({ parentId: req.parent._id, childId: child._id, parentName: req.parent.name || "", parentPhone: req.parent.phone || "", childName: child.name || "", locationType, reason });
    return res.status(201).json({ success: true, data: request, message: "Your request will be processed by the end of the day, and an agent will call to confirm the location change." });
  } catch (error) { return fail(res, error); }
});

// Admin: review requests and record an approval or rejection.
router.get("/admin", verifyAdmin, async (req, res) => {
  try {
    const status = ["pending", "approved", "rejected", "awaiting_payment", "completed"].includes(req.query.status) ? req.query.status : "pending";
    const requests = await ChildLocationChangeRequest.find({ status }).sort({ createdAt: 1 }).lean();
    return res.json({ success: true, data: requests });
  } catch (error) { return fail(res, error); }
});

router.patch("/admin/:requestId/decision", verifyAdmin, async (req, res) => {
  try {
    if (!validId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const decision = String(req.body?.decision || "").toLowerCase();
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ success: false, message: "Choose approve or reject." });
    const request = await ChildLocationChangeRequest.findOne({ _id: req.params.requestId, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "This request is no longer awaiting a decision." });
    request.status = decision === "approve" ? "approved" : "rejected";
    request.decidedBy = req.admin._id;
    request.decidedAt = new Date();
    request.decisionNote = String(req.body?.note || "").trim().slice(0, 500);
    await request.save();
    await parentNotification(request, decision === "approve" ? "Location change approved" : "Location change request reviewed", decision === "approve" ? "Your location change is approved. Open the child profile to select the new point on the map." : "Your location change request was not approved. Please contact the institute for details.");
    req.app.get("io")?.to(String(request.parentId)).emit("child_location_change_updated", { requestId: String(request._id), status: request.status });
    return res.json({ success: true, data: request });
  } catch (error) { return fail(res, error); }
});

// Parent: use one approved request to pin the new location. Price increases must be paid before applying.
router.post("/:requestId/location", verifyParent, async (req, res) => {
  try {
    if (!validId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const request = await ChildLocationChangeRequest.findOne({ _id: req.params.requestId, parentId: req.parent._id });
    if (!request || request.status !== "approved") return res.status(409).json({ success: false, message: "An approved location change request is required." });
    const child = await Child.findOne({ _id: request.childId, parentId: req.parent._id });
    if (!child) return res.status(404).json({ success: false, message: "Child not found." });
    const address = String(req.body?.address || "").trim();
    const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
    if (!address || address.length > 500 || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ success: false, message: "Select a valid location on the map." });
    const proposed = { lat, lng };
    const pickup = request.locationType === "home" ? proposed : { lat: child.location?.lat, lng: child.location?.lng };
    const dropoff = request.locationType === "school" ? proposed : { lat: child.dropLocationCoords?.lat, lng: child.dropLocationCoords?.lng };
    const route = await getRoute(pickup, dropoff);
    const booking = await Booking.findOne({ parentId: req.parent._id, status: "active", $or: [{ childId: child._id }, { childIds: child._id }] }).sort({ serviceEndsAt: -1 });
    request.proposedAddress = address;
    request.proposedCoordinates = proposed;
    request.oldDistanceKm = Number(booking?.route?.distanceKm ?? child.routeDistance ?? 0);
    request.newDistanceKm = route.distanceKm;
    request.proposedDurationMinutes = route.durationMinutes;
    request.bookingId = booking?._id || null;
    if (!booking) {
      request.oldMonthlyPrice = 0; request.newMonthlyPrice = 0; request.amountDue = 0;
      await applyLocation(request, child, null);
      await parentNotification(request, "Location updated", "Your approved location change is active. Your next booking will use the updated route.");
      return res.json({ success: true, data: { status: "completed", distanceKm: route.distanceKm, amountDue: 0, message: "Location updated. Your next booking will use the new route." } });
    }
    const price = priceLocationChange({ oldDistanceKm: request.oldDistanceKm, newDistanceKm: route.distanceKm, vehicleType: booking.quote?.vehicleType || "AUTO", childCount: booking.quote?.childCount || 1, workingDays: booking.quote?.workingDays || 26, currentQuote: booking.quote });
    const oldQuote = Number(price.previous.totalMonthly);
    const nextQuote = price.next;
    request.oldMonthlyPrice = oldQuote;
    request.newMonthlyPrice = nextQuote.totalMonthly;
    request.amountDue = price.amountDue;
    request.driverAmountDue = price.driverAmountDue;
    request.nextQuote = nextQuote;
    if (request.amountDue > 0) {
      if (request.amountDue < 1) return res.status(400).json({ success: false, message: "The route adjustment is below the payment provider’s ₹1 minimum. Please contact the institute to finish this small adjustment." });
      request.status = "awaiting_payment";
      await request.save();
      return res.json({ success: true, data: { status: request.status, requestId: String(request._id), oldDistanceKm: request.oldDistanceKm, newDistanceKm: route.distanceKm, currentMonthlyPrice: oldQuote, newMonthlyPrice: nextQuote.totalMonthly, amountDue: request.amountDue, message: "The new route increases the monthly price. Pay the difference to apply it." } });
    }
    await applyLocation(request, child, booking);
    const message = nextQuote.totalMonthly < oldQuote ? `The route is shorter. Your current service stays at ₹${oldQuote.toFixed(2)}; the revised monthly price of ₹${nextQuote.totalMonthly.toFixed(2)} applies from your next renewal.` : "Location updated with no price increase.";
    await parentNotification(request, "Location updated", message);
    return res.json({ success: true, data: { status: "completed", requestId: String(request._id), oldDistanceKm: request.oldDistanceKm, newDistanceKm: route.distanceKm, currentMonthlyPrice: oldQuote, nextMonthlyPrice: nextQuote.totalMonthly, amountDue: 0, message } });
  } catch (error) { return fail(res, error); }
});

router.post("/:requestId/order", verifyParent, async (req, res) => {
  try {
    if (!validId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const request = await ChildLocationChangeRequest.findOne({ _id: req.params.requestId, parentId: req.parent._id, status: "awaiting_payment" });
    if (!request || request.amountDue < 1) return res.status(409).json({ success: false, message: "There is no approved price adjustment to pay." });
    const config = razorpayConfig();
    if (request.paymentOrderId.startsWith("order_")) return res.json({ success: true, data: { order_id: request.paymentOrderId, amount: Math.round(request.amountDue * 100), currency: "INR", keyId: config.keyId } });
    const order = await razorpayClient().orders.create({ amount: Math.round(request.amountDue * 100), currency: "INR", receipt: `loc_${String(request._id).slice(-16)}`, partial_payment: false });
    if (!order.id || order.amount !== Math.round(request.amountDue * 100) || order.currency !== "INR") throw new Error("Payment provider returned an invalid order.");
    request.paymentOrderId = order.id;
    await request.save();
    return res.json({ success: true, data: { order_id: order.id, amount: order.amount, currency: order.currency, keyId: config.keyId } });
  } catch (error) { return fail(res, error); }
});

router.post("/:requestId/verify", verifyParent, async (req, res) => {
  try {
    if (!validId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID." });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === "string" && value)) return res.status(400).json({ success: false, message: "Payment confirmation is incomplete." });
    const request = await ChildLocationChangeRequest.findOne({ _id: req.params.requestId, parentId: req.parent._id, status: "awaiting_payment" });
    if (!request || request.paymentOrderId !== orderId) return res.status(409).json({ success: false, message: "Payment order does not match this location request." });
    const config = razorpayConfig();
    if (!verifyCheckoutSignature(orderId, paymentId, signature, config.keySecret)) return res.status(400).json({ success: false, message: "Payment signature could not be verified." });
    const client = razorpayClient();
    const order = await client.orders.fetch(orderId);
    const payments = (await client.orders.fetchPayments(orderId)).items || [];
    const confirmed = confirmedRazorpayPayment(order, payments, { orderId, amount: request.amountDue });
    if (!confirmed || String(confirmed.id) !== paymentId) return res.status(409).json({ success: false, message: "Payment is not captured yet. Please check again shortly." });
    const child = await Child.findOne({ _id: request.childId, parentId: req.parent._id });
    const booking = request.bookingId ? await Booking.findOne({ _id: request.bookingId, parentId: req.parent._id, status: "active" }) : null;
    if (!child || !booking) return res.status(409).json({ success: false, message: "The active ride changed. Contact the institute before retrying." });
    request.paymentId = paymentId;
    request.paidAt = new Date();
    const oldQuote = booking.quote?.totalMonthly ? Number(booking.quote.totalMonthly) : request.oldMonthlyPrice;
    const nextQuote = quoteForDistance(request.newDistanceKm, booking.quote?.vehicleType || "AUTO", booking.quote?.childCount || 1, booking.quote?.workingDays || 26);
    request.nextQuote = nextQuote;
    await applyLocation(request, child, booking);
    await parentNotification(request, "Location updated", `Your location change is active. The monthly price adjustment of ₹${request.amountDue.toFixed(2)} was paid successfully.`);
    if (booking.assignedDriverId && request.driverAmountDue > 0) {
      try {
        const driverNotice = await Notification.create({ driver: booking.assignedDriverId, recipientType: "driver", title: "Route price adjustment received", message: `The parent paid the route adjustment for ${child.name || "the child"}. Distance charges: ₹${request.driverAmountDue.toFixed(2)}. Platform charges are handled separately.`, type: "payment_received", notificationKey: "LOCATION_CHANGE_PAID", meta: { requestId: String(request._id), bookingId: String(booking._id), distanceCharge: request.driverAmountDue } });
        req.app.get("io")?.to(booking.assignedDriverId).emit("new_notification", driverNotice.toObject());
      } catch (notificationError) { console.warn("Driver route price notification could not be saved:", notificationError.message); }
    }
    req.app.get("io")?.to(String(request.parentId)).emit("child_location_change_updated", { requestId: String(request._id), status: "completed", amountDue: request.amountDue });
    return res.json({ success: true, data: { status: "completed", paid: true, previousMonthlyPrice: oldQuote, monthlyPrice: nextQuote.totalMonthly } });
  } catch (error) { return fail(res, error); }
});

export default router;
