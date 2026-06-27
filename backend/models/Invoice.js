import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    /* ================= PARENT ================= */

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },

    /* ================= CHILD ================= */

    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },

    /* ================= DRIVER ================= */

    driverId: {
      type: String,
      required: true,
    },

    /* ================= BILL ================= */

    month: {
      type: String,
      required: true,
    },

    completedDays: {
      type: Number,
      default: 0,
    },

    totalDistance: {
      type: Number,
      default: 0,
    },

    ratePerKm: {
      type: Number,
      required: true,
    },

    baseAmount: {
      type: Number,
      default: 0,
    },

    platformCommission: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
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
        "Overdue",
        "Cancelled",
      ],
      default: "Pending",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paymentMethod: {
      type: String,
      default: null,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* Prevent duplicate invoice for same child and month */

invoiceSchema.index(
  {
    childId: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("Invoice", invoiceSchema);
