import Invoice from "../models/Invoice.js";
import BillingSettings from "../models/BillingSettings.js";
import SecurityDeposit from "../models/SecurityDeposit.js";
import Child from "../models/Child.js";
import Trip from "../models/Trips.js";
import { calculateInvoice } from "../services/billingService.js";

/* ==================================================
   GET ALL INVOICES (ADMIN)
================================================== */
export const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("parentId", "name email")
      .populate("childId", "name")
      .populate("driverId", "name");

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   GET SINGLE INVOICE
================================================== */
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   GET PARENT INVOICES
================================================== */
export const getParentInvoices = async (req, res) => {
  try {
    const { parentId } = req.params;

    const invoices = await Invoice.find({ parentId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   MARK INVOICE AS PAID
================================================== */
export const markInvoicePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    invoice.status = "Paid";
    invoice.paidAt = new Date();
    invoice.paymentMethod = req.body.paymentMethod || "Manual";

    await invoice.save();

    res.status(200).json({
      success: true,
      message: "Invoice marked as paid",
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   GENERATE MONTHLY INVOICE
================================================== */
export const generateInvoice = async (req, res) => {
  try {
    const {
      parentId,
      childId,
      driverId,
      month,
    } = req.body;

    /* ================= BILLING SETTINGS ================= */

    const billing = await BillingSettings.findOne();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Billing settings not found",
      });
    }

    /* ================= CHILD ================= */

    const child = await Child.findById(childId);

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    /* ================= ROUTE DISTANCE ================= */

    const oneWayDistance = child.routeDistance || 0;

    /* ================= COMPLETED DAYS ================= */
const completedDays = await Trip.countDocuments({
  child: child._id,
  status: "completed",
});

    /* ================= BILL CALCULATION ================= */

    const bill = calculateInvoice({
      completedDays,
      oneWayDistance,
      ratePerKm: billing.ratePerKm,
      platformCommission: billing.platformCommission,
    });

    /* ================= DUE DATE ================= */

    const dueDate = new Date();

    dueDate.setDate(
      dueDate.getDate() + billing.paymentDueDays
    );

    /* ================= DUPLICATE CHECK ================= */

    const existingInvoice = await Invoice.findOne({
      childId: child._id,
      month,
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: "Invoice already generated for this month",
      });
    }

    /* ================= CREATE INVOICE ================= */

    const invoice = await Invoice.create({
      parentId,
      childId: child._id,
      driverId,

      month,

      completedDays,

      totalDistance: bill.totalDistance,

      ratePerKm: billing.ratePerKm,

      baseAmount: bill.baseAmount,

      platformCommission: bill.platformCommission,

      totalAmount: bill.totalAmount,

      dueDate,

      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      data: invoice,
    });

  } catch (error) {

    console.error("Invoice Generation Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};
