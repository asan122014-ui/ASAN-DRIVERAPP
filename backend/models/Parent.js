import mongoose from "mongoose";

/* =========================================================
   PARENT SCHEMA
========================================================= */

const parentSchema = new mongoose.Schema(
  {
    /* =====================================================
       FIREBASE AUTHENTICATION
    ===================================================== */

    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      select: false,
    },

    /* =====================================================
       BASIC DETAILS
    ===================================================== */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    /*
      Parent phone numbers may exist in either form:

      8309649713
      +918309649713

      Firebase normally returns E.164 format.
    */

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    /* =====================================================
       HOME ADDRESS
    ===================================================== */

    address: {
      type: String,
      required: true,
      trim: true,
    },

    homeLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
        default: [0, 0],

        validate: {
          validator(value) {
            if (
              !Array.isArray(value) ||
              value.length !== 2
            ) {
              return false;
            }

            const [lng, lat] = value;

            return (
              Number.isFinite(lng) &&
              Number.isFinite(lat) &&
              lng >= -180 &&
              lng <= 180 &&
              lat >= -90 &&
              lat <= 90
            );
          },

          message:
            "Invalid home location coordinates",
        },
      },
    },

    /* =====================================================
       DRIVER LINK
    ===================================================== */

    driverId: {
      type: String,
      default: null,
      index: true,
      trim: true,
      uppercase: true,
    },

    /* =====================================================
       PUSH NOTIFICATION TOKENS
    ===================================================== */

    fcmTokens: {
      type: [String],
      default: [],
    },

    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

    isActive: {
      type: Boolean,
      default: true,
    },

    /* =====================================================
       PROFILE PHOTO
    ===================================================== */

    profilePhoto: {
      type: String,
      default: null,
    },

    /* =====================================================
       REFERRAL
    ===================================================== */

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },

    referredBy: {
      type:
        mongoose.Schema.Types.ObjectId,

      ref: "Parent",

      default: null,
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

parentSchema.index({
  homeLocation: "2dsphere",
});

/* =========================================================
   PHONE HELPERS
========================================================= */

parentSchema.statics.getPhoneVariants =
  function (phone) {
    if (!phone) {
      return [];
    }

    const raw =
      String(phone).trim();

    const digits =
      raw.replace(/\D/g, "");

    const variants =
      new Set();

    variants.add(raw);

    if (digits) {
      variants.add(digits);
    }

    /*
      Firebase Indian number:

      +91XXXXXXXXXX
    */

    if (
      digits.length === 12 &&
      digits.startsWith("91")
    ) {
      const nationalNumber =
        digits.slice(2);

      variants.add(
        nationalNumber
      );

      variants.add(
        `+91${nationalNumber}`
      );

      variants.add(
        `91${nationalNumber}`
      );
    }

    /*
      Existing 10-digit Indian number.
    */

    if (
      digits.length === 10
    ) {
      variants.add(digits);

      variants.add(
        `+91${digits}`
      );

      variants.add(
        `91${digits}`
      );
    }

    return Array.from(
      variants
    );
  };

/* =========================================================
   FIND BY EMAIL
========================================================= */

parentSchema.statics.findByEmail =
  function (email) {
    if (!email) {
      return null;
    }

    return this.findOne({
      email:
        String(email)
          .trim()
          .toLowerCase(),
    });
  };

/* =========================================================
   FIND BY PHONE
========================================================= */

parentSchema.statics.findByPhone =
  function (phone) {
    const variants =
      this.getPhoneVariants(
        phone
      );

    if (
      variants.length === 0
    ) {
      return null;
    }

    return this.findOne({
      phone: {
        $in: variants,
      },
    });
  };

/* =========================================================
   FIND BY FIREBASE UID
========================================================= */

parentSchema.statics.findByFirebaseUid =
  function (firebaseUid) {
    if (!firebaseUid) {
      return null;
    }

    return this.findOne({
      firebaseUid:
        String(
          firebaseUid
        ).trim(),
    }).select(
      "+firebaseUid"
    );
  };

/* =========================================================
   EMAIL EXISTS
========================================================= */

parentSchema.statics.emailExists =
  async function (email) {
    if (!email) {
      return false;
    }

    const count =
      await this.countDocuments({
        email:
          String(email)
            .trim()
            .toLowerCase(),
      });

    return count > 0;
  };

/* =========================================================
   PHONE EXISTS
========================================================= */

parentSchema.statics.phoneExists =
  async function (phone) {
    const variants =
      this.getPhoneVariants(
        phone
      );

    if (
      variants.length === 0
    ) {
      return false;
    }

    const count =
      await this.countDocuments({
        phone: {
          $in: variants,
        },
      });

    return count > 0;
  };

/* =========================================================
   CHILDREN VIRTUAL
========================================================= */

parentSchema.virtual(
  "children",
  {
    ref: "Child",

    localField:
      "_id",

    foreignField:
      "parentId",
  }
);

/* =========================================================
   TRIPS VIRTUAL
========================================================= */

/*
  Trip model uses:

  parent: ObjectId
*/

parentSchema.virtual(
  "trips",
  {
    ref: "Trip",

    localField:
      "_id",

    foreignField:
      "parent",
  }
);

/* =========================================================
   NOTIFICATIONS VIRTUAL
========================================================= */

/*
  Notification model uses:

  parent: ObjectId
*/

parentSchema.virtual(
  "notifications",
  {
    ref:
      "Notification",

    localField:
      "_id",

    foreignField:
      "parent",
  }
);

/* =========================================================
   DRIVER VIRTUAL
========================================================= */

parentSchema.virtual(
  "driver",
  {
    ref: "Driver",

    localField:
      "driverId",

    foreignField:
      "driverId",

    justOne: true,
  }
);

/* =========================================================
   JSON CLEANUP
========================================================= */

const cleanParent =
  (doc, ret) => {
    delete ret.firebaseUid;
    delete ret.__v;

    return ret;
  };

parentSchema.set(
  "toJSON",
  {
    virtuals: true,
    transform:
      cleanParent,
  }
);

parentSchema.set(
  "toObject",
  {
    virtuals: true,
    transform:
      cleanParent,
  }
);

/* =========================================================
   MODEL
========================================================= */

const Parent =
  mongoose.models.Parent ||
  mongoose.model(
    "Parent",
    parentSchema
  );

export default Parent;
