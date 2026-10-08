import mongoose from "mongoose";
import axios from "axios";
import DriverPayout from "../models/DriverPayout.js";
import Invoice from "../models/Invoice.js";
import { cloudinary } from "../config/cloudinary.js";

const halfAmount = (amount) => Math.round(Number(amount || 0) * 50) / 100;

export const ensureDriverPayouts = async (invoices) => {
  const ensureOne = async (filter, values) => {
    try {
      await DriverPayout.updateOne(filter, { $setOnInsert: values }, { upsert: true });
    } catch (error) {
      // A simultaneous driver/admin request may win the unique invoice/installment insert.
      if (error?.code !== 11000) throw error;
    }
  };
  for (const invoice of invoices) {
    const total = Number(invoice.baseAmount ?? invoice.totalAmount ?? 0);
    if (!Number.isFinite(total) || total <= 0) continue;
    const mid = halfAmount(total);
    const common = { invoiceId: invoice._id, driverId: String(invoice.driverId).trim().toUpperCase() };
    await ensureOne({ ...common, installment: "mid_service" }, { ...common, installment: "mid_service", amount: mid });
    await ensureOne({ ...common, installment: "service_complete" }, { ...common, installment: "service_complete", amount: Math.round((total - mid) * 100) / 100 });
  }
};

export const listDriverPayouts = async (req, res) => {
  try {
    const driverId = String(req.driver.driverId || "").trim().toUpperCase();
    const invoices = await Invoice.find({ driverId }).select("_id driverId baseAmount totalAmount invoiceNumber month childId").populate("childId", "name").lean();
    await ensureDriverPayouts(invoices);
    const invoiceIds = invoices.map((invoice) => invoice._id);
    const payouts = await DriverPayout.find({ driverId, invoiceId: { $in: invoiceIds } }).populate({ path: "invoiceId", select: "invoiceNumber month childId", populate: { path: "childId", select: "name" } }).sort({ createdAt: -1, installment: 1 }).lean();
    return res.json({ success: true, count: payouts.length, data: payouts.map(({ proof, ...payout }) => ({ ...payout, proofAvailable: Boolean(proof) })) });
  } catch (error) {
    console.error("DRIVER PAYOUT LIST ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load driver payments" });
  }
};

export const getDriverPayoutProof = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid payout ID" });
    const payout = await DriverPayout.findOne({ _id: req.params.id, driverId: String(req.driver.driverId).trim().toUpperCase() }).select("proof").lean();
    if (!payout?.proof?.publicId) return res.status(404).json({ success: false, message: "Payment proof not found" });
    const url = cloudinary.url(payout.proof.publicId, { secure: true, type: "authenticated", resource_type: payout.proof.resourceType || "image", format: payout.proof.format, sign_url: true });
    const image = await axios.get(url, { responseType: "stream", timeout: 15000 });
    res.setHeader("Content-Type", image.headers["content-type"] || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename=payment-confirmation.${payout.proof.format || "jpg"}`);
    image.data.on("error", (error) => { console.error("PAYOUT PROOF STREAM ERROR:", error); if (!res.headersSent) res.status(502); res.end(); });
    return image.data.pipe(res);
  } catch (error) {
    console.error("DRIVER PAYOUT PROOF ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load payment proof" });
  }
};

export const listAdminPayouts = async (req, res) => {
  try {
    const invoices = await Invoice.find().select("_id driverId baseAmount totalAmount invoiceNumber month childId").populate("childId", "name").sort({ createdAt: -1 }).lean();
    await ensureDriverPayouts(invoices);
    const ids = invoices.map((invoice) => invoice._id);
    const payouts = await DriverPayout.find({ invoiceId: { $in: ids } }).populate({ path: "invoiceId", select: "invoiceNumber month childId", populate: { path: "childId", select: "name" } }).sort({ driverId: 1, createdAt: -1 }).lean();
    return res.json({ success: true, count: payouts.length, data: payouts.map(({ proof, ...payout }) => ({ ...payout, proofAvailable: Boolean(proof) })) });
  } catch (error) {
    console.error("ADMIN PAYOUT LIST ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load driver payouts" });
  }
};

export const markDriverPayoutPaid = async (req, res) => {
  try {
    const payout = await DriverPayout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
    if (payout.status === "Paid") return res.status(409).json({ success: false, message: "This installment is already marked paid" });
    if (!req.file?.filename) return res.status(400).json({ success: false, message: "Upload the payment confirmation image" });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || Math.abs(amount - payout.amount) > 0.01) return res.status(400).json({ success: false, message: `Payment amount must match ₹${payout.amount.toFixed(2)}` });
    payout.status = "Paid";
    payout.amount = Math.round(amount * 100) / 100;
    payout.paidAt = new Date();
    payout.proof = { publicId: req.file.filename, resourceType: req.file.resource_type || "image", format: req.file.format || "jpg" };
    payout.markedPaidBy = req.admin?._id || null;
    await payout.save();
    return res.json({ success: true, message: "Driver installment recorded as paid", data: { id: payout._id, status: payout.status, amount: payout.amount, paidAt: payout.paidAt } });
  } catch (error) {
    console.error("MARK DRIVER PAYOUT PAID ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to record driver payment" });
  }
};
