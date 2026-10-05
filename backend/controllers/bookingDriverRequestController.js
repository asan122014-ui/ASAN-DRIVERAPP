import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import DriverRequest from "../models/DriverRequest.js";
import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import { dispatchNextOfferBatch } from "../services/bookingMatchingService.js";

const normalizeDriverId = (value) => String(value || "").trim().toUpperCase();

const loadOfferForDriver = async (requestId, driverId) => {
  const driverRequest = await DriverRequest.findById(requestId);
  if (!driverRequest || driverRequest.status !== "Pending") return { error: "This ride request is no longer open.", status: 409 };
  if (driverRequest.matchingStatus !== "Offered" || !(driverRequest.currentOfferDriverIds || []).includes(driverId)) return { error: "This ride request is not currently offered to you.", status: 403 };
  if (!driverRequest.offerExpiresAt || driverRequest.offerExpiresAt.getTime() <= Date.now()) return { error: "This ride offer has expired.", status: 410 };
  return { driverRequest };
};

export const getDriverBookingOffers = async (req, res) => {
  try {
    const driverId = normalizeDriverId(req.driver.driverId);
    const requests = await DriverRequest.find({ status: "Pending", matchingStatus: "Offered", currentOfferDriverIds: driverId, offerExpiresAt: { $gt: new Date() } })
      .populate("bookingId")
      .populate("childId", "name school grade")
      .sort({ createdAt: -1 });
    const data = requests.filter((item) => item.bookingId).map((item) => ({
      requestId: String(item._id),
      bookingId: String(item.bookingId._id),
      child: item.childId ? { name: item.childId.name, school: item.childId.school, grade: item.childId.grade } : item.bookingId.child,
      route: item.bookingId.route,
      vehicleType: item.bookingId.quote?.vehicleType,
      monthlyPrice: item.bookingId.quote?.totalMonthly,
      expiresAt: item.offerExpiresAt,
      createdAt: item.createdAt,
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("DRIVER BOOKING OFFERS ERROR", error);
    return res.status(500).json({ success: false, message: "Unable to load ride offers" });
  }
};

export const acceptDriverBookingOffer = async (req, res) => {
  try {
    const driverId = normalizeDriverId(req.driver.driverId);
    const loaded = await loadOfferForDriver(req.params.id, driverId);
    if (loaded.error) return res.status(loaded.status).json({ success: false, message: loaded.error });
    const request = loaded.driverRequest;
    const parent = await Parent.findById(request.parentId);
    const driver = await Driver.findById(req.driver._id).select("driverId status");
    if (!parent || !driver || driver.status !== "approved") return res.status(409).json({ success: false, message: "The parent or approved driver account is no longer available." });
    if (parent.driverId && normalizeDriverId(parent.driverId) !== driverId) return res.status(409).json({ success: false, message: "This parent is already linked to another driver." });

    const accepted = await DriverRequest.findOneAndUpdate(
      { _id: request._id, status: "Pending", matchingStatus: "Offered", currentOfferDriverIds: driverId, offerExpiresAt: { $gt: new Date() } },
      { $set: { status: "Assigned", matchingStatus: "Accepted", assignedDriverId: driverId, assignedAt: new Date(), respondedAt: new Date(), offerExpiresAt: null, rejectionReason: "" } },
      { new: true }
    );
    if (!accepted) return res.status(409).json({ success: false, message: "Another driver has already accepted this request, or the offer expired." });

    await Booking.updateOne({ _id: accepted.bookingId }, { $set: { assignedDriverId: driverId, status: "awaiting_payment" } });
    parent.driverId = driverId;
    await parent.save();
    if (accepted.childId) await Child.updateMany({ parentId: parent._id }, { $set: { driverId } });

    const booking = await Booking.findById(accepted.bookingId);
    const io = req.app.get("io");
    const notice = await Notification.create({
      parent: parent._id,
      child: accepted.childId || null,
      recipientType: "parent",
      notificationKey: "BOOKING_DRIVER_ACCEPTED",
      title: "Driver accepted your request",
      message: `${driverId} accepted the ride request. Complete payment to start the service.`,
      type: "driver_request_accepted",
      priority: "high",
      meta: { bookingId: String(booking?._id || ""), requestId: String(accepted._id), driverId, monthlyPrice: booking?.quote?.totalMonthly },
    });
    const parentPayload = { requestId: String(accepted._id), bookingId: String(accepted.bookingId), driverId, status: "awaiting_payment", monthlyPrice: booking?.quote?.totalMonthly, title: notice.title, message: notice.message };
    io?.to(String(parent._id)).emit("booking_driver_accepted", parentPayload);
    io?.to("admin").emit("booking_driver_accepted", parentPayload);
    return res.json({ success: true, message: "Ride request accepted", data: { request: accepted, booking: { id: String(booking?._id || ""), status: booking?.status, monthlyPrice: booking?.quote?.totalMonthly } } });
  } catch (error) {
    console.error("ACCEPT BOOKING OFFER ERROR", error);
    return res.status(500).json({ success: false, message: "Unable to accept this ride request" });
  }
};

export const rejectDriverBookingOffer = async (req, res) => {
  try {
    const driverId = normalizeDriverId(req.driver.driverId);
    const loaded = await loadOfferForDriver(req.params.id, driverId);
    if (loaded.error) return res.status(loaded.status).json({ success: false, message: loaded.error });
    const request = loaded.driverRequest;
    const rejected = await DriverRequest.findOneAndUpdate(
      { _id: request._id, status: "Pending", matchingStatus: "Offered", currentOfferDriverIds: driverId, offerExpiresAt: { $gt: new Date() } },
      { $addToSet: { rejectedDriverIds: driverId }, $set: { respondedAt: new Date() } },
      { new: true }
    );
    if (!rejected) return res.status(409).json({ success: false, message: "This offer has already been answered or expired." });
    const allResponded = (rejected.currentOfferDriverIds || []).every((id) => (rejected.rejectedDriverIds || []).includes(id));
    let nextBatch = null;
    if (allResponded && rejected.requestType === "new_driver") {
      rejected.matchingStatus = "Searching";
      rejected.offerExpiresAt = null;
      await rejected.save();
      nextBatch = await dispatchNextOfferBatch({ requestId: rejected._id, io: req.app.get("io") });
    }
    else if (allResponded) {
      rejected.matchingStatus = "Exhausted";
      rejected.currentOfferDriverIds = [];
      rejected.offerExpiresAt = null;
      rejected.rejectionReason = "The selected driver declined the request.";
      await rejected.save();
      req.app.get("io")?.to(String(rejected.parentId)).emit("booking_driver_declined", { requestId: String(rejected._id), bookingId: String(rejected.bookingId) });
    }
    return res.json({ success: true, message: "Offer declined", data: { request: nextBatch?.request || rejected, nextOffersSent: nextBatch?.offersSent || 0 } });
  } catch (error) {
    console.error("REJECT BOOKING OFFER ERROR", error);
    return res.status(500).json({ success: false, message: "Unable to decline this ride request" });
  }
};

export const adminDispatchBookingRequest = async (req, res) => {
  try {
    const result = await dispatchNextOfferBatch({ requestId: req.params.id, io: req.app.get("io") });
    if (!result.request) return res.status(404).json({ success: false, message: "Booking request not found" });
    if (!result.offersSent) return res.status(409).json({ success: false, message: result.request.rejectionReason || "No eligible drivers were found", data: result.request });
    return res.json({ success: true, message: `${result.offersSent} nearby driver offer${result.offersSent === 1 ? "" : "s"} sent`, data: result.request });
  } catch (error) {
    console.error("ADMIN BOOKING DISPATCH ERROR", error);
    return res.status(500).json({ success: false, message: "Unable to send driver offers" });
  }
};
