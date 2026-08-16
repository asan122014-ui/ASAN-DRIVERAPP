import mongoose from "mongoose";

import Invoice from "../models/Invoice.js";
import BillingSettings from "../models/BillingSettings.js";
import Child from "../models/Child.js";
import Trip from "../models/Trips.js";

import {
  calculateInvoice,
} from "../services/billingService.js";

/* =========================================================
   CONSTANTS
========================================================= */

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

const PAYMENT_METHOD_MAP = {
  manual: "Manual",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  "net banking": "Net Banking",
  netbanking: "Net Banking",
  razorpay: "Razorpay",
};

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(
    String(value)
  );

/* =========================================================
   VALIDATE MONTH
========================================================= */

/*
  Required format:

  YYYY-MM

  Example:

  2026-08
*/

const normalizeMonth = (month) => {
  const value = String(month || "")
    .trim();

  const regex =
    /^\d{4}-(0[1-9]|1[0-2])$/;

  if (!regex.test(value)) {
    const error = new Error(
      "Month must be in YYYY-MM format"
    );

    error.statusCode = 400;

    throw error;
  }

  return value;
};

/* =========================================================
   CURRENT MONTH — IST
========================================================= */

const getCurrentMonthIST = () => {
  const nowIST =
    new Date(
      Date.now() +
        IST_OFFSET_MS
    );

  return nowIST
    .toISOString()
    .slice(0, 7);
};

/* =========================================================
   MONTH RANGE — IST
========================================================= */

/*
  Converts:

  2026-08

  into UTC boundaries representing:

  01-Aug-2026 00:00 IST
  →
  01-Sep-2026 00:00 IST
*/

const getMonthRangeIST = (
  month
) => {
  const normalizedMonth =
    normalizeMonth(month);

  const [
    yearString,
    monthString,
  ] =
    normalizedMonth.split("-");

  const year =
    Number(yearString);

  const monthNumber =
    Number(monthString);

  const start =
    new Date(
      Date.UTC(
        year,
        monthNumber - 1,
        1,
        0,
        0,
        0,
        0
      ) -
        IST_OFFSET_MS
    );

  const end =
    new Date(
      Date.UTC(
        year,
        monthNumber,
        1,
        0,
        0,
        0,
        0
      ) -
        IST_OFFSET_MS
    );

  return {
    start,
    end,
  };
};

/* =========================================================
   IST DATE KEY
========================================================= */

const getISTDateKey = (
  date
) => {
  return new Date(
    new Date(date).getTime() +
      IST_OFFSET_MS
  )
    .toISOString()
    .slice(0, 10);
};

/* =========================================================
   COMPLETED SERVICE DAYS
========================================================= */

/*
  Your billing formula assumes:

  1 completed service day
  =
  Home → School
  +
  School → Home

  Therefore we count a day only when BOTH:

  morning trip   = completed
  afternoon trip = completed

  This prevents:

  Morning trip + Afternoon trip

  from incorrectly being counted as:

  2 completed days.
*/

const getCompletedServiceDays =
  async (
    childId,
    month
  ) => {
    const {
      start,
      end,
    } =
      getMonthRangeIST(month);

    const trips =
      await Trip.find({
        child:
          childId,

        status:
          "completed",

        startTime: {
          $gte: start,
          $lt: end,
        },
      })
        .select(
          "tripType startTime"
        )
        .lean();

    const serviceDays =
      new Map();

    for (
      const trip of trips
    ) {
      if (!trip.startTime) {
        continue;
      }

      const dateKey =
        getISTDateKey(
          trip.startTime
        );

      if (
        !serviceDays.has(
          dateKey
        )
      ) {
        serviceDays.set(
          dateKey,
          {
            morning: false,
            afternoon: false,
          }
        );
      }

      const day =
        serviceDays.get(
          dateKey
        );

      if (
        trip.tripType ===
        "morning"
      ) {
        day.morning =
          true;
      }

      if (
        trip.tripType ===
        "afternoon"
      ) {
        day.afternoon =
          true;
      }
    }

    let completedDays =
      0;

    for (
      const day of
      serviceDays.values()
    ) {
      if (
        day.morning &&
        day.afternoon
      ) {
        completedDays++;
      }
    }

    return completedDays;
  };

/* =========================================================
   INVOICE NUMBER
========================================================= */

/*
  We derive the invoice number using:

  billing month
  +
  Child MongoDB ObjectId

  This avoids the race condition caused by:

  Invoice.countDocuments() + 1
*/

const createInvoiceNumber = ({
  month,
  childId,
}) => {
  const monthPart =
    month.replace("-", "");

  const childPart =
    String(childId)
      .toUpperCase();

  return `INV-${monthPart}-${childPart}`;
};

/* =========================================================
   DUE DATE
========================================================= */

