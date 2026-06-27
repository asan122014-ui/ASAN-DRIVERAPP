import Invoice from "../models/Invoice.js";
import BillingSettings from "../models/BillingSettings.js";
import SecurityDeposit from "../models/SecurityDeposit.js";
import Student from "../models/Students.js";
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
    invoice.paymentMethod =
      req.body.paymentMethod || "Manual";

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
   GENERATE MONTHLY INVOICE (AUTOMATIC)
================================================== */
export const generateInvoice = async (req, res) => {
  try {
    const {
      parentId,
      childId,
      driverId,
      month,
    } = req.body;

    /* Billing Settings */

    const billing = await BillingSettings.findOne();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Billing settings not found",
      });
    }

    /* Student */

    const student = await Student.findById(childId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const oneWayDistance = student.routeDistance || 0;

    /* Completed Trips */

    const completedDays = await Trip.countDocuments({
      childId,
      status: "completed",
    });

    /* Billing Calculation */

    const bill = calculateInvoice({
      completedDays,
      oneWayDistance,
      ratePerKm: billing.ratePerKm,
      platformCommission: billing.platformCommission,
    });

    /* Due Date */

    const dueDate = new Date();

    dueDate.setDate(
      dueDate.getDate() + billing.paymentDueDays
    );

    /* Prevent Duplicate Invoice */

    const existingInvoice = await Invoice.findOne({
      childId,
      month,
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: "Invoice already generated for this month",
      });
    }

    /* Create Invoice */

    const invoice = await Invoice.create({
      parentId,
      childId,
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

    res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      data: invoice,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};
