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
      select: false
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
/* ================= HASH PASSWORD ================= */
parentSchema.pre("save", function (next) {
  const user = this;

  if (!user.isModified("password")) return next();

  bcrypt.genSalt(10, (err, salt) => {
    if (err) return next(err);

    bcrypt.hash(user.password, salt, (err, hash) => {
      if (err) return next(err);

      user.password = hash;
      next();
    });
  });
});
/* ================= COMPARE PASSWORD ================= */
parentSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};
/* ================= EXPORT ================= */
const Parent = mongoose.model("Parent", parentSchema);
export default Parent;
