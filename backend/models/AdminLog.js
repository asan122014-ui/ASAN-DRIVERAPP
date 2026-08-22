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
        Admin who performed the action.

        This will normally come from:

        req.admin._id
      */

      adminId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Admin",

        required: true,

        index: true,
      },

      /* =====================================================
         ACTION
      ===================================================== */

      /*
        Examples:

        DRIVER_APPROVED
        DRIVER_REJECTED
        DRIVER_UPDATED
        ADMIN_LOGIN
        ADMIN_LOGOUT
        STUDENT_CREATED
        STUDENT_UPDATED
        TRIP_UPDATED
      */

      action: {
        type: String,

        required: true,

        trim: true,

        uppercase: true,

        minlength: 3,

        maxlength: 100,

        index: true,
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

        index: true,
      },

      /* =====================================================
         MESSAGE
      ===================================================== */

      message: {
        type: String,

        trim: true,

        default: "",

        maxlength: 1000,
      },

      /* =====================================================
         EXTRA AUDIT DATA
      ===================================================== */

      /*
        This can later store:

        {
          previousStatus: "pending",
          newStatus: "approved",
          rejectionReason: "...",
          ipAddress: "...",
          userAgent: "..."
        }
      */

      metadata: {
        type:
          mongoose.Schema.Types
            .Mixed,

        default:
          () => ({}),
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
          delete ret.__v;

          return ret;
        },
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

/*
  Recent activity performed by an Admin.
*/

adminLogSchema.index({
  adminId: 1,
  createdAt: -1,
});

/*
  Complete audit history for a Driver.
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

/*
  Global latest Admin activity.
*/

adminLogSchema.index({
  createdAt: -1,
});

/* =========================================================
   STATIC — ADMIN ACTIVITY
========================================================= */

adminLogSchema.statics.findForAdmin =
  function (
    adminId
  ) {
    return this.find({
      adminId,
    })
      .populate(
        "adminId",
        "email role isActive"
      )
      .populate(
        "driverId",
        "name driverId email status"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   STATIC — DRIVER ACTIVITY
========================================================= */

adminLogSchema.statics.findForDriver =
  function (
    driverId
  ) {
    return this.find({
      driverId,
    })
      .populate(
        "adminId",
        "email role"
      )
      .populate(
        "driverId",
        "name driverId email status"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   STATIC — RECENT ACTIVITY
========================================================= */

adminLogSchema.statics.findRecent =
  function (
    limit = 50
  ) {
    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) ||
            50,
          1
        ),
        200
      );

    return this.find()
      .populate(
        "adminId",
        "email role"
      )
      .populate(
        "driverId",
        "name driverId email status"
      )
      .sort({
        createdAt: -1,
      })
      .limit(
        safeLimit
      );
  };

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
