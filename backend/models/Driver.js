import mongoose from "mongoose";

/* =========================================================
   REUSABLE GEO POINT SCHEMA
========================================================= */

const geoPointSchema =
  new mongoose.Schema(
    {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,

        validate: {
          validator(coordinates) {
            if (
              !Array.isArray(coordinates) ||
              coordinates.length !== 2
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
            "Location must contain valid [longitude, latitude] coordinates",
        },
      },
    },
    {
      _id: false,
    }
  );

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

        minlength: [
          2,
          "Driver name must contain at least 2 characters",
        ],

        maxlength: [
          100,
          "Driver name is too long",
        ],
      },

      phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,

        set(value) {
          return String(
            value || ""
          ).replace(
            /\D/g,
            ""
          );
        },

        validate: {
          validator(value) {
            return /^[6-9]\d{9}$/.test(
              value
            );
          },

          message:
            "Enter a valid 10-digit Indian mobile number",
        },
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,

        set(value) {
          return String(
            value || ""
          )
            .trim()
            .toLowerCase();
        },

        validate: {
          validator(value) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              value
            );
          },

          message:
            "Enter a valid email address",
        },
      },

      /* =====================================================
         DRIVER AUTHENTICATION
      ===================================================== */

      /*
        Driver authentication is OTP-only.

        Email
          ↓
        OTP
          ↓
        OTP verification
          ↓
        Driver JWT

        No password is stored in this collection.
      */

      address: {
        type: String,
        required: true,
        trim: true,

        maxlength: [
          500,
          "Address is too long",
        ],
      },

      /* =====================================================
         HOME LOCATION
      ===================================================== */

      homeLocation: {
        type:
          geoPointSchema,

        default:
          undefined,
      },

      /* =====================================================
         VEHICLE DETAILS
      ===================================================== */

      vehicleNumber: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,

        set(value) {
          return String(
            value || ""
          )
            .trim()
            .toUpperCase()
            .replace(
              /\s+/g,
              ""
            );
        },
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
        uppercase: true,

        set(value) {
          return String(
            value || ""
          )
            .trim()
            .toUpperCase();
        },
      },

      vehicleModel: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         DRIVER DOCUMENTS
      ===================================================== */

      licenseFront: {
        type: String,
        required: true,
        trim: true,
      },

      licenseBack: {
        type: String,
        required: true,
        trim: true,
      },

      rcFront: {
        type: String,
        required: true,
        trim: true,
      },

      rcBack: {
        type: String,
        required: true,
        trim: true,
      },

      insurance: {
        type: String,
        required: true,
        trim: true,
      },

      idFront: {
        type: String,
        required: true,
        trim: true,
      },

      idBack: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         PROFILE IMAGE
      ===================================================== */

      profilePhoto: {
        type: String,
        default: "",
        trim: true,
      },

      profilePhotoPublicId: {
        type: String,
        default: "",
        trim: true,
      },

      avatar: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         PUBLIC DRIVER IDENTIFIER
      ===================================================== */

      driverId: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
        sparse: true,

        set(value) {
          if (
            value === null ||
            value === undefined ||
            String(
              value
            ).trim() === ""
          ) {
            return undefined;
          }

          return String(
            value
          )
            .trim()
            .toUpperCase();
        },
      },

      /* =====================================================
         APPROVAL / VERIFICATION STATUS
      ===================================================== */

      status: {
        type: String,

        enum: [
          "pending",
          "approved",
          "rejected",
        ],

        default:
          "pending",

        index:
          true,
      },

      /* =====================================================
         REJECTION REASON
      ===================================================== */

      rejectionReason: {
        type: String,

        default:
          null,

        trim:
          true,

        maxlength: [
          500,
          "Rejection reason must not exceed 500 characters",
        ],
      },

      /* =====================================================
         APPROVED AT
      ===================================================== */

      /*
        Exact approval timestamp.

        This should be used for Admin analytics
        instead of updatedAt.
      */

      approvedAt: {
        type: Date,

        default:
          null,

        index:
          true,
      },

      /* =====================================================
         REJECTED AT
      ===================================================== */

      /*
        Exact rejection timestamp.
      */

      rejectedAt: {
        type: Date,

        default:
          null,

        index:
          true,
      },

      /* =====================================================
         REVIEWED BY
      ===================================================== */

      /*
        Admin who made the latest approval
        or rejection decision.
      */

      reviewedBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Admin",

        default:
          null,

        index:
          true,
      },

      /* =====================================================
         FCM TOKENS
      ===================================================== */

      fcmTokens: {
        type: [
          String,
        ],

        default: [],

        set(tokens) {
          if (
            !Array.isArray(
              tokens
            )
          ) {
            return [];
          }

          return [
            ...new Set(
              tokens
                .map(
                  (token) =>
                    String(
                      token || ""
                    ).trim()
                )
                .filter(
                  Boolean
                )
            ),
          ];
        },
      },

      /* =====================================================
         DRIVER PERFORMANCE
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
         CURRENT GEO LOCATION
      ===================================================== */

      location: {
        type:
          geoPointSchema,

        default:
          undefined,
      },

      /* =====================================================
         LAST LIVE LOCATION
      ===================================================== */

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

        default:
          "offline",

        index:
          true,
      },
    },

    {
      timestamps:
        true,

      toJSON: {
        virtuals:
          true,
      },

      toObject: {
        virtuals:
          true,
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

driverSchema.index({
  location:
    "2dsphere",
});

driverSchema.index({
  homeLocation:
    "2dsphere",
});

driverSchema.index({
  status:
    1,

  isOnline:
    1,

  currentStatus:
    1,
});

/* =========================================================
   ADMIN REVIEW INDEX
========================================================= */

driverSchema.index({
  reviewedBy:
    1,

  status:
    1,

  createdAt:
    -1,
});

/* =========================================================
   APPROVAL ANALYTICS INDEX
========================================================= */

driverSchema.index({
  approvedAt:
    -1,

  status:
    1,
});

/* =========================================================
   REJECTION ANALYTICS INDEX
========================================================= */

driverSchema.index({
  rejectedAt:
    -1,

  status:
    1,
});

/* =========================================================
   ADD FCM TOKEN
========================================================= */

driverSchema.methods.addFcmToken =
  function (
    token
  ) {
    const normalizedToken =
      String(
        token || ""
      ).trim();

    if (
      !normalizedToken
    ) {
      return;
    }

    if (
      !this.fcmTokens.includes(
        normalizedToken
      )
    ) {
      this.fcmTokens.push(
        normalizedToken
      );
    }
  };

/* =========================================================
   REMOVE FCM TOKEN
========================================================= */

driverSchema.methods.removeFcmToken =
  function (
    token
  ) {
    const normalizedToken =
      String(
        token || ""
      ).trim();

    this.fcmTokens =
      this.fcmTokens.filter(
        (
          existingToken
        ) =>
          existingToken !==
          normalizedToken
      );
  };

/* =========================================================
   UPDATE LIVE LOCATION
========================================================= */

driverSchema.methods.updateLiveLocation =
  function ({
    lat,
    lng,
    eta = "--",
    speed = 0,
    heading = 0,
    accuracy = null,
  }) {
    const latitude =
      Number(
        lat
      );

    const longitude =
      Number(
        lng
      );

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      ) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error(
        "Invalid Driver location coordinates."
      );
    }

    this.location = {
      type:
        "Point",

      coordinates: [
        longitude,
        latitude,
      ],
    };

    this.lastLocation = {
      lat:
        latitude,

      lng:
        longitude,

      eta:
        String(
          eta || "--"
        ),

      speed:
        Math.max(
          0,
          Number(
            speed
          ) || 0
        ),

      heading:
        Math.min(
          360,
          Math.max(
            0,
            Number(
              heading
            ) || 0
          )
        ),

      accuracy:
        accuracy ===
          null ||
        accuracy ===
          undefined
          ? null
          : Math.max(
              0,
              Number(
                accuracy
              ) || 0
            ),

      updatedAt:
        new Date(),
    };
  };

/* =========================================================
   STATIC — FIND BY DRIVER ID
========================================================= */

driverSchema.statics.findByDriverId =
  function (
    driverId
  ) {
    const normalizedDriverId =
      String(
        driverId || ""
      )
        .trim()
        .toUpperCase();

    if (
      !normalizedDriverId
    ) {
      return null;
    }

    return this.findOne({
      driverId:
        normalizedDriverId,
    });
  };

/* =========================================================
   STATIC — FIND BY EMAIL
========================================================= */

/*
  Used by OTP authentication.

  No password needs to be selected.
*/

driverSchema.statics.findByEmail =
  function (
    email
  ) {
    const normalizedEmail =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedEmail
    ) {
      return null;
    }

    return this.findOne({
      email:
        normalizedEmail,
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
   STATIC — AVAILABLE DRIVERS
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
    virtuals:
      true,

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
   OBJECT CLEANUP
========================================================= */

driverSchema.set(
  "toObject",
  {
    virtuals:
      true,

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

const Driver =
  mongoose.models.Driver ||
  mongoose.model(
    "Driver",
    driverSchema
  );

export default Driver;
