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
      select: false // 🔒 don't send password in queries
    },

    /* ================= DRIVER LINK ================= */

    driverId: {
      type: String, // ASAN driver ID
      default: null
    }

  },
  {
    timestamps: true
  }
);

---

/* ================= HASH PASSWORD ================= */
parentSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

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

/* ================= EXPORT ================= */
const Parent = mongoose.model("Parent", parentSchema);
export default Parent;