const createDueDate = (
  paymentDueDays
) => {
  const date =
    new Date();

  date.setDate(
    date.getDate() +
      Number(
        paymentDueDays
      )
  );

  return date;
};

/* =========================================================
   POPULATE INVOICE
========================================================= */

const populateInvoice =
  async (
    invoiceId
  ) => {
    return Invoice.findById(
      invoiceId
    )
      .populate(
        "parentId",
        "name email phone"
      )
      .populate(
        "childId",
        "name school grade pickupLocation dropoffLocation"
      );
  };

/* =========================================================
   ERROR HANDLER
========================================================= */

const handleError = (
  error,
  res,
  fallbackMessage
) => {
  console.error(
    fallbackMessage,
    error
  );

  if (
    error.statusCode
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success: false,
        message:
          error.message,
      });
  }

  if (
    error.name ===
    "CastError"
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Invalid ID",
      });
  }

  if (
    error.name ===
    "ValidationError"
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          error.message,
      });
  }

  if (
    error.code ===
    11000
  ) {
    return res
      .status(409)
      .json({
        success: false,

        message:
          "Invoice already exists",
      });
  }

  return res
    .status(500)
    .json({
      success: false,

      message:
        fallbackMessage,
    });
};

/* =========================================================
   GET ALL INVOICES — ADMIN
========================================================= */

export const getAllInvoices =
  async (
    req,
    res
  ) => {
    try {
      const invoices =
        await Invoice.find()
          .populate(
            "parentId",
            "name email phone"
          )
          .populate(
            "childId",
            "name school grade pickupLocation dropoffLocation"
          )
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,

          count:
            invoices.length,

          data:
            invoices,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to fetch invoices"
      );
    }
  };

/* =========================================================
   GET SINGLE INVOICE
========================================================= */

export const getInvoiceById =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } = req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Invoice ID",
          });
      }

      const invoice =
        await populateInvoice(
          id
        );

      if (!invoice) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Invoice not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data: invoice,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to fetch invoice"
      );
    }
  };

/* =========================================================
   GET PARENT INVOICES
========================================================= */

export const getParentInvoices =
  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
      } = req.params;

      if (
        !isValidObjectId(
          parentId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Parent ID",
          });
      }

      const invoices =
        await Invoice.findForParent(
          parentId
        );

      return res
        .status(200)
        .json({
          success: true,

          count:
            invoices.length,

          data:
            invoices,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to fetch parent invoices"
      );
    }
  };

/* =========================================================
   GET DRIVER INVOICES
========================================================= */

export const getDriverInvoices =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
      } = req.params;

      const normalizedDriverId =
        String(
          driverId || ""
        )
          .trim()
          .toUpperCase();

      if (
        !normalizedDriverId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      const invoices =
        await Invoice.findForDriver(
          normalizedDriverId
        );

      /*
        Populate after the static query.
      */

      await Invoice.populate(
        invoices,
        [
          {
            path:
              "childId",

            select:
              "name school grade pickupLocation dropoffLocation",
          },
          {
            path:
              "parentId",

            select:
              "name email phone",
          },
        ]
      );

      return res
        .status(200)
        .json({
          success: true,

          count:
            invoices.length,

          data:
            invoices,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to fetch driver invoices"
      );
    }
  };

/* =========================================================
   GENERATE SINGLE INVOICE
========================================================= */

/*
  Recommended request:

  {
    "childId": "...",
    "month": "2026-08"
  }

  parentId and driverId are intentionally derived
  from the Child record.

  The old frontend can still send those fields,
  but they are ignored.
*/

