import Invoice from "../models/Invoice.js";
import BillingSettings from "../models/BillingSettings.js";
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

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Get All Invoices:", error);

    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Get Invoice:", error);

    return res.status(500).json({
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
      .populate("childId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Parent Invoice:", error);

    return res.status(500).json({
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

    // Razorpay fields (optional)
    invoice.razorpayOrderId =
      req.body.razorpayOrderId || null;
    invoice.razorpayPaymentId =
      req.body.razorpayPaymentId || null;
    invoice.razorpaySignature =
      req.body.razorpaySignature || null;

    await invoice.save();

    const updatedInvoice = await Invoice.findById(invoice._id)
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
   GENERATE SINGLE INVOICE
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

    /* ================= COMPLETED TRIPS ================= */
    const completedDays = await Trip.countDocuments({
      child: child._id,
      status: "completed",
    });

    /* ================= BILL CALCULATION ================= */
    const bill = calculateInvoice({
      completedDays,
      oneWayDistance: Number(child.routeDistance || 0),
      ratePerKm: billing.ratePerKm,
      platformCommission: billing.platformCommission,
    });

    /* ================= DUE DATE ================= */
    const dueDate = new Date();
    dueDate.setDate(
      dueDate.getDate() + billing.paymentDueDays
    );

    /* ================= INVOICE NUMBER ================= */
    const invoiceCount = await Invoice.countDocuments();

    const invoiceNumber = `INV-${month.replace(
      "-",
      ""
    )}-${String(invoiceCount + 1).padStart(6, "0")}`;

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

    const populatedInvoice = await Invoice.findById(invoice._id)
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
    console.error("Invoice Generation Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/* ==================================================
   GENERATE MONTHLY INVOICES FOR ALL CHILDREN
================================================== */
export const generateAllInvoices = async (req, res) => {
  try {
    const month =
      req.body.month || new Date().toISOString().slice(0, 7);

    /* ================= BILLING SETTINGS ================= */
    const billing = await BillingSettings.findOne();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Billing settings not found",
      });
    }

    /* ================= GET ALL CHILDREN ================= */
    const children = await Child.find();

    if (children.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No children found",
      });
    }

    let generated = 0;
    let skipped = 0;

    /* ================= CURRENT INVOICE COUNT ================= */
    let invoiceCount = await Invoice.countDocuments();

    for (const child of children) {
      /* ================= DUPLICATE CHECK ================= */
      const existingInvoice = await Invoice.findOne({
        childId: child._id,
        month,
      });

      if (existingInvoice) {
        skipped++;
        continue;
      }

      /* ================= COMPLETED TRIPS ================= */
      const completedDays = await Trip.countDocuments({
        child: child._id,
        status: "completed",
      });

      /* ================= BILL CALCULATION ================= */
      const bill = calculateInvoice({
        completedDays,
        oneWayDistance: Number(child.routeDistance || 0),
        ratePerKm: billing.ratePerKm,
        platformCommission: billing.platformCommission,
      });

      /* ================= DUE DATE ================= */
      const dueDate = new Date();
      dueDate.setDate(
        dueDate.getDate() + billing.paymentDueDays
      );

      /* ================= INVOICE NUMBER ================= */
      invoiceCount++;

      const invoiceNumber = `INV-${month.replace(
        "-",
        ""
      )}-${String(invoiceCount).padStart(6, "0")}`;

      /* ================= CREATE INVOICE ================= */
      await Invoice.create({
        invoiceNumber,
        parentId: child.parentId,
        childId: child._id,
        driverId: child.driverId,

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

      generated++;
    }

    return res.status(200).json({
      success: true,
      message: "Monthly invoices generated successfully",
      generated,
      skipped,
      totalChildren: children.length,
    });
  } catch (error) {
    console.error("Generate All Invoices:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/* ==================================================
   GET DRIVER INVOICES
================================================== */
export const getDriverInvoices = async (req, res) => {
  try {
    const { driverId } = req.params;

    const invoices = await Invoice.find({ driverId })
      .populate("childId", "name school")
      .populate("parentId", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Driver Invoices:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
