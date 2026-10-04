import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import DriverRequest from "../models/DriverRequest.js";
import verifyParent from "../middleware/verifyParent.js";

const router = express.Router();
const round = (value) => Math.round(Number(value) * 100) / 100;
const quoteForDistance = (distanceKm) => {
  const distance = Math.max(0, Number(distanceKm) || 0);
  const baseMonthly = 3000;
  const distanceCharge = Math.max(0, distance - 5) * 180;
  const serviceFee = 300;
  const subtotal = baseMonthly + distanceCharge + serviceFee;
  const tax = subtotal * 0.05;
  return { baseMonthly, distanceCharge: round(distanceCharge), serviceFee, tax: round(tax), totalMonthly: round(subtotal + tax) };
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
    const { child, route } = req.body || {};
    if (!child?.name?.trim() || !child?.school?.trim() || !Number.isInteger(Number(child.age)) || !route?.pickup?.trim() || !route?.dropoff?.trim() || !Number.isFinite(Number(route.distanceKm)) || Number(route.distanceKm) <= 0) {
      return res.status(400).json({ success: false, message: "Child details, pickup, drop-off and a valid route distance are required" });
    }
    const pickupCoordinates = coordinates(route.pickupCoordinates);
    const dropoffCoordinates = coordinates(route.dropoffCoordinates);
    if (!validCoordinates(pickupCoordinates) || !validCoordinates(dropoffCoordinates)) return res.status(400).json({ success: false, message: "Pickup and drop-off map locations are required" });
    const trafficRoute = await getTrafficRoute(pickupCoordinates, dropoffCoordinates).catch((error) => { console.error("TRAFFIC ROUTE ERROR", error.message); return null; });
    const finalRoute = trafficRoute || { distanceKm: round(route.distanceKm), durationMinutes: Number(route.durationMinutes) || 0 };
    const pricing = quoteForDistance(finalRoute.distanceKm);
    return res.status(200).json({ success: true, data: { child: { name: child.name.trim(), age: Number(child.age), school: child.school.trim(), grade: String(child.grade || "").trim() }, route: { pickup: route.pickup.trim(), dropoff: route.dropoff.trim(), pickupCoordinates, dropoffCoordinates, ...finalRoute, trafficAware: Boolean(trafficRoute) }, quote: { ...pricing, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } } });
  } catch (error) { console.error("BOOKING QUOTE ERROR", error); return res.status(500).json({ success: false, message: "Unable to calculate the quote" }); }
});

router.post("/request", verifyParent, async (req, res) => {
  try {
    const { child, route, quote, driverChoice, requestedDriverId, startDate } = req.body || {};
    if (!["existing", "new"].includes(driverChoice) || !child?.name || !route?.pickup || !route?.dropoff || !quote?.totalMonthly) return res.status(400).json({ success: false, message: "Complete the child, route, quote and driver choice first" });
    if (new Date(quote.expiresAt).getTime() <= Date.now()) return res.status(400).json({ success: false, message: "This quote has expired. Please calculate a new quote" });
    let normalizedDriverId = "";
    if (driverChoice === "existing") {
      normalizedDriverId = String(requestedDriverId || "").trim().toUpperCase();
      const driver = await Driver.findOne({ driverId: normalizedDriverId }).select("driverId status");
      if (!driver || driver.status !== "approved") return res.status(404).json({ success: false, message: "Approved driver not found for that ASAN ID" });
    }
    let childRecord = await Child.findOne({ parentId: req.parent._id, name: child.name.trim() });
    if (!childRecord) childRecord = await Child.create({ parentId: req.parent._id, name: child.name.trim(), age: Number(child.age), school: child.school.trim(), grade: String(child.grade || "").trim(), pickupLocation: route.pickup.trim(), dropoffLocation: route.dropoff.trim(), location: route.pickupCoordinates, dropLocationCoords: route.dropoffCoordinates, routeDistance: Number(route.distanceKm), estimatedDuration: Number(route.durationMinutes) || 0 });
    const booking = await Booking.create({ parentId: req.parent._id, childId: childRecord._id, child: { name: child.name.trim(), age: Number(child.age), school: child.school.trim(), grade: String(child.grade || "").trim() }, route, quote, driverChoice, requestedDriverId: normalizedDriverId, startDate: startDate ? new Date(startDate) : null, status: driverChoice === "existing" ? "awaiting_driver" : "driver_searching" });
    const request = await DriverRequest.create({ parentId: req.parent._id, childId: childRecord._id, requestedDriverId: normalizedDriverId, status: "Pending", notes: `Booking ${booking._id} · Monthly quote ₹${quote.totalMonthly}` });
    return res.status(201).json({ success: true, message: driverChoice === "existing" ? "Request sent to the driver" : "We are searching for an available driver", data: { booking, request } });
  } catch (error) { console.error("BOOKING REQUEST ERROR", error); return res.status(500).json({ success: false, message: "Unable to create the booking request" }); }
});

router.get("/mine", verifyParent, async (req, res) => {
  try { const bookings = await Booking.find({ parentId: req.parent._id }).populate("childId", "name school grade").sort({ createdAt: -1 }); return res.json({ success: true, data: bookings }); }
  catch (error) { return res.status(500).json({ success: false, message: "Unable to load bookings" }); }
});

export default router;