export const generateInvoice =
  async (
    req,
    res
  ) => {
    try {
      const {
        childId,
        month,
      } = req.body;

      /* ===================================================
         VALIDATE CHILD
      =================================================== */

      if (!childId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child ID is required",
          });
      }

      if (
        !isValidObjectId(
          childId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Child ID",
          });
      }

      /* ===================================================
         MONTH
      =================================================== */

      const normalizedMonth =
        normalizeMonth(
          month ||
            getCurrentMonthIST()
        );

      /* ===================================================
         BILLING SETTINGS
      =================================================== */

      const billing =
        await BillingSettings.getActive();

      if (!billing) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Active billing settings not found",
          });
      }

      /* ===================================================
         CHILD
      =================================================== */

      const child =
        await Child.findById(
          childId
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      /* ===================================================
         PARENT
      =================================================== */

      if (
        !child.parentId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child is not linked to a Parent",
          });
      }

      /* ===================================================
         DRIVER
      =================================================== */

      const driverId =
        String(
          child.driverId || ""
        )
          .trim()
          .toUpperCase();

      if (!driverId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child is not linked to a Driver",
          });
      }

      /* ===================================================
         DUPLICATE CHECK
      =================================================== */

      const existingInvoice =
        await Invoice.findOne({
          childId:
            child._id,

          month:
            normalizedMonth,
        });

      if (
        existingInvoice
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Invoice already generated for this child and month",

            data:
              existingInvoice,
          });
      }

      /* ===================================================
         COMPLETED SERVICE DAYS
      =================================================== */

      const completedDays =
        await getCompletedServiceDays(
          child._id,
          normalizedMonth
        );

      /* ===================================================
         ROUTE DISTANCE
      =================================================== */

      const oneWayDistance =
        Number(
          child.routeDistance ||
            0
        );

      if (
        completedDays > 0 &&
        (
          !Number.isFinite(
            oneWayDistance
          ) ||
          oneWayDistance <= 0
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child route distance is not configured",
          });
      }

      /* ===================================================
         BILL CALCULATION
      =================================================== */

      const bill =
        calculateInvoice({
          completedDays,

          oneWayDistance,

          ratePerKm:
            billing.ratePerKm,

          platformCommission:
            billing.platformCommission,

          minimumFare:
            billing.minimumFare,
        });

      /* ===================================================
         DUE DATE
      =================================================== */

      const dueDate =
        createDueDate(
          billing.paymentDueDays
        );

      /* ===================================================
         INVOICE NUMBER
      =================================================== */

      const invoiceNumber =
        createInvoiceNumber({
          month:
            normalizedMonth,

          childId:
            child._id,
        });

      /* ===================================================
         CREATE INVOICE
      =================================================== */

      const invoice =
        await Invoice.create({
          invoiceNumber,

          parentId:
            child.parentId,

          childId:
            child._id,

          driverId,

          month:
            normalizedMonth,

          generatedAt:
            new Date(),

          completedDays,

          totalDistance:
            bill.totalDistance,

          ratePerKm:
            bill.ratePerKm,

          baseAmount:
            bill.baseAmount,

          /*
            This stores the calculated
            commission amount.

            Example:
            ₹24

            NOT:
            2%
          */

          platformCommission:
            bill.platformCommission,

          totalAmount:
            bill.totalAmount,

          dueDate,

          status:
            "Pending",

          paymentStatus:
            "Pending",

          paymentMethod:
            null,
        });

      const populatedInvoice =
        await populateInvoice(
          invoice._id
        );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Invoice generated successfully",

          data:
            populatedInvoice,

          calculation: {
            completedDays:
              bill.completedDays,

            dailyDistance:
              bill.dailyDistance,

            totalDistance:
              bill.totalDistance,

            ratePerKm:
              bill.ratePerKm,

            rawBaseAmount:
              bill.rawBaseAmount,

            minimumFare:
              bill.minimumFare,

            minimumFareApplied:
              bill.minimumFareApplied,

            platformCommissionRate:
              bill.platformCommissionRate,

            platformCommissionAmount:
              bill.platformCommission,

            totalAmount:
              bill.totalAmount,
          },
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to generate invoice"
      );
    }
  };

/* =========================================================
   GENERATE MONTHLY INVOICES FOR ALL CHILDREN
========================================================= */

