import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* =========================================================
   ADMIN SCHEMA
========================================================= */

const adminSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         EMAIL
      ===================================================== */

      email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
        match: [
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          "Enter a valid email address",
        ],
      },

      /* =====================================================
         PASSWORD
      ===================================================== */

      password: {
        type: String,
        required: true,
        minlength: 8,
        select: false,
      },

      /* =====================================================
         ROLE
      ===================================================== */

      role: {
        type: String,

        enum: [
          "superadmin",
          "reviewer",
        ],

        default: "reviewer",

        index: true,
      },

      /* =====================================================
         ACCOUNT STATUS
      ===================================================== */

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      /* =====================================================
         LAST LOGIN
      ===================================================== */

      lastLoginAt: {
        type: Date,
        default: null,
      },
    },

    {
      timestamps: true,

      toJSON: {
        virtuals: true,

        transform(
          doc,
          ret
        ) {
          delete ret.password;
          delete ret.__v;

          return ret;
        },
      },

      toObject: {
        virtuals: true,

        transform(
          doc,
          ret
        ) {
          delete ret.password;
          delete ret.__v;

          return ret;
        },
      },
    }
  );

/* =========================================================
   HASH PASSWORD
========================================================= */

adminSchema.pre(
  "save",
  async function () {
    if (
      !this.isModified(
        "password"
      )
    ) {
      return;
    }

    const salt =
      await bcrypt.genSalt(
        12
      );

    this.password =
      await bcrypt.hash(
        this.password,
        salt
      );
  }
);

/* =========================================================
   COMPARE PASSWORD
========================================================= */

adminSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {
    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

/* =========================================================
   FIND FOR LOGIN
========================================================= */

adminSchema.statics.findForAuthentication =
  function (
    email
  ) {
    return this.findOne({
      email: String(
        email || ""
      )
        .trim()
        .toLowerCase(),

      isActive: true,
    }).select(
      "+password"
    );
  };

/* =========================================================
   MODEL
========================================================= */

const Admin =
  mongoose.models.Admin ||
  mongoose.model(
    "Admin",
    adminSchema
  );

export default Admin;
