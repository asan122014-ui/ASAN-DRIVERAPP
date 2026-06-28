import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const parentSchema = new mongoose.Schema(
  {
    /* ================= BASIC DETAILS ================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    /* ================= HOME ADDRESS ================= */

    address: {
      type: String,
      required: true,
      trim: true,
    },

    // GeoJSON location selected from map
    homeLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0],
      },
    },

    /* ================= DRIVER LINK ================= */

    driverId: {
      type: String,
      default: null,
      index: true,
    },

    /* ================= PUSH NOTIFICATIONS ================= */

    fcmTokens: {
      type: [String],
      default: [],
    },

    /* ================= STATUS ================= */

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

parentSchema.index({ homeLocation: "2dsphere" });
parentSchema.index({ driverId: 1 });

/* ================= HASH PASSWORD ================= */

parentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/* ================= COMPARE PASSWORD ================= */

parentSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
