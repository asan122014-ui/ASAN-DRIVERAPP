import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    // ===== PERSONAL DETAILS =====
    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true,
      unique: true
    },

    email: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true
    },

    address: {
      type: String,
      required: true
    },

    // ===== VEHICLE DETAILS =====
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

    // ===== DOCUMENTS =====

    // Driving License
    licenseFront: {
      type: String,
      required: true
    },

    licenseBack: {
      type: String,
      required: true
    },

    // Vehicle RC
    rcFront: {
      type: String,
      required: true
    },

    rcBack: {
      type: String,
      required: true
    },

    // Insurance
    insurance: {
      type: String,
      required: true
    },

    // Government ID
    idFront: {
      type: String,
      required: true
    },

    idBack: {
      type: String,
      required: true
    },

    // Selfie verification photo
    profilePhoto: {
      type: String,
      required: true
    },

    // ===== DRIVER SYSTEM =====

    driverId: {
      type: String,
      unique: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    rejectionReason: {
      type: String
    },

    // ===== PERFORMANCE =====

    rating: {
      type: Number,
      default: 0
    },

    totalTrips: {
      type: Number,
      default: 0
    },

    todayTrips: {
      type: Number,
      default: 0
    },

    studentsAssigned: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);
