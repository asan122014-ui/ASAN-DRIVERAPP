import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const driverSchema = new mongoose.Schema(
  {
    /* ================= PERSONAL DETAILS ================= */

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6
    },

    address: {
      type: String,
      required: true
    },

    /* ================= VEHICLE DETAILS ================= */

    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true
    },

    vehicleType: {
      type: String,
      required: true
    },

    licenseNumber: {
      type: String,
      required: true
    },

    /* ================= DOCUMENTS ================= */

    licenseFront: {
      type: String,
      required: true
    },

    licenseBack: {
      type: String,
      required: true
    },

    rcFront: {
      type: String,
      required: true
    },

    rcBack: {
      type: String,
      required: true
    },

    insurance: {
      type: String,
      required: true
    },

    idFront: {
      type: String,
      required: true
    },

    idBack: {
      type: String,
      required: true
    },

    profilePhoto: {
      type: String,
      required: true
    },

    /* ================= SYSTEM FIELDS ================= */

    driverId: {
      type: String,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    rejectionReason: {
      type: String,
      default: null
    },

    fcmToken: {
      type: String,
      default: null
    },

    /* ================= PERFORMANCE ================= */

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
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
    },

    /* ================= DRIVER LOCATION ================= */

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    }
  },
  { timestamps: true }
);

/* ================= GEO INDEX ================= */

driverSchema.index({ location: "2dsphere" });

/* ================= HASH PASSWORD ================= */

driverSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

/* ================= PASSWORD COMPARE ================= */

driverSchema.methods.comparePassword = async function (enteredPassword) {

  return await bcrypt.compare(enteredPassword, this.password);

};

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
