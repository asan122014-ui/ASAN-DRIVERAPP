import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Invoice from "../models/Invoice.js";
import { confirmedRazorpayPayment, verifyCheckoutSignature } from "../services/paymentRules.js";
import { razorpayClient, razorpayConfig } from "../services/razorpayService.js";

const fail = (res, error) => {
  console.error("INVOICE RAZORPAY ERROR", error.message);
  const status = error.status === 400 || error.status === 404 || error.status === 409 || error.status === 503 ? error.status : 500;
  return res.status(status).json({ success: false, message: status === 500 ? "Unable to process invoice payment right now." : error.message });
};

const requireParent = (req, res) => {
  if (req.invoiceAccess?.type === "parent" && req.parent?._id) return true;
  res.status(403).json({ success: false, message: "Only the parent who owns this invoice can pay it." });
  return false;
};

const getInvoice = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    const error = new Error("Invalid invoice ID"); error.status = 400; throw error;
  }
  const invoice = await Invoice.findOne({ _id: req.params.id, parentId: req.parent._id });
  if (!invoice) { const error = new Error("Invoice not found"); error.status = 404; throw error; }
  return invoice;
};

const amountInPaise = (invoice) => {
  const amount = Number(invoice.totalAmount);
  const paise = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(paise) || paise < 100) {
    const error = new Error("This invoice has an invalid payment amount. Please contact the institute."); error.status = 400; throw error;
  }
  return paise;
};

async function markInvoicePaid(invoice, orderId, payment, signature = null) {
  const paidAt = new Date();
  const result = await Invoice.updateOne(
    { _id: invoice._id, parentId: invoice.parentId, razorpayOrderId: orderId, status: { $nin: ["Cancelled"] }, paymentStatus: { $ne: "Success" } },
    { $set: { status: "Paid", paymentStatus: "Success", paymentMethod: "Razorpay", paidAt, razorpayPaymentId: payment.id, razorpayOrderLockToken: null, razorpayOrderLockExpiresAt: null, ...(signature ? { razorpaySignature: signature } : {}) } }
  );
  if (!result.matchedCount) {
    const latest = await Invoice.findById(invoice._id);
    if (latest?.status === "Paid" && latest.paymentStatus === "Success" && latest.razorpayPaymentId === payment.id) return latest;
    const error = new Error("Invoice status changed before payment could be recorded. Please contact support."); error.status = 409; throw error;
  }
  return Invoice.findById(invoice._id);
}

async function findCapturedPayment(orderId, amount) {
  const client = razorpayClient();
  const [order, response] = await Promise.all([client.orders.fetch(orderId), client.orders.fetchPayments(orderId)]);
  const payment = confirmedRazorpayPayment(order, response.items || [], { orderId, amount: amount / 100 });
  if (order.status === "paid" && !payment) {
    const error = new Error("Razorpay payment amount or currency does not match this invoice."); error.status = 409; throw error;
  }
  return { order, payment };
}

