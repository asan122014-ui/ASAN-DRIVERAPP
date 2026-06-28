import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    /* ================= PARENT ================= */
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* ================= CHILD ================= */
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
      index: true,
    },

    /* ================= DRIVER ================= */
    driverId: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= INVOICE INFO ================= */

    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    month: {
      type: String,
      required: true,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    /* ================= BILL ================= */

    completedDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDistance: {
      type: Number,
      default: 0,
      min: 0,
    },

    ratePerKm: {
      type: Number,
      required: true,
      min: 0,
    },

    baseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    platformCommission: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    /* ================= PAYMENT ================= */

    status: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Processing",
        "Overdue",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "Razorpay",
        "Cash",
        "UPI",
        "Card",
        "Net Banking",
        "Manual",
      ],
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Success",
        "Failed",
      ],
      default: "Pending",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    /* ================= RAZORPAY ================= */

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    /* ================= PDF ================= */

    pdfUrl: {
      type: String,
      default: null,
    },

    /* ================= EXTRA ================= */

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

invoiceSchema.index(
  {
    childId: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

invoiceSchema.index({
  parentId: 1,
  createdAt: -1,
});

invoiceSchema.index({
  status: 1,
  dueDate: 1,
});

export default mongoose.model("Invoice", invoiceSchema);
