import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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

        /*
          GeoJSON format:

          [
            longitude,
            latitude
          ]
        */

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
              longitude >=
                -180 &&
              longitude <=
                180 &&
              latitude >=
                -90 &&
              latitude <=
                90
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

        set(
          value
        ) {
          return String(
            value || ""
          ).replace(
            /\D/g,
            ""
          );
        },

        validate: {
          validator(
            value
          ) {
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

        set(
          value
        ) {
          return String(
            value || ""
          )
            .trim()
            .toLowerCase();
        },

        validate: {
          validator(
            value
          ) {
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
        Driver authentication:

        Email
          +
        Password

        Password is never returned by normal queries.
        Login controller must explicitly use:

        .select("+password")
      */

      password: {
        type: String,
        required: true,

        minlength: [
          6,
          "Password must contain at least 6 characters",
        ],

        select: false,
      },

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

      /*
        Driver's registered home/base location.

        GeoJSON:

        {
          type: "Point",
          coordinates: [
            longitude,
            latitude
          ]
        }

        Do NOT default this to [0, 0].

        [0, 0] is a real geographic position and would
        incorrectly make an unknown Driver appear there.
      */

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

        set(
          value
        ) {
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

        set(
          value
        ) {
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

      /*
        Retained for compatibility with existing
        frontend/backend code.

        Later, if avatar and profilePhoto serve the
        same purpose, we can migrate to one field.
      */

      avatar: {
        type: String,
        default: "",
        trim: true,
      },

      /* =====================================================
         PUBLIC DRIVER IDENTIFIER
      ===================================================== */

      /*
        This is the Driver ID given to Parents.

        Example:

        ASAN-D00123

        Parent onboarding uses this value instead of
        MongoDB's _id.

        A pending Driver may not have a Driver ID yet,
        therefore sparse is retained.
      */

      driverId: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
        sparse: true,

        set(
          value
        ) {
          if (
            value ===
              null ||
            value ===
              undefined ||
            String(
              value
            ).trim() ===
              ""
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
         APPROVAL STATUS
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

      rejectionReason: {
        type: String,
        default: null,
        trim: true,
      },

      /* =====================================================
         FCM TOKENS
      ===================================================== */

      /*
        Driver may use multiple devices/sessions.

        Store Web/Android FCM registration tokens here.

        Firebase Authentication is NOT being used.
        Firebase remains only for Messaging / FCM.
      */

      fcmTokens: {
        type: [
          String,
        ],

        default: [],

        set(
          tokens
        ) {
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
                  (
                    token
                  ) =>
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

      /*
        Driver's current operational location.

        Used for:

        - nearby Driver queries
        - live trip operations
        - geospatial lookup

        GeoJSON:

        {
          type: "Point",
          coordinates: [
            longitude,
            latitude
          ]
        }

        No [0, 0] default is used.
      */

      location: {
        type:
          geoPointSchema,

        default:
          undefined,
      },

      /* =====================================================
         LAST LIVE LOCATION
      ===================================================== */

      /*
        Lightweight representation of the latest
        Driver location.

        This can be updated from:

        socket.emit("send_location")

        and used by Parent live tracking.
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

/*
  Current Driver location.
*/

driverSchema.index({
  location:
    "2dsphere",
});

/*
  Registered Driver home location.
*/

driverSchema.index({
  homeLocation:
    "2dsphere",
});

/*
  Operational Driver lookup.

  Useful for queries such as:

  approved
  +
  online
  +
  idle
*/

driverSchema.index({
  status:
    1,

  isOnline:
    1,

  currentStatus:
    1,
});

/* =========================================================
   PASSWORD HASHING
========================================================= */

driverSchema.pre(
  "save",
  async function () {
    /*
      Do not hash password again when some unrelated
      Driver field is updated.
    */

    if (
      !this.isModified(
        "password"
      )
    ) {
      return;
    }

    /*
      bcrypt cost factor 12 provides a reasonable
      security/performance balance for this application.
    */

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

driverSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {
    if (
      !enteredPassword ||
      !this.password
    ) {
      return false;
    }

    return bcrypt.compare(
      String(
        enteredPassword
      ),
      this.password
    );
  };

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

    /*
      GeoJSON location.
    */

    this.location = {
      type:
        "Point",

      coordinates: [
        longitude,
        latitude,
      ],
    };

    /*
      Lightweight live location.
    */

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
   STATIC — AUTHENTICATION LOOKUP
========================================================= */

/*
  Use this for Driver login because password has:

  select: false
*/

driverSchema.statics.findForAuthentication =
  function (
    email
  ) {
    const normalizedEmail =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();

    return this.findOne({
      email:
        normalizedEmail,
    }).select(
      "+password"
    );
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
    virtuals:
      true,

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
