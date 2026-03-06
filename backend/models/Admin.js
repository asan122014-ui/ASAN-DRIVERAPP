import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3
    },

    password: {
      type: String,
      required: true,
      minlength: 6
    },

    role: {
      type: String,
      enum: ["superadmin", "reviewer"],
      default: "reviewer"
    }
  },
  {
    timestamps: true
  }
);

/* ================= HASH PASSWORD BEFORE SAVE ================= */

adminSchema.pre("save", async function (next) {

  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(this.password, salt);

  next();

});

/* ================= PASSWORD COMPARISON ================= */

adminSchema.methods.comparePassword = async function (enteredPassword) {

  return await bcrypt.compare(enteredPassword, this.password);

};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
