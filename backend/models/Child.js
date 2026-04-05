import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, default: null },
    school: { type: String, default: "" },
    grade: { type: String, default: "" },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true
    },

    driverId: {
      type: String,
      required: true,
      index: true
    },

    // ✅ FIXED
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped", "absent"],
      default: "waiting"
    },

    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },

    dropLocationCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },

    pickupTime: String,
    dropoffTime: String,
    eveningPickup: String,
    eveningDrop: String,

    // ✅ for showing place names
    pickupLocation: String,
    dropoffLocation: String
  },
  { timestamps: true }
);

export default mongoose.model("Child", childSchema);
