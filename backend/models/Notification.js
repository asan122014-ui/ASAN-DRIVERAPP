import mongoose from "mongoose";

/* =========================================================
   NOTIFICATION TYPES
========================================================= */

const NOTIFICATION_TYPES = [
  /* ================= STUDENT ================= */

  "pickup",
  "drop",

  "student_picked_up",
  "student_dropped",

  /* ================= TRIP ================= */

  "trip_start",
  "trip_started",

  "return_trip_started",

  "trip_end",
  "trip_ended",
  "trip_completed",

  "trip_delayed",
  "trip_cancelled",

  /* ================= LOCATION / PROGRESS ================= */

  "driver_arrived_pickup",
  "approaching_school",
  "driver_arrived_school",
  "approaching_home",

  /* ================= PAYMENT ================= */

  "payment_received",

  /* ================= PHOTO VERIFICATION ================= */

  "morning_drop_photo_uploaded",
  "morning_drop_verified",

  "afternoon_pickup_photo_uploaded",
  "afternoon_pickup_verified",

  /* ================= DRIVER REQUEST ================= */

  "driver_request_submitted",
  "driver_request_accepted",
  "driver_request_rejected",

  /* ================= DRIVER ASSIGNMENT ================= */

  "driver_assigned",
  "driver_changed",

  /* ================= LEGACY ================= */

  "delay",

  /* ================= OTHER ================= */

  "emergency",
  "general",
];

/* =========================================================
   NOTIFICATION SCHEMA
========================================================= */

const notificationSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         DRIVER
      ===================================================== */

      /*
        Driver is optional.

        Parent-only/Admin notifications should not be forced
        to contain a Driver ID.

        For normal transport notifications we still store the
        Driver ID because it is useful context.
      */

      driver: {
        type: String,
        default: null,
        trim: true,
      },

      /* =====================================================
         PARENT
      ===================================================== */

      parent: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Parent",

        default: null,
      },

      /* =====================================================
         CHILD
      ===================================================== */

      child: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Child",

        default: null,
      },

      /* =====================================================
         RECIPIENT TYPE
      ===================================================== */

      recipientType: {
        type: String,

        enum: [
          "parent",
          "driver",
        ],

        required: true,
      },

      /* =====================================================
         NOTIFICATION KEY
      ===================================================== */

      /*
        Stores the original application-level key.

        Examples:

        TRIP_STARTED
        CHILD_PICKED_UP
        DROPPED_AT_HOME
        PAYMENT_RECEIVED

        Existing records can safely have "" because this field
        is being introduced after notifications already existed.
      */

      notificationKey: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },

      /* =====================================================
         TITLE
      ===================================================== */

      title: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         MESSAGE
      ===================================================== */

      message: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         TYPE
      ===================================================== */

      type: {
        type: String,

        enum:
          NOTIFICATION_TYPES,

        default: "general",
      },

      /* =====================================================
         PRIORITY
      ===================================================== */

      priority: {
        type: String,

        enum: [
          "low",
          "medium",
          "high",
        ],

        default: "low",
      },

      /* =====================================================
         READ STATUS
      ===================================================== */

      read: {
        type: Boolean,
        default: false,
      },

      /* =====================================================
         READ TIME
      ===================================================== */

      readAt: {
        type: Date,
        default: null,
      },

      /* =====================================================
         EXTRA DATA
      ===================================================== */

      meta: {
        type:
          mongoose.Schema.Types.Mixed,

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
   VALIDATE RECIPIENT
========================================================= */

notificationSchema.pre(
  "validate",
  function () {
    /*
      Parent notification must have
      a Parent account.
    */

    if (
      this.recipientType ===
        "parent" &&
      !this.parent
    ) {
      this.invalidate(
        "parent",
        "Parent is required for parent notifications"
      );
    }

    /*
      Driver notification must have
      a Driver ID.
    */

    if (
      this.recipientType ===
        "driver" &&
      !this.driver
    ) {
      this.invalidate(
        "driver",
        "Driver ID is required for driver notifications"
      );
    }
  }
);

/* =========================================================
   INDEXES
========================================================= */

/*
  Driver notification feed
*/

notificationSchema.index({
  recipientType: 1,
  driver: 1,
  createdAt: -1,
});

/*
  Parent notification feed
*/

notificationSchema.index({
  recipientType: 1,
  parent: 1,
  createdAt: -1,
});

/*
  Parent unread notifications
*/

notificationSchema.index({
  parent: 1,
  read: 1,
  createdAt: -1,
});

/*
  Driver unread notifications
*/

notificationSchema.index({
  driver: 1,
  read: 1,
  createdAt: -1,
});

/*
  Child notification history
*/

notificationSchema.index({
  child: 1,
  createdAt: -1,
});

/*
  Notification key searches
*/

notificationSchema.index({
  notificationKey: 1,
  createdAt: -1,
});

/* =========================================================
   AUTO DELETE NOTIFICATIONS AFTER 4 DAYS
========================================================= */

/*
  MongoDB TTL index.

  Notification remains in database for 4 days from createdAt.

  read: true does NOT delete it.

  readAt is NOT used for expiry.

  4 days =
  4 * 24 * 60 * 60
  = 345600 seconds
*/

notificationSchema.index(
  {
    createdAt: 1,
  },
  {
    expireAfterSeconds:
      4 * 24 * 60 * 60,
  }
);

/* =========================================================
   INSTANCE METHOD — MARK AS READ
========================================================= */

notificationSchema.methods.markAsRead =
  async function () {
    if (!this.read) {
      this.read = true;

      this.readAt =
        new Date();

      await this.save();
    }

    return this;
  };

/* =========================================================
   STATIC — PARENT NOTIFICATIONS
========================================================= */

notificationSchema.statics.findForParent =
  function (
    parentId,
    limit = 50
  ) {
    return this.find({
      parent:
        parentId,

      recipientType:
        "parent",
    })
      .sort({
        createdAt: -1,
      })
      .limit(limit);
  };

/* =========================================================
   STATIC — DRIVER NOTIFICATIONS
========================================================= */

notificationSchema.statics.findForDriver =
  function (
    driverId,
    limit = 50
  ) {
    return this.find({
      driver:
        String(driverId)
          .trim()
          .toUpperCase(),

      recipientType:
        "driver",
    })
      .sort({
        createdAt: -1,
      })
      .limit(limit);
  };

/* =========================================================
   JSON TRANSFORM
========================================================= */

notificationSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform:
      function (
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

notificationSchema.set(
  "toObject",
  {
    virtuals: true,

    transform:
      function (
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

const Notification =
  mongoose.models
    .Notification ||
  mongoose.model(
    "Notification",
    notificationSchema
  );

export default Notification;
