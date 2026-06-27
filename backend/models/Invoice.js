import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Students",
      required: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    month: {
      type: String,
      required: true, // Example: "2026-07"
    },

    completedDays: {
      type: Number,
      default: 0,
    },

    totalDistance: {
      type: Number,
      default: 0, // in KM
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

/* Prevent duplicate invoices for the same child and month */
invoiceSchema.index(
  { childId: 1, month: 1 },
  { unique: true }
);

export default mongoose.model("Invoice", invoiceSchema);
