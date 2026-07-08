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

    /* ================= PUSH TOKENS ================= */

    fcmTokens: {
      type: [String],
      default: [],
    },

    /* ================= STATUS ================= */

    isActive: {
      type: Boolean,
      default: true,
    },

    /* ================= PROFILE PHOTO ================= */
    profilePhoto: {
      type: String,
      default: null,
    },

    /* ================= REFERRAL CODE ================= */
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    /* ================= REFERRED BY ================= */
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
    },
  },
  {
    timestamps: true, // This automatically adds createdAt and updatedAt
  }
);

/* ================= INDEXES ================= */

parentSchema.index({
  homeLocation: "2dsphere",
});

parentSchema.index({
  driverId: 1,
});

parentSchema.index({
  email: 1,
});

parentSchema.index({
  phone: 1,
});

/* ================= HASH PASSWORD ================= */

parentSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    if (!this.password) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

/* ================= COMPARE PASSWORD ================= */

parentSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/* ================= VIRTUAL FIELDS ================= */

parentSchema.virtual("fullName").get(function () {
  return this.name;
});

/* ================= TO JSON TRANSFORM ================= */

parentSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

/* ================= STATIC METHODS ================= */

// Find parent by email
parentSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

// Find parent by phone
parentSchema.statics.findByPhone = function (phone) {
  return this.findOne({ phone: phone.trim() });
};

// Check if email exists
parentSchema.statics.emailExists = async function (email) {
  const count = await this.countDocuments({ email: email.toLowerCase().trim() });
  return count > 0;
};

// Check if phone exists
parentSchema.statics.phoneExists = async function (phone) {
  const count = await this.countDocuments({ phone: phone.trim() });
  return count > 0;
};

/* ================= VIRTUAL POPULATE ================= */

parentSchema.virtual("children", {
  ref: "Child",
  localField: "_id",
  foreignField: "parentId",
});

parentSchema.virtual("trips", {
  ref: "Trip",
  localField: "_id",
  foreignField: "parentId",
});

parentSchema.virtual("notifications", {
  ref: "Notification",
  localField: "_id",
  foreignField: "parentId",
});

parentSchema.virtual("driver", {
  ref: "Driver",
  localField: "driverId",
  foreignField: "driverId",
  justOne: true,
});

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
