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

    /* ================= DRIVER LINK ================= */
    driverId: {
      type: String,
      default: null,
    },

    /* ================= 🔥 FCM TOKENS (UPDATED) ================= */
    fcmTokens: {
      type: [String], // ✅ ARRAY for multiple devices
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* ================= HASH PASSWORD ================= */
parentSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/* ================= COMPARE PASSWORD ================= */
parentSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ================= EXPORT ================= */
const Parent = mongoose.model("Parent", parentSchema);
export default Parent;
