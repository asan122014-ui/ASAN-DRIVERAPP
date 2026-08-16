import mongoose from "mongoose";

/* =========================================================
   CONSTANTS
========================================================= */

const INVOICE_STATUSES = [
  "Pending",
  "Paid",
  "Processing",
  "Overdue",
  "Cancelled",
];

const PAYMENT_METHODS = [
  "Razorpay",
  "Cash",
  "UPI",
  "Card",
  "Net Banking",
  "Manual",
];

const PAYMENT_STATUSES = [
  "Pending",
  "Success",
  "Failed",
];

/* =========================================================
   INVOICE SCHEMA
========================================================= */

const invoiceSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         PARENT
      ===================================================== */

      parentId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Parent",

        required: true,
      },

      /* =====================================================
         CHILD
      ===================================================== */

      childId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Child",

        required: true,
      },

      /* =====================================================
         DRIVER
      ===================================================== */

      driverId: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      /* =====================================================
         INVOICE NUMBER
      ===================================================== */

      invoiceNumber: {
        type: String,

        unique: true,
        sparse: true,

        trim: true,
        uppercase: true,

        default: null,
      },

      /* =====================================================
         BILLING MONTH
      ===================================================== */

      /*
        Existing String format is intentionally kept.

        We will inspect your invoice-generation code before
        enforcing a specific format such as:

        2026-08
      */

      month: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         GENERATED AT
      ===================================================== */

      generatedAt: {
        type: Date,
        default: Date.now,
      },

      /* =====================================================
         COMPLETED SERVICE DAYS
      ===================================================== */

      completedDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         TOTAL DISTANCE
      ===================================================== */

      /*
        Expected unit:

        kilometres
      */

      totalDistance: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         RATE PER KM SNAPSHOT
      ===================================================== */

      /*
        The rate is copied from BillingSettings when the
        invoice is generated.

        This keeps historical invoices unchanged even if
        the admin changes the rate later.
      */

      ratePerKm: {
        type: Number,
        required: true,
        min: 0,
      },

      /* =====================================================
         BASE AMOUNT
      ===================================================== */

      baseAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         PLATFORM COMMISSION
      ===================================================== */

      /*
        Kept unchanged for compatibility.

        We will determine from the billing service whether
        this stores:

        commission percentage

        OR

        calculated commission amount.
      */

      platformCommission: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         TOTAL AMOUNT
      ===================================================== */

      totalAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         DUE DATE
      ===================================================== */

      dueDate: {
        type: Date,
        required: true,
      },

      /* =====================================================
         INVOICE STATUS
      ===================================================== */

      status: {
        type: String,

        enum:
          INVOICE_STATUSES,

        default: "Pending",
      },

      /* =====================================================
         PAYMENT METHOD
      ===================================================== */

      paymentMethod: {
        type: String,

        enum:
          PAYMENT_METHODS,

        default: null,
      },

      /* =====================================================
         PAYMENT STATUS
      ===================================================== */

      paymentStatus: {
        type: String,

        enum:
          PAYMENT_STATUSES,

        default: "Pending",
      },

      /* =====================================================
         PAID DATE
      ===================================================== */

      paidAt: {
        type: Date,
        default: null,
      },

      /* =====================================================
         RAZORPAY
      ===================================================== */

      razorpayOrderId: {
        type: String,
        default: null,
        trim: true,
      },

      razorpayPaymentId: {
        type: String,
        default: null,
        trim: true,
      },

      razorpaySignature: {
        type: String,
        default: null,
        trim: true,
      },

      /* =====================================================
         PDF
      ===================================================== */

      pdfUrl: {
        type: String,
        default: null,
        trim: true,
      },

      /* =====================================================
         REMARKS
      ===================================================== */

      remarks: {
        type: String,
        default: "",
        trim: true,
      },
    },

    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

/*
  Only one invoice should exist for the same
  Child + billing month.
*/

invoiceSchema.index(
  {
    childId: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

/*
  Parent billing history.
*/

invoiceSchema.index({
  parentId: 1,
  createdAt: -1,
});

/*
  Driver invoice history.
*/

invoiceSchema.index({
  driverId: 1,
  createdAt: -1,
});

/*
  Pending / overdue invoice lookup.
*/

invoiceSchema.index({
  status: 1,
  dueDate: 1,
});

/* =========================================================
   VIRTUAL — IS PAID
========================================================= */

invoiceSchema.virtual(
  "isPaid"
).get(function () {
  return (
    this.status === "Paid" &&
    this.paymentStatus ===
      "Success"
  );
});

/* =========================================================
   VIRTUAL — IS OVERDUE
========================================================= */

invoiceSchema.virtual(
  "isOverdue"
).get(function () {
  if (
    this.status === "Paid" ||
    this.status ===
      "Cancelled"
  ) {
    return false;
  }

  if (!this.dueDate) {
    return false;
  }

  return (
    new Date() >
    this.dueDate
  );
});

/* =========================================================
   INSTANCE METHOD — MARK PAID
========================================================= */

invoiceSchema.methods.markAsPaid =
  async function (
    paymentMethod
  ) {
    this.status =
      "Paid";

    this.paymentStatus =
      "Success";

    this.paymentMethod =
      paymentMethod;

    this.paidAt =
      new Date();

    return this.save();
  };

/* =========================================================
   STATIC — PARENT INVOICES
========================================================= */

invoiceSchema.statics.findForParent =
  function (
    parentId
  ) {
    return this.find({
      parentId,
    })
      .populate(
        "childId",
        "name school grade"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   STATIC — CHILD INVOICES
========================================================= */

invoiceSchema.statics.findForChild =
  function (
    childId
  ) {
    return this.find({
      childId,
    }).sort({
      createdAt: -1,
    });
  };

/* =========================================================
   STATIC — DRIVER INVOICES
========================================================= */

invoiceSchema.statics.findForDriver =
  function (
    driverId
  ) {
    return this.find({
      driverId:
        String(driverId)
          .trim()
          .toUpperCase(),
    }).sort({
      createdAt: -1,
    });
  };

/* =========================================================
   JSON TRANSFORM
========================================================= */

invoiceSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   OBJECT TRANSFORM
========================================================= */

invoiceSchema.set(
  "toObject",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   MODEL
========================================================= */

const Invoice =
  mongoose.models.Invoice ||
  mongoose.model(
    "Invoice",
    invoiceSchema
  );

export default Invoice;