export const generateAllInvoices =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         MONTH
      =================================================== */

      const month =
        normalizeMonth(
          req.body.month ||
            getCurrentMonthIST()
        );

      /* ===================================================
         BILLING SETTINGS
      =================================================== */

      const billing =
        await BillingSettings.getActive();

      if (!billing) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Active billing settings not found",
          });
      }

      /* ===================================================
         CHILDREN
      =================================================== */

      const children =
        await Child.find();

      if (
        !children.length
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "No children found",
          });
      }

      let generated =
        0;

      let skipped =
        0;

      const skippedDetails =
        [];

      const createdInvoices =
        [];

      /* ===================================================
         GENERATE
      =================================================== */

      for (
        const child of
        children
      ) {
        try {
          /* =================================================
             PARENT
          ================================================= */

          if (
            !child.parentId
          ) {
            skipped++;

            skippedDetails.push({
              childId:
                child._id,

              childName:
                child.name,

              reason:
                "Parent not linked",
            });

            continue;
          }

          /* =================================================
             DRIVER
          ================================================= */

          const driverId =
            String(
              child.driverId ||
                ""
            )
              .trim()
              .toUpperCase();

          if (!driverId) {
            skipped++;

            skippedDetails.push({
              childId:
                child._id,

              childName:
                child.name,

              reason:
                "Driver not linked",
            });

            continue;
          }

          /* =================================================
             DUPLICATE
          ================================================= */

          const existingInvoice =
            await Invoice.exists({
              childId:
                child._id,

              month,
            });

          if (
            existingInvoice
          ) {
            skipped++;

            skippedDetails.push({
              childId:
                child._id,

              childName:
                child.name,

              reason:
                "Invoice already exists",
            });

            continue;
          }

          /* =================================================
             COMPLETED DAYS
          ================================================= */

          const completedDays =
            await getCompletedServiceDays(
              child._id,
              month
            );

          /* =================================================
             DISTANCE
          ================================================= */

          const oneWayDistance =
            Number(
              child.routeDistance ||
                0
            );

          if (
            completedDays >
              0 &&
            (
              !Number.isFinite(
                oneWayDistance
              ) ||
              oneWayDistance <=
                0
            )
          ) {
            skipped++;

            skippedDetails.push({
              childId:
                child._id,

              childName:
                child.name,

              reason:
                "Route distance not configured",
            });

            continue;
          }

          /* =================================================
             BILL
          ================================================= */

          const bill =
            calculateInvoice({
              completedDays,

              oneWayDistance,

              ratePerKm:
                billing.ratePerKm,

              platformCommission:
                billing.platformCommission,

              minimumFare:
                billing.minimumFare,
            });

          /* =================================================
             CREATE
          ================================================= */

          const invoice =
            await Invoice.create({
              invoiceNumber:
                createInvoiceNumber({
                  month,

                  childId:
                    child._id,
                }),

              parentId:
                child.parentId,

              childId:
                child._id,

              driverId,

              month,

              generatedAt:
                new Date(),

              completedDays,

              totalDistance:
                bill.totalDistance,

              ratePerKm:
                bill.ratePerKm,

              baseAmount:
                bill.baseAmount,

              platformCommission:
                bill.platformCommission,

              totalAmount:
                bill.totalAmount,

              dueDate:
                createDueDate(
                  billing.paymentDueDays
                ),

              status:
                "Pending",

              paymentStatus:
                "Pending",

              paymentMethod:
                null,
            });

          generated++;

          createdInvoices.push({
            invoiceId:
              invoice._id,

            invoiceNumber:
              invoice.invoiceNumber,

            childId:
              child._id,

            childName:
              child.name,

            completedDays,

            totalAmount:
              invoice.totalAmount,
          });
        } catch (
          childError
        ) {
          /*
            If another request created the same
            invoice simultaneously, treat the
            duplicate as skipped rather than
            failing the complete batch.
          */

          if (
            childError.code ===
            11000
          ) {
            skipped++;

            skippedDetails.push({
              childId:
                child._id,

              childName:
                child.name,

              reason:
                "Invoice already exists",
            });

            continue;
          }

          skipped++;

          skippedDetails.push({
            childId:
              child._id,

            childName:
              child.name,

            reason:
              childError.message ||
              "Invoice generation failed",
          });
        }
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Monthly invoice generation completed",

          month,

          generated,

          skipped,

          totalChildren:
            children.length,

          data:
            createdInvoices,

          skippedDetails,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to generate monthly invoices"
      );
    }
  };

/* =========================================================
   MARK INVOICE AS PAID
========================================================= */

export const markInvoicePaid =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } = req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Invoice ID",
          });
      }

      const invoice =
        await Invoice.findById(
          id
        );

      if (!invoice) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Invoice not found",
          });
      }

      /* ===================================================
         IDEMPOTENT RESPONSE
      =================================================== */

      if (
        invoice.status ===
          "Paid" &&
        invoice.paymentStatus ===
          "Success"
      ) {
        const populatedInvoice =
          await populateInvoice(
            invoice._id
          );

        return res
          .status(200)
          .json({
            success: true,

            message:
              "Invoice is already paid",

            data:
              populatedInvoice,
          });
      }

      /* ===================================================
         CANCELLED INVOICE
      =================================================== */

      if (
        invoice.status ===
        "Cancelled"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Cancelled invoice cannot be marked as paid",
          });
      }

      /* ===================================================
         PAYMENT METHOD
      =================================================== */

      const rawMethod =
        String(
          req.body
            .paymentMethod ||
            "Manual"
        )
          .trim()
          .toLowerCase();

      const paymentMethod =
        PAYMENT_METHOD_MAP[
          rawMethod
        ];

      if (!paymentMethod) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid payment method",
          });
      }

      /* ===================================================
         RAZORPAY SAFETY
      =================================================== */

      /*
        Do NOT mark a Razorpay invoice as paid merely
        because the frontend sends:

        razorpayPaymentId
        razorpayOrderId
        razorpaySignature

        The signature must first be cryptographically
        verified using the Razorpay secret.

        We will connect that verified payment flow
        separately.
      */

      if (
        paymentMethod ===
        "Razorpay"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Razorpay payments must be verified before marking the invoice as paid",
          });
      }

      /* ===================================================
         MARK PAID
      =================================================== */

      await invoice.markAsPaid(
        paymentMethod
      );

      const populatedInvoice =
        await populateInvoice(
          invoice._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Invoice marked as paid successfully",

          data:
            populatedInvoice,
        });
    } catch (error) {
      return handleError(
        error,
        res,
        "Failed to mark invoice as paid"
      );
    }
  };
