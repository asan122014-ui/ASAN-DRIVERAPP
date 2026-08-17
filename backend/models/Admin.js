import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* =========================================================
   ADMIN SCHEMA
========================================================= */

const adminSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         USERNAME
      ===================================================== */

      username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        index: true,
      },

      /* =====================================================
         PASSWORD
      ===================================================== */

      password: {
        type: String,
        required: true,
        minlength: 6,
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

        default:
          "reviewer",
      },
    },

    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
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
        10
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
  function (
    enteredPassword
  ) {
    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

/* =========================================================
   JSON CLEANUP
========================================================= */

adminSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.password;
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   OBJECT CLEANUP
========================================================= */

adminSchema.set(
  "toObject",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.password;
      delete ret.__v;

      return ret;
    },
  }
);

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
