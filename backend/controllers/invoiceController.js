import Invoice from "../models/Invoice.js";
import BillingSettings from "../models/BillingSettings.js";
import SecurityDeposit from "../models/SecurityDeposit.js";

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
   MARK AS PAID
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
   GENERATE MONTHLY INVOICE
   (Calculation logic will be added later)
================================================== */
export const generateInvoice = async (req, res) => {
  try {
    const {
      parentId,
      childId,
      driverId,
      month,
      completedDays,
      totalDistance,
    } = req.body;

    const billing = await BillingSettings.findOne();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Billing settings not found",
      });
    }

    const baseAmount =
      totalDistance * billing.ratePerKm;

    const platformCommission =
      (baseAmount * billing.platformCommission) / 100;

    const totalAmount =
      baseAmount + platformCommission;

    const dueDate = new Date();
    dueDate.setDate(
      dueDate.getDate() + billing.paymentDueDays
    );

    const invoice = await Invoice.create({
      parentId,
      childId,
      driverId,
      month,
      completedDays,
      totalDistance,
      ratePerKm: billing.ratePerKm,
      baseAmount,
      platformCommission,
      totalAmount,
      dueDate,
    });

    res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      data: invoice,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
