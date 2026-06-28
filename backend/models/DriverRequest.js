import mongoose from "mongoose";

const driverRequestSchema = new mongoose.Schema(
  {
    /* ================= PARENT ================= */
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* ================= CHILD (OPTIONAL) ================= */
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      default: null,
    },

    /* ================= ASSIGNED DRIVER ================= */
    assignedDriverId: {
      type: String,
      default: "",
      index: true,
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["Pending", "Assigned", "Rejected"],
      default: "Pending",
      index: true,
    },

    /* ================= ASSIGNED TIME ================= */
    assignedAt: {
      type: Date,
      default: null,
    },

    /* ================= REJECTION ================= */
    rejectionReason: {
      type: String,
      default: "",
    },

    /* ================= NOTES ================= */
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

driverRequestSchema.index({
  status: 1,
  createdAt: -1,
});

driverRequestSchema.index({
  parentId: 1,
  status: 1,
});

export default mongoose.model(
  "DriverRequest",
  driverRequestSchema
);
