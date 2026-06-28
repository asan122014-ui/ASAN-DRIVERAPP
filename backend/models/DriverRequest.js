import mongoose from "mongoose";

const driverRequestSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },

    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      default: null,
    },

    assignedDriverId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["Pending", "Assigned", "Rejected"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("DriverRequest", driverRequestSchema);
