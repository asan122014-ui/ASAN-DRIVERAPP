import mongoose from "mongoose";

/* =========================================================
   CHILD SCHEMA
========================================================= */

const childSchema = new mongoose.Schema(
  {
    /* =====================================================
       CHILD INFO
    ===================================================== */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      default: null,
      min: 1,
      max: 25,
    },

    school: {
      type: String,
      default: "",
      trim: true,
    },

    grade: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================================================
       PARENT
    ===================================================== */

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* =====================================================
       DRIVER
    ===================================================== */

    /*
      Driver can be linked later.

      Keep String because your Driver model uses
      custom IDs such as:

      ASAN-9D0A01
    */

    driverId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    /* =====================================================
       RIDE STATUS
    ===================================================== */

    status: {
      type: String,

      enum: [
        "waiting",
        "onboard",
        "dropped",
        "absent",
      ],

      default: "waiting",
    },

    /* =====================================================
       PICKUP LOCATION COORDINATES
    ===================================================== */

    /*
      Keep this structure because your current Parent
      frontend/backend already uses:

      location.lat
      location.lng
    */

    location: {
      lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },

      lng: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },
    },

    /* =====================================================
       DROP LOCATION COORDINATES
    ===================================================== */

    /*
      Existing name kept intentionally:

      dropLocationCoords.lat
      dropLocationCoords.lng

      Do not rename it yet because the Parent UI already
      uses this field.
    */

    dropLocationCoords: {
      lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },

      lng: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },
    },

    /* =====================================================
       TIMINGS
    ===================================================== */

    pickupTime: {
      type: String,
      default: "",
      trim: true,
    },

    dropoffTime: {
      type: String,
      default: "",
      trim: true,
    },

    eveningPickup: {
      type: String,
      default: "",
      trim: true,
    },

    eveningDrop: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================================================
       ADDRESSES
    ===================================================== */

    pickupLocation: {
      type: String,
      default: "",
      trim: true,
    },

    dropoffLocation: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================================================
       ROUTE DETAILS
    ===================================================== */

    /*
      Distance can be stored in km.

      Duration can be stored in minutes.
    */

    routeDistance: {
      type: Number,
      default: 0,
      min: 0,
    },

    estimatedDuration: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* =====================================================
       BILLING
    ===================================================== */

    registrationFeePaid: {
      type: Boolean,
      default: false,
    },

    securityDeposit: {
      type: Number,
      default: 0,
      min: 0,
    },

    depositBalance: {
      type: Number,
      default: 0,
      min: 0,
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
   VALIDATE PICKUP COORDINATES
========================================================= */

/*
  Either BOTH latitude and longitude should exist,
  or BOTH should be null.

  Prevents data such as:

  lat: 17.38
  lng: null
*/

childSchema.pre(
  "validate",
  function () {
    const pickupLat =
      this.location?.lat;

    const pickupLng =
      this.location?.lng;

    const hasPickupLat =
      pickupLat !== null &&
      pickupLat !== undefined;

    const hasPickupLng =
      pickupLng !== null &&
      pickupLng !== undefined;

    if (
      hasPickupLat !==
      hasPickupLng
    ) {
      this.invalidate(
        "location",
        "Pickup latitude and longitude must be provided together"
      );
    }

    /* =====================================================
       DROP COORDINATES
    ===================================================== */

    const dropLat =
      this.dropLocationCoords?.lat;

    const dropLng =
      this.dropLocationCoords?.lng;

    const hasDropLat =
      dropLat !== null &&
      dropLat !== undefined;

    const hasDropLng =
      dropLng !== null &&
      dropLng !== undefined;

    if (
      hasDropLat !==
      hasDropLng
    ) {
      this.invalidate(
        "dropLocationCoords",
        "Drop latitude and longitude must be provided together"
      );
    }
  }
);

/* =========================================================
   JSON TRANSFORM
========================================================= */

childSchema.set(
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

childSchema.set(
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
   STATIC — GET CHILDREN BY PARENT
========================================================= */

childSchema.statics.findByParent =
  function (parentId) {
    return this.find({
      parentId,
    }).sort({
      createdAt: 1,
    });
  };

/* =========================================================
   STATIC — GET CHILDREN BY DRIVER
========================================================= */

childSchema.statics.findByDriver =
  function (driverId) {
    if (!driverId) {
      return [];
    }

    return this.find({
      driverId:
        String(driverId)
          .trim()
          .toUpperCase(),
    });
  };

/* =========================================================
   MODEL
========================================================= */

const Child =
  mongoose.model(
    "Child",
    childSchema
  );

export default Child;
