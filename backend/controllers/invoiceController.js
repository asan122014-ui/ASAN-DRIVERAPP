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
      .populate("parentId", "name email phone")
      .populate(
        "childId",
        "name schoolName pickupLocation dropoffLocation"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Get All Invoices:", error);

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
    const invoice = await Invoice.findById(req.params.id)
      .populate("parentId", "name email phone")
      .populate(
        "childId",
        "name schoolName pickupLocation dropoffLocation"
      );

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
    console.error("Get Invoice:", error);

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

    const invoices = await Invoice.find({
      parentId,
    })
      .populate("childId", "name")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Parent Invoice:", error);

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
    invoice.paymentStatus = "Success";
    invoice.paidAt = new Date();

    invoice.paymentMethod =
      req.body.paymentMethod || "Manual";

    // Razorpay fields (used later)
    invoice.razorpayOrderId =
      req.body.razorpayOrderId || null;

    invoice.razorpayPaymentId =
      req.body.razorpayPaymentId || null;

    invoice.razorpaySignature =
      req.body.razorpaySignature || null;

    await invoice.save();

    const updatedInvoice = await Invoice.findById(
      invoice._id
    )
      .populate("parentId", "name email phone")
      .populate(
        "childId",
        "name schoolName pickupLocation dropoffLocation"
      );

    return res.status(200).json({
      success: true,
      message: "Invoice marked as paid successfully",
      data: updatedInvoice,
    });
  } catch (error) {
    console.error("Mark Invoice Paid:", error);

    return res.status(500).json({
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
    const { parentId, childId, driverId, month } = req.body;

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

    /* ================= ROUTE DISTANCE ================= */

    const oneWayDistance = Number(child.routeDistance || 0);

    /* ================= COMPLETED TRIPS ================= */

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

    /* ================= INVOICE NUMBER ================= */

    const totalInvoices =
      await Invoice.countDocuments();

    const invoiceNumber = `INV-${month.replace(
      "-",
      ""
    )}-${String(totalInvoices + 1).padStart(6, "0")}`;

    /* ================= CREATE INVOICE ================= */

    const invoice = await Invoice.create({
      invoiceNumber,

      parentId,
      childId: child._id,
      driverId,

      month,

      generatedAt: new Date(),

      completedDays,

      totalDistance: Number(
        bill.totalDistance.toFixed(2)
      ),

      ratePerKm: Number(
        billing.ratePerKm.toFixed(2)
      ),

      baseAmount: Number(
        bill.baseAmount.toFixed(2)
      ),

      platformCommission: Number(
        bill.platformCommission.toFixed(2)
      ),

      totalAmount: Number(
        bill.totalAmount.toFixed(2)
      ),

      dueDate,

      status: "Pending",

      paymentStatus: "Pending",

      paymentMethod: null,
    });

    const populatedInvoice = await Invoice.findById(
      invoice._id
    )
      .populate("parentId", "name email phone")
      .populate(
        "childId",
        "name schoolName pickupLocation dropoffLocation"
      );

    return res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    console.error(
      "Invoice Generation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
