import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import DriverRequest from "../models/DriverRequest.js";
import BookingPayment from "../models/BookingPayment.js";
import verifyParent from "../middleware/verifyParent.js";
import { reconcilePayment } from "../services/bookingPaymentService.js";

const router = express.Router();
const activeStatuses = ["quoted", "awaiting_driver", "driver_searching", "driver_accepted", "awaiting_payment", "active"];
const round = (value) => Math.round(Number(value) * 100) / 100;
const quoteForDistance = (distanceKm, vehicleType = "AUTO", childCount = 1, workingDays = 26) => {
  const distance = Number(distanceKm);
  const days = Number(workingDays);
  const children = Number(childCount);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isInteger(children) || children < 1 || !Number.isInteger(days) || days < 1) throw new Error("Invalid pricing inputs");
  const normalizedVehicle = String(vehicleType).toUpperCase();
  const ratePerKm = normalizedVehicle === "VAN" ? 16 : normalizedVehicle === "AUTO" ? 14 : null;
  if (!ratePerKm) throw new Error("Vehicle type must be AUTO or VAN");
  const distanceCharge = distance * 2 * ratePerKm * days;
  const additionalChildCharge = Math.max(children - 1, 0) * 500;
  const rideSubtotal = distanceCharge + additionalChildCharge;
  const platformFee = rideSubtotal * 0.02;
  const tax = 0;
  const discount = 0;
  const totalMonthly = rideSubtotal + platformFee + tax - discount;
  return { currency: "INR", vehicleType: normalizedVehicle, workingDays: days, childCount: children, ratePerKm, distanceCharge: round(distanceCharge), additionalChildCharge: round(additionalChildCharge), rideSubtotal: round(rideSubtotal), platformFeeRate: 0.02, platformFee: round(platformFee), tax, discount, totalMonthly: round(totalMonthly) };
};
const coordinates = (value) => ({ lat: Number(value?.lat), lng: Number(value?.lng) });
const validCoordinates = (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng);
const getTrafficRoute = async (pickup, dropoff) => {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !validCoordinates(pickup) || !validCoordinates(dropoff)) return null;
  const params = new URLSearchParams({ origins: `${pickup.lat},${pickup.lng}`, destinations: `${dropoff.lat},${dropoff.lng}`, departure_time: "now", traffic_model: "best_guess", key });
  const response = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`, { timeout: 8000 });
  const element = response.data?.rows?.[0]?.elements?.[0];
  if (element?.status !== "OK") return null;
  return { distanceKm: round(Number(element.distance?.value || 0) / 1000), durationMinutes: Math.max(1, Math.round(Number((element.duration_in_traffic || element.duration)?.value || 0) / 60)) };
};

router.post("/quote", verifyParent, async (req, res) => {
  try {
    const { child, route, vehicleType = "AUTO", workingDays = 26 } = req.body || {};
    const activeBooking = await Booking.findOne({ parentId: req.parent._id, status: { $in: activeStatuses } }).select("_id status");
    if (activeBooking) return res.status(409).json({ success: false, message: "You already have a booking in progress. Complete or cancel it before creating another booking.", bookingId: activeBooking._id, status: activeBooking.status });
    if (!child?.name?.trim() || !child?.school?.trim() || !Number.isInteger(Number(child.age)) || !route?.pickup?.trim() || !route?.dropoff?.trim() || !route?.pickupTime || !route?.schoolPickupTime || !Number.isFinite(Number(route.distanceKm)) || Number(route.distanceKm) <= 0) {
      return res.status(400).json({ success: false, message: "Child details, pickup, drop-off and a valid route distance are required" });
    }
    const pickupCoordinates = coordinates(route.pickupCoordinates);
    const dropoffCoordinates = coordinates(route.dropoffCoordinates);
    if (!validCoordinates(pickupCoordinates) || !validCoordinates(dropoffCoordinates)) return res.status(400).json({ success: false, message: "Pickup and drop-off map locations are required" });
    const trafficRoute = await getTrafficRoute(pickupCoordinates, dropoffCoordinates).catch((error) => { console.error("TRAFFIC ROUTE ERROR", error.message); return null; });
    const finalRoute = trafficRoute || { distanceKm: round(route.distanceKm), durationMinutes: Number(route.durationMinutes) || 0 };
    const pricing = quoteForDistance(finalRoute.distanceKm, vehicleType, Number(child.count || 1), workingDays);
    return res.status(200).json({ success: true, data: { child: { name: child.name.trim(), age: Number(child.age), school: child.school.trim(), grade: String(child.grade || "").trim() }, route: { pickup: route.pickup.trim(), dropoff: route.dropoff.trim(), pickupCoordinates, dropoffCoordinates, pickupTime: route.pickupTime, schoolPickupTime: route.schoolPickupTime, ...finalRoute, trafficAware: Boolean(trafficRoute) }, quote: { ...pricing, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } } });
  } catch (error) { console.error("BOOKING QUOTE ERROR", error); return res.status(500).json({ success: false, message: "Unable to calculate the quote" }); }
});

router.post("/request", verifyParent, async (req, res) => {
  try {
    const { child, route, quote, driverChoice, requestedDriverId, startDate } = req.body || {};
    if (!["existing", "new"].includes(driverChoice) || !child?.name || !route?.pickup || !route?.dropoff || !route?.pickupTime || !route?.schoolPickupTime || !quote?.totalMonthly) return res.status(400).json({ success: false, message: "Complete the child, route, quote and driver choice first" });
    if (new Date(quote.expiresAt).getTime() <= Date.now()) return res.status(400).json({ success: false, message: "This quote has expired. Please calculate a new quote" });
    const activeBooking = await Booking.findOne({ parentId: req.parent._id, status: { $in: activeStatuses } }).select("_id status");
    if (activeBooking) return res.status(409).json({ success: false, message: "You already have a booking in progress. Complete or cancel it before creating another booking.", bookingId: activeBooking._id, status: activeBooking.status });
    let normalizedDriverId = "";
    if (driverChoice === "existing") {
      normalizedDriverId = String(requestedDriverId || "").trim().toUpperCase();
      const driver = await Driver.findOne({ driverId: normalizedDriverId }).select("driverId status");
      if (!driver || driver.status !== "approved") return res.status(404).json({ success: false, message: "Approved driver not found for that ASAN ID" });
    }
    let childRecord = await Child.findOne({ parentId: req.parent._id, name: child.name.trim() });
    if (!childRecord) childRecord = await Child.create({ parentId: req.parent._id, name: child.name.trim(), age: Number(child.age), gender: String(child.gender || "").trim(), school: child.school.trim(), grade: String(child.grade || "").trim(), section: String(child.section || "").trim(), pickupTime: route.pickupTime, eveningPickup: route.schoolPickupTime, pickupLocation: route.pickup.trim(), dropoffLocation: route.dropoff.trim(), location: route.pickupCoordinates, dropLocationCoords: route.dropoffCoordinates, routeDistance: Number(route.distanceKm), estimatedDuration: Number(route.durationMinutes) || 0 });
    const booking = await Booking.create({ parentId: req.parent._id, childId: childRecord._id, child: { name: child.name.trim(), age: Number(child.age), school: child.school.trim(), grade: String(child.grade || "").trim() }, route, quote, driverChoice, requestedDriverId: normalizedDriverId, startDate: startDate ? new Date(startDate) : null, status: driverChoice === "existing" ? "awaiting_driver" : "driver_searching" });
    const request = await DriverRequest.create({ parentId: req.parent._id, childId: childRecord._id, bookingId: booking._id, requestType: driverChoice === "existing" ? "existing_driver" : "new_driver", requestedDriverId: normalizedDriverId, status: "Pending", matchingStatus: "Searching", notes: `Booking ${booking._id} · Monthly price ₹${quote.totalMonthly}` });
    booking.driverRequestId = request._id;
    await booking.save();
    const { dispatchNextOfferBatch } = await import("../services/bookingMatchingService.js");
    const dispatch = await dispatchNextOfferBatch({ requestId: request._id, io: req.app.get("io") });
    const latestBooking = await Booking.findById(booking._id);
    const requestSentToDriver = driverChoice === "existing" && dispatch.offersSent > 0 && dispatch.request?.matchingStatus === "Offered";
    const message = driverChoice === "existing"
      ? requestSentToDriver
        ? `Ride request sent to ASAN ID ${normalizedDriverId}. Waiting for the driver to respond.`
        : dispatch.request?.rejectionReason || `The request could not be sent to ASAN ID ${normalizedDriverId}. Please contact the institute.`
      : dispatch.offersSent
        ? "Your request has been sent to nearby drivers"
        : "Your request is in the institute review queue";
    return res.status(201).json({ success: true, message, data: { booking: latestBooking, request: dispatch.request, targetDriverId: normalizedDriverId || null, offerSent: driverChoice === "existing" ? requestSentToDriver : dispatch.offersSent > 0 } });
  } catch (error) { console.error("BOOKING REQUEST ERROR", error); return res.status(500).json({ success: false, message: "Unable to create the booking request" }); }
});

router.get("/mine", verifyParent, async (req, res) => {
  try { const bookings = await Booking.find({ parentId: req.parent._id }).populate("childId", "name school grade").populate("driverRequestId", "status matchingStatus assignedDriverId rejectionReason offerExpiresAt").sort({ createdAt: -1 }); return res.json({ success: true, data: bookings }); }
  catch (error) { return res.status(500).json({ success: false, message: "Unable to load bookings" }); }
});

router.put("/mine/:id/cancel", verifyParent, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid booking ID" });
    const cancellableStatuses = ["awaiting_driver", "driver_searching", "awaiting_payment"];
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status === "cancelled") return res.json({ success: true, message: "Booking is already cancelled", data: booking });
    if (!cancellableStatuses.includes(booking.status)) return res.status(409).json({ success: false, message: "This booking can no longer be cancelled from the dashboard" });

    const payment = booking.status === "awaiting_payment" ? await BookingPayment.findOne({ bookingId: booking._id, parentId: req.parent._id }) : null;
    const terminalPaymentStatuses = new Set(["PAID", "FAILED", "EXPIRED", "TERMINATED", "CANCELLED", "REFUNDING", "REFUNDED", "REFUND_FAILED"]);
    if (payment?.status === "PAID") return res.status(409).json({ success: false, message: "This booking has already been paid and cannot be cancelled." });
    if (payment?.orderId.startsWith("order_") && !terminalPaymentStatuses.has(payment.status)) {
      const paymentStatus = await reconcilePayment(payment, req.app.get("io"));
      if (paymentStatus.paid) return res.status(409).json({ success: false, message: "Payment was completed and the ride service is active, so this booking can no longer be cancelled." });
    }
    const currentBooking = await Booking.findOne({ _id: booking._id, parentId: req.parent._id });
    if (currentBooking?.status !== booking.status) return res.status(409).json({ success: false, message: "The booking status changed. Refresh and try again." });

    const openRequest = booking.driverRequestId
      ? await DriverRequest.findOne({ _id: booking.driverRequestId, parentId: req.parent._id, status: booking.status === "awaiting_payment" ? "Assigned" : "Pending" }).select("currentOfferDriverIds assignedDriverId")
      : null;
    if (!openRequest) return res.status(409).json({ success: false, message: "The driver request status changed. Refresh the booking status." });
    const offeredDriverIds = [...(openRequest.currentOfferDriverIds || [])];
    if (openRequest.assignedDriverId) offeredDriverIds.push(openRequest.assignedDriverId);
    const requestFilter = { _id: booking.driverRequestId, parentId: req.parent._id, status: booking.status === "awaiting_payment" ? "Assigned" : "Pending" };
    const requestUpdate = { $set: { status: "Cancelled", matchingStatus: "Exhausted", currentOfferDriverIds: [], offerExpiresAt: null, respondedAt: new Date(), rejectionReason: "Cancelled by parent" } };
    let cancelledBooking;
    let cancelledRequest;
    if (booking.status === "awaiting_payment") {
      // Claim cancellation on the booking first so a concurrent payment reconciliation
      // either wins and activates the service, or sees a cancelled booking and refunds.
      cancelledBooking = await Booking.findOneAndUpdate(
        { _id: booking._id, parentId: req.parent._id, status: "awaiting_payment" },
        { $set: { status: "cancelled" } },
        { new: true }
      );
      if (!cancelledBooking) return res.status(409).json({ success: false, message: "The booking status changed. Refresh and try again." });
      cancelledRequest = await DriverRequest.findOneAndUpdate(requestFilter, requestUpdate, { new: true });
      if (!cancelledRequest) console.error("CANCEL BOOKING: assigned driver request was already changed", String(booking.driverRequestId));
    } else {
      // A driver can accept only while this request is Pending. Claiming the request
      // first makes acceptance and cancellation mutually exclusive without a DB transaction.
      cancelledRequest = await DriverRequest.findOneAndUpdate(requestFilter, requestUpdate, { new: true });
      if (!cancelledRequest) return res.status(409).json({ success: false, message: "A driver has already responded to this request. Refresh the booking status." });
      cancelledBooking = await Booking.findOneAndUpdate(
        { _id: booking._id, parentId: req.parent._id, status: booking.status },
        { $set: { status: "cancelled" } },
        { new: true }
      );
      if (!cancelledBooking) return res.status(409).json({ success: false, message: "The booking status changed. Refresh and try again." });
    }
    if (payment) await BookingPayment.updateOne({ _id: payment._id, status: { $ne: "PAID" } }, { $set: { status: "CANCELLED" } });

    const io = req.app.get("io");
    for (const driverId of offeredDriverIds) {
      io?.to(String(driverId)).emit("booking_request_cancelled", { requestId: String(cancelledRequest._id), bookingId: String(booking._id) });
    }
    io?.to(String(req.parent._id)).emit("booking_status_updated", { bookingId: String(cancelledBooking._id), status: cancelledBooking.status });
    io?.to("admin").emit("booking_status_updated", { bookingId: String(cancelledBooking._id), status: cancelledBooking.status });
    return res.json({ success: true, message: payment ? "Booking cancelled. If a payment was completed at the same time, it will be refunded automatically." : "Booking request cancelled", data: cancelledBooking });
  } catch (error) {
    console.error("CANCEL BOOKING ERROR", error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    const message = status < 500 ? error.message : "Unable to cancel this booking request. Please retry.";
    return res.status(status).json({ success: false, message });
  }
});

router.put("/mine/:id/retry-search", verifyParent, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid booking ID" });
    const booking = await Booking.findOne({ _id: req.params.id, parentId: req.parent._id });
    if (!booking || booking.status !== "awaiting_driver" || booking.driverChoice !== "existing") return res.status(404).json({ success: false, message: "No eligible existing-driver request was found" });
    const request = await DriverRequest.findOne({ _id: booking.driverRequestId, parentId: req.parent._id, status: "Pending", matchingStatus: "Exhausted" });
    if (!request) return res.status(409).json({ success: false, message: "This request cannot be changed to driver search" });
    request.requestType = "new_driver";
    request.requestedDriverId = "";
    request.matchingStatus = "Searching";
    request.offeredDriverIds = [];
    request.currentOfferDriverIds = [];
    request.rejectedDriverIds = [];
    request.offerExpiresAt = null;
    request.rejectionReason = "";
    await request.save();
    booking.driverChoice = "new";
    booking.requestedDriverId = "";
    booking.status = "driver_searching";
    await booking.save();
    const { dispatchNextOfferBatch } = await import("../services/bookingMatchingService.js");
    const dispatch = await dispatchNextOfferBatch({ requestId: request._id, io: req.app.get("io") });
    const refreshedBooking = await Booking.findById(booking._id).populate("driverRequestId", "status matchingStatus rejectionReason");
    return res.json({ success: true, message: dispatch.offersSent ? "Your request is now being sent to nearby drivers" : "The institute will continue matching your request", data: refreshedBooking });
  } catch (error) {
    console.error("RETRY DRIVER SEARCH ERROR", error);
    return res.status(500).json({ success: false, message: "Unable to start nearby driver search" });
  }
});

export default router;
