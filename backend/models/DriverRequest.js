import mongoose from "mongoose";

/* =========================================================
   CONSTANTS
========================================================= */

const DRIVER_REQUEST_STATUSES = [
  "Pending",
  "Assigned",
  "Rejected",
];

/* =========================================================
   DRIVER REQUEST SCHEMA
========================================================= */

const driverRequestSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         PARENT
      ===================================================== */

      parentId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Parent",

        required: true,
      },

      /* =====================================================
         CHILD — OPTIONAL
      ===================================================== */

      /*
        null means the request can apply at Parent level.

        If childId is present, the request is specifically
        associated with that Child.
      */

      childId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Child",

        default: null,
      },

      /* =====================================================
         ASSIGNED DRIVER
      ===================================================== */

      /*
        Uses the custom Driver ID:

        ASAN-XXXXXX

        NOT the MongoDB Driver _id.
      */

      assignedDriverId: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },

      /* =====================================================
         STATUS
      ===================================================== */

      status: {
        type: String,

        enum:
          DRIVER_REQUEST_STATUSES,

        default:
          "Pending",
      },

      /* =====================================================
         ASSIGNED TIME
      ===================================================== */

      assignedAt: {
        type: Date,
        default: null,
      },

      /* =====================================================
         REJECTION REASON
      ===================================================== */

      rejectionReason: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         NOTES
      ===================================================== */

      notes: {
        type: String,
        default: "",
        trim: true,
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
   VALIDATION
========================================================= */

driverRequestSchema.pre(
  "validate",
  function () {
    /* =====================================================
       ASSIGNED REQUEST
    ===================================================== */

    if (
      this.status ===
      "Assigned"
    ) {
      if (
        !this.assignedDriverId
      ) {
        this.invalidate(
          "assignedDriverId",
          "Assigned Driver ID is required when request is assigned"
        );
      }

      /*
        If a controller changes status to Assigned
        but doesn't explicitly set assignedAt,
        set it automatically.
      */

      if (
        !this.assignedAt
      ) {
        this.assignedAt =
          new Date();
      }

      /*
        Assignment means it is no longer rejected.
      */

      this.rejectionReason =
        "";
    }

    /* =====================================================
       REJECTED REQUEST
    ===================================================== */

    if (
      this.status ===
      "Rejected"
    ) {
      /*
        A rejected request cannot retain
        an old Driver assignment.
      */

      this.assignedDriverId =
        "";

      this.assignedAt =
        null;
    }

    /* =====================================================
       PENDING REQUEST
    ===================================================== */

    if (
      this.status ===
      "Pending"
    ) {
      this.assignedDriverId =
        "";

      this.assignedAt =
        null;

      this.rejectionReason =
        "";
    }
  }
);

/* =========================================================
   INDEXES
========================================================= */

/*
  Admin request queue.
*/

driverRequestSchema.index({
  status: 1,
  createdAt: -1,
});

/*
  Parent request history.
*/

driverRequestSchema.index({
  parentId: 1,
  status: 1,
  createdAt: -1,
});

/*
  Child-specific request history.
*/

driverRequestSchema.index({
  childId: 1,
  status: 1,
  createdAt: -1,
});

/*
  Driver assignment lookup.
*/

driverRequestSchema.index({
  assignedDriverId: 1,
  status: 1,
  createdAt: -1,
});

/* =========================================================
   STATIC — PARENT REQUESTS
========================================================= */

driverRequestSchema.statics.findForParent =
  function (parentId) {
    return this.find({
      parentId,
    })
      .populate(
        "childId",
        "name school grade"
      )
      .sort({
        createdAt: -1,
      });
  };

/* =========================================================
   STATIC — PENDING REQUESTS
========================================================= */

driverRequestSchema.statics.findPending =
  function () {
    return this.find({
      status: "Pending",
    })
      .populate(
        "parentId",
        "name email phone address"
      )
      .populate(
        "childId",
        "name school grade"
      )
      .sort({
        createdAt: 1,
      });
  };

/* =========================================================
   STATIC — DRIVER ASSIGNMENTS
========================================================= */

driverRequestSchema.statics.findForDriver =
  function (driverId) {
    return this.find({
      assignedDriverId:
        String(driverId)
          .trim()
          .toUpperCase(),

      status:
        "Assigned",
    })
      .populate(
        "parentId",
        "name email phone address"
      )
      .populate(
        "childId",
        "name school grade"
      )
      .sort({
        assignedAt: -1,
      });
  };

/* =========================================================
   JSON TRANSFORM
========================================================= */

driverRequestSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   OBJECT TRANSFORM
========================================================= */

driverRequestSchema.set(
  "toObject",
  {
    virtuals: true,

    transform: function (
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

const DriverRequest =
  mongoose.models
    .DriverRequest ||
  mongoose.model(
    "DriverRequest",
    driverRequestSchema
  );

export default DriverRequest;
