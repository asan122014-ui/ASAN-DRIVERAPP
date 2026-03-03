import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true
    },

    password: {
      type: String,
      required: true
    },

    address: {
      type: String,
      required: true
    },

    vehicleNumber: {
      type: String,
      required: true
    },

    vehicleType: {
      type: String,
      required: true
    },

    licenseNumber: {
      type: String,
      required: true
    },

    // ✅ Cloudinary image URLs
    license: {
      type: String,
      required: true
    },

    rc: {
      type: String,
      required: true
    },

    insurance: {
      type: String,
      required: true
    },

    idImage: {
      type: String,
      required: true
    },

    // ✅ Unique Driver ID
    driverId: {
      type: String,
      unique: true
    },

    // ✅ Admin approval system
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    // Optional rejection reason
    rejectionReason: {
      type: String
    },

    rating: {
      type: Number,
      default: 0
    },

    totalTrips: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);
