import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const parentSchema = new mongoose.Schema(
  {
    /* ================= BASIC DETAILS ================= */
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // 🔒 hide password in queries
    },

    /* ================= DRIVER LINK ================= */
    driverId: {
      type: String, // ASAN Driver ID
      default: null
    }

  },
  { timestamps: true }
);

---

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

---

/* ================= COMPARE PASSWORD ================= */
parentSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

---

export default mongoose.model("Parent", parentSchema);