export async function createInvoicePaymentOrder(req, res) {
  if (!requireParent(req, res)) return;
  try {
    const config = razorpayConfig();
    const invoice = await getInvoice(req);
    if (invoice.status === "Cancelled") return res.status(409).json({ success: false, message: "Cancelled invoices cannot be paid." });
    if (invoice.status === "Paid" && invoice.paymentStatus === "Success") return res.json({ success: true, data: { paid: true } });
    const amount = amountInPaise(invoice);

    if (invoice.razorpayOrderId) {
      const { order, payment } = await findCapturedPayment(invoice.razorpayOrderId, amount);
      if (payment) {
        const updated = await markInvoicePaid(invoice, invoice.razorpayOrderId, payment);
        return res.json({ success: true, data: { paid: true, invoice: updated } });
      }
      if (order.amount !== amount || order.currency !== "INR") return res.status(409).json({ success: false, message: "Invoice amount changed after the payment order was created. Please contact the institute." });
      return res.json({ success: true, data: { order_id: order.id, amount, currency: "INR", keyId: config.keyId } });
    }

    const lockToken = randomUUID();
    const lockExpiresAt = new Date(Date.now() + 3 * 60 * 1000);
    const claimed = await Invoice.findOneAndUpdate(
      { _id: invoice._id, parentId: invoice.parentId, razorpayOrderId: null, status: { $nin: ["Paid", "Cancelled"] }, paymentStatus: { $ne: "Success" }, $or: [{ razorpayOrderLockExpiresAt: null }, { razorpayOrderLockExpiresAt: { $exists: false } }, { razorpayOrderLockExpiresAt: { $lt: new Date() } }] },
      { $set: { paymentMethod: "Razorpay", razorpayOrderLockToken: lockToken, razorpayOrderLockExpiresAt: lockExpiresAt } },
      { new: true }
    );
    if (!claimed) return res.status(409).json({ success: false, message: "An invoice payment order is already being created. Please retry in a moment." });

    let order;
    try {
      order = await razorpayClient().orders.create({
        amount,
        currency: "INR",
        receipt: `inv_${String(invoice._id).slice(-20)}`,
        partial_payment: false,
        notes: { invoice_id: String(invoice._id), parent_id: String(invoice.parentId), invoice_number: invoice.invoiceNumber || "" },
      });
      if (!order.id || order.amount !== amount || order.currency !== "INR") throw new Error("Razorpay returned an invalid invoice order.");
      const saved = await Invoice.updateOne(
        { _id: invoice._id, parentId: invoice.parentId, razorpayOrderLockToken: lockToken, razorpayOrderId: null },
        { $set: { razorpayOrderId: order.id, paymentMethod: "Razorpay", paymentStatus: "Pending", razorpayOrderLockToken: null, razorpayOrderLockExpiresAt: null } }
      );
      if (!saved.matchedCount) {
        const error = new Error("Invoice status changed while creating the payment order."); error.status = 409; throw error;
      }
    } catch (error) {
      await Invoice.updateOne({ _id: invoice._id, razorpayOrderLockToken: lockToken }, { $set: { razorpayOrderLockToken: null, razorpayOrderLockExpiresAt: null } });
      throw error;
    }
    return res.status(201).json({ success: true, data: { order_id: order.id, amount, currency: "INR", keyId: config.keyId } });
  } catch (error) { return fail(res, error); }
}

export async function verifyInvoicePayment(req, res) {
  if (!requireParent(req, res)) return;
  try {
    const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = req.body || {};
    if (![paymentId, orderId, signature].every((value) => typeof value === "string" && value.length)) return res.status(400).json({ success: false, message: "Payment confirmation is incomplete." });
    const config = razorpayConfig();
    if (!verifyCheckoutSignature(orderId, paymentId, signature, config.keySecret)) return res.status(400).json({ success: false, message: "Razorpay payment signature is invalid." });
    const invoice = await getInvoice(req);
    if (invoice.status === "Cancelled") return res.status(409).json({ success: false, message: "Cancelled invoices cannot be paid." });
    if (invoice.status === "Paid" && invoice.paymentStatus === "Success") {
      if (invoice.razorpayPaymentId === paymentId && invoice.razorpayOrderId === orderId) return res.json({ success: true, data: { paid: true, invoice } });
      return res.status(409).json({ success: false, message: "This invoice has already been paid." });
    }
    if (invoice.razorpayOrderId !== orderId) return res.status(400).json({ success: false, message: "Payment order does not belong to this invoice." });
    const amount = amountInPaise(invoice);
    const { payment } = await findCapturedPayment(orderId, amount);
    if (!payment || payment.id !== paymentId) return res.status(409).json({ success: false, message: "Razorpay has not confirmed a captured payment for this invoice yet." });
    const updated = await markInvoicePaid(invoice, orderId, payment, signature);
    return res.json({ success: true, data: { paid: true, invoice: updated } });
  } catch (error) { return fail(res, error); }
}
