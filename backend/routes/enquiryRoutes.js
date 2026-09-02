import express from "express";
import { rateLimit } from "express-rate-limit";
import WebsiteEnquiry from "../models/WebsiteEnquiry.js";

const router = express.Router();
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many enquiries were submitted. Please wait and try again." },
});

const text = (value, maxLength) => String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
const phone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const invalid = (res, message) => res.status(400).json({ success: false, message });

router.post("/parent", enquiryLimiter, async (req, res) => {
  try {
    const payload = {
      type: "parent",
      name: text(req.body?.parentName, 100),
      phone: phone(req.body?.phone),
      school: text(req.body?.school, 160),
      area: text(req.body?.area, 160),
      pickupLocation: text(req.body?.pickup, 240),
      dropLocation: text(req.body?.drop, 240),
      preferredTransport: text(req.body?.vehicle, 20).toLowerCase(),
    };
    if (payload.name.length < 2) return invalid(res, "Enter the parent or guardian name.");
    if (!/^[6-9]\d{9}$/.test(payload.phone)) return invalid(res, "Enter a valid 10-digit Indian mobile number.");
    if (!payload.school || !payload.area || !payload.pickupLocation || !payload.dropLocation) return invalid(res, "Complete all school and location details.");
    if (!["auto", "van", "either"].includes(payload.preferredTransport)) return invalid(res, "Select a preferred transport option.");
    const enquiry = await WebsiteEnquiry.create(payload);
    return res.status(201).json({ success: true, message: "Your parent enquiry was submitted successfully.", enquiryId: enquiry._id });
  } catch (error) {
    console.error("PARENT WEBSITE ENQUIRY ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to submit your enquiry right now." });
  }
});

router.post("/driver", enquiryLimiter, async (req, res) => {
  try {
    const payload = {
      type: "driver",
      name: text(req.body?.name, 100),
      phone: phone(req.body?.phone),
      area: text(req.body?.area, 160),
      vehicleType: text(req.body?.vehicleType, 20).toLowerCase(),
      vehicleNumber: text(req.body?.vehicleNumber, 20).toUpperCase().replace(/\s+/g, ""),
      experience: text(req.body?.experience, 20),
    };
    if (payload.name.length < 2) return invalid(res, "Enter the driver's full name.");
    if (!/^[6-9]\d{9}$/.test(payload.phone)) return invalid(res, "Enter a valid 10-digit Indian mobile number.");
    if (!payload.area) return invalid(res, "Enter the driver's area or location.");
    if (!["auto", "van"].includes(payload.vehicleType)) return invalid(res, "Select a vehicle type.");
    if (!/^[A-Z0-9-]{6,20}$/.test(payload.vehicleNumber)) return invalid(res, "Enter a valid vehicle number.");
    if (!["0-2", "3-5", "5-10", "10+"].includes(payload.experience)) return invalid(res, "Select driving experience.");
    const enquiry = await WebsiteEnquiry.create(payload);
    return res.status(201).json({ success: true, message: "Your driver enquiry was submitted successfully.", enquiryId: enquiry._id });
  } catch (error) {
    console.error("DRIVER WEBSITE ENQUIRY ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to submit your enquiry right now." });
  }
});

export default router;
