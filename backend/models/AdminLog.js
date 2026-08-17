import mongoose from "mongoose";

/* =========================================================
   ADMIN LOG SCHEMA
========================================================= */

const adminLogSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         ADMIN
      ===================================================== */

      /*
        The authenticated Admin who performed
        the action.

        This will be supplied using:

        req.admin.id
      */

      adminId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Admin",

        required: true,
      },

      /* =====================================================
         ACTION
      ===================================================== */

      /*
        Examples:

        DRIVER_APPROVED
        DRIVER_REJECTED

        Kept as String instead of an enum so future
        Admin operations can add new audit actions
        without requiring a schema migration.
      */

      action: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      /* =====================================================
         DRIVER — OPTIONAL
      ===================================================== */

      driverId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Driver",

        default: null,
      },

      /* =====================================================
         MESSAGE
      ===================================================== */

      message: {
        type: String,
        trim: true,
        default: "",
      },

      /* =====================================================
         EXTRA AUDIT DATA
      ===================================================== */

      metadata: {
        type:
          mongoose.Schema.Types
            .Mixed,

        default: () => ({}),
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
   INDEXES
========================================================= */

/*
  Admin activity history.
*/

adminLogSchema.index({
  adminId: 1,
  createdAt: -1,
});

/*
  Actions performed on a particular Driver.
*/

adminLogSchema.index({
  driverId: 1,
  createdAt: -1,
});

/*
  Filter logs by action.
*/

adminLogSchema.index({
  action: 1,
  createdAt: -1,
});

/* =========================================================
   STATIC — ADMIN ACTIVITY
========================================================= */

adminLogSchema.statics.findForAdmin =
  function (adminId) {
    return this.find({
      adminId,
    })
      .populate(
        "driverId",
        "name driverId"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   STATIC — DRIVER ACTIVITY
========================================================= */

adminLogSchema.statics.findForDriver =
  function (driverId) {
    return this.find({
      driverId,
    })
      .populate(
        "adminId",
        "username role"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   JSON CLEANUP
========================================================= */

adminLogSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   MODEL
========================================================= */

const AdminLog =
  mongoose.models.AdminLog ||
  mongoose.model(
    "AdminLog",
    adminLogSchema
  );

export default AdminLog;
