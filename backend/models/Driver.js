import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* =========================================================
   DRIVER SCHEMA
========================================================= */

const driverSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         PERSONAL DETAILS
      ===================================================== */

      name: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      /* =====================================================
         PASSWORD
      ===================================================== */

      /*
        KEEP FOR NOW.

        Driver authentication migration will be
        handled separately later.
      */

      password: {
        type: String,
        required: true,
        minlength: 6,
        select: false,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         HOME LOCATION
      ===================================================== */

      homeLocation: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },

        coordinates: {
          type: [Number],

          /*
            GeoJSON format:

            [longitude, latitude]
          */

          default: [0, 0],

          validate: {
            validator(
              coordinates
            ) {
              if (
                !Array.isArray(
                  coordinates
                ) ||
                coordinates.length !==
                  2
              ) {
                return false;
              }

              const [
                longitude,
                latitude,
              ] =
                coordinates.map(
                  Number
                );

              return (
                Number.isFinite(
                  longitude
                ) &&
                Number.isFinite(
                  latitude
                ) &&
                longitude >= -180 &&
                longitude <= 180 &&
                latitude >= -90 &&
                latitude <= 90
              );
            },

            message:
              "Home location must contain valid [longitude, latitude] coordinates",
          },
        },
      },

      /* =====================================================
         VEHICLE DETAILS
      ===================================================== */

      vehicleNumber: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },

      vehicleType: {
        type: String,
        required: true,
        trim: true,
      },

      licenseNumber: {
        type: String,
        required: true,
        trim: true,
      },

      vehicleModel: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         DOCUMENTS
      ===================================================== */

      licenseFront: {
        type: String,
        required: true,
      },

      licenseBack: {
        type: String,
        required: true,
      },

      rcFront: {
        type: String,
        required: true,
      },

      rcBack: {
        type: String,
        required: true,
      },

      insurance: {
        type: String,
        required: true,
      },

      idFront: {
        type: String,
        required: true,
      },

      idBack: {
        type: String,
        required: true,
      },

      profilePhoto: {
        type: String,
        default: "",
      },

      profilePhotoPublicId: {
        type: String,
        default: "",
      },

      avatar: {
        type: String,
        default: "",
      },

      /* =====================================================
         DRIVER IDENTIFIER
      ===================================================== */

      driverId: {
        type: String,
        unique: true,
        index: true,
        trim: true,
        uppercase: true,
        sparse: true,
      },

      /* =====================================================
         APPROVAL STATUS
      ===================================================== */

      status: {
        type: String,

        enum: [
          "pending",
          "approved",
          "rejected",
        ],

        default: "pending",
        index: true,
      },

      rejectionReason: {
        type: String,
        default: null,
        trim: true,
      },

      /* =====================================================
         FCM TOKENS
      ===================================================== */

      fcmTokens: {
        type: [String],
        default: [],
      },

      /* =====================================================
         PERFORMANCE
      ===================================================== */

      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      totalTrips: {
        type: Number,
        default: 0,
        min: 0,
      },

      todayTrips: {
        type: Number,
        default: 0,
        min: 0,
      },

      studentsAssigned: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         GEO LOCATION
      ===================================================== */

      /*
        This can be used for geospatial queries
        such as nearby Drivers.

        GeoJSON:

        [longitude, latitude]
      */

      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },

        coordinates: {
          type: [Number],
          default: [0, 0],

          validate: {
            validator(
              coordinates
            ) {
              if (
                !Array.isArray(
                  coordinates
                ) ||
                coordinates.length !==
                  2
              ) {
                return false;
              }

              const [
                longitude,
                latitude,
              ] =
                coordinates.map(
                  Number
                );

              return (
                Number.isFinite(
                  longitude
                ) &&
                Number.isFinite(
                  latitude
                ) &&
                longitude >= -180 &&
                longitude <= 180 &&
                latitude >= -90 &&
                latitude <= 90
              );
            },

            message:
              "Driver location must contain valid [longitude, latitude] coordinates",
          },
        },
      },

      /* =====================================================
         LAST LIVE LOCATION
      ===================================================== */

      /*
        This stores only the Driver's latest location.

        Updated from:

        socket.emit("send_location")
      */

      lastLocation: {
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

        eta: {
          type: String,
          default: "--",
          trim: true,
        },

        speed: {
          type: Number,
          default: 0,
          min: 0,
        },

        heading: {
          type: Number,
          default: 0,
          min: 0,
          max: 360,
        },

        accuracy: {
          type: Number,
          default: null,
          min: 0,
        },

        updatedAt: {
          type: Date,
          default: null,
        },
      },

      /* =====================================================
         ONLINE STATUS
      ===================================================== */

      isOnline: {
        type: Boolean,
        default: false,
        index: true,
      },

      /* =====================================================
         CURRENT DRIVER STATUS
      ===================================================== */

      currentStatus: {
        type: String,

        enum: [
          "idle",
          "on_trip",
          "offline",
        ],

        default: "idle",
        index: true,
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
  Current Driver location.
*/

driverSchema.index({
  location: "2dsphere",
});

/*
  Driver home location.
*/

driverSchema.index({
  homeLocation: "2dsphere",
});

/*
  Fast operational status lookup.
*/

driverSchema.index({
  status: 1,
  isOnline: 1,
  currentStatus: 1,
});

/* =========================================================
   HASH PASSWORD
========================================================= */

/*
  KEEP FOR NOW.

  Driver authentication will be migrated separately.
*/

driverSchema.pre(
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

driverSchema.methods.comparePassword =
  function (
    enteredPassword
  ) {
    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

/* =========================================================
   STATIC — FIND BY CUSTOM DRIVER ID
========================================================= */

driverSchema.statics.findByDriverId =
  function (
    driverId
  ) {
    return this.findOne({
      driverId:
        String(driverId)
          .trim()
          .toUpperCase(),
    });
  };

/* =========================================================
   STATIC — APPROVED DRIVERS
========================================================= */

driverSchema.statics.findApproved =
  function () {
    return this.find({
      status:
        "approved",
    });
  };

/* =========================================================
   STATIC — ONLINE APPROVED DRIVERS
========================================================= */

driverSchema.statics.findAvailable =
  function () {
    return this.find({
      status:
        "approved",

      isOnline:
        true,

      currentStatus:
        "idle",
    });
  };

/* =========================================================
   JSON CLEANUP
========================================================= */

driverSchema.set(
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

driverSchema.set(
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

const Driver =
  mongoose.models.Driver ||
  mongoose.model(
    "Driver",
    driverSchema
  );

export default Driver;
