import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Parent from "../models/Parent.js";
import DriverPayout from "../models/DriverPayout.js";
import { validParentCoupon } from "../services/parentPaymentCoupon.js";
export async function applyInvoiceCoupon(req, res) {
  if (req.invoiceAccess?.type !== "parent") return res.status(403).json({ success: false, message: "Only the owning parent can apply this coupon." });
  const parent = await Parent.findById(req.parent._id).select("email");
  if (!validParentCoupon(parent, req.body?.code)) return res.status(403).json({ success: false, message: "Coupon is invalid, expired, or unavailable for this account." });
  const session = await mongoose.startSession();
  let invoice;
  try {
    await session.withTransaction(async () => {
      if (!validParentCoupon(parent, req.body?.code)) { const error = new Error("Coupon expired."); error.status = 403; throw error; }
      invoice = await Invoice.findOne({ _id: req.params.id, parentId: req.parent._id }).session(session);
      if (invoice?.couponAppliedAt) return;
      if (!invoice || !["Pending", "Overdue"].includes(invoice.status) || invoice.paymentStatus === "Success" || invoice.razorpayOrderId || invoice.razorpayPaymentId || invoice.razorpayOrderLockToken || await DriverPayout.exists({ invoiceId: invoice._id, status: "Paid" }).session(session)) {
        const error = new Error("An existing payment or payout must be resolved before using a coupon."); error.status = 409; throw error;
      }
      const now = new Date();
      await Invoice.updateOne({ _id: invoice._id }, { $set: { couponCode: "Asanrides0", couponAppliedAt: now, waivedAmount: invoice.totalAmount, couponOriginalAmounts: { baseAmount: invoice.baseAmount, totalAmount: invoice.totalAmount }, baseAmount: 0, totalAmount: 0, status: "Paid", paymentStatus: "Success", paymentMethod: "Coupon", paidAt: now } }, { session });
      await DriverPayout.updateMany({ invoiceId: invoice._id, status: "Pending" }, { $set: { amount: 0 } }, { session });
    });
    return res.json({ success: true, message: "Coupon applied. No payment was collected." });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to apply coupon." }); }
  finally { await session.endSession(); }
}
