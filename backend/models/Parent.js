import mongoose from "mongoose";

/* =========================================================
   PARENT SCHEMA
========================================================= */

const parentSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         BASIC DETAILS
      ===================================================== */

      name: {
        type: String,
        required: true,
        trim: true,
      },

      /* =====================================================
         AUTHENTICATION EMAIL

         Parent authentication is now based on:

         Email
           ↓
         Resend OTP
           ↓
         ASAN Parent JWT

         Email is therefore the primary login identity.
      ===================================================== */

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      /* =====================================================
         PHONE

         Phone is profile/contact information only.

         It is NOT used for Parent authentication.
      ===================================================== */

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
          enum: [
            "Point",
          ],
          default:
            "Point",
        },

        coordinates: {
          type: [
            Number,
          ],

          required:
            true,

          default: [
            0,
            0,
          ],

          validate: {
            validator(
              value
            ) {
              if (
                !Array.isArray(
                  value
                ) ||
                value.length !==
                  2
              ) {
                return false;
              }

              const [
                lng,
                lat,
              ] =
                value;

              return (
                Number.isFinite(
                  lng
                ) &&
                Number.isFinite(
                  lat
                ) &&
                lng >=
                  -180 &&
                lng <=
                  180 &&
                lat >=
                  -90 &&
                lat <=
                  90
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
        type: [
          String,
        ],

        default:
          [],
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
          mongoose
            .Schema
            .Types
            .ObjectId,

        ref:
          "Parent",

        default:
          null,
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

parentSchema.index({
  homeLocation:
    "2dsphere",
});

/* =========================================================
   EMAIL NORMALIZER
========================================================= */

parentSchema.statics.normalizeEmail =
  function (
    email
  ) {
    if (!email) {
      return "";
    }

    return String(
      email
    )
      .trim()
      .toLowerCase();
  };

/* =========================================================
   FIND BY EMAIL
========================================================= */

parentSchema.statics.findByEmail =
  function (
    email
  ) {
    const normalizedEmail =
      this.normalizeEmail(
        email
      );

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
   EMAIL EXISTS
========================================================= */

parentSchema.statics.emailExists =
  async function (
    email
  ) {
    const normalizedEmail =
      this.normalizeEmail(
        email
      );

    if (
      !normalizedEmail
    ) {
      return false;
    }

    const count =
      await this.countDocuments({
        email:
          normalizedEmail,
      });

    return count >
      0;
  };

/* =========================================================
   PHONE HELPERS

   Phone is no longer an authentication identity.

   These helpers remain useful for:
   - duplicate checking
   - profile matching
   - admin workflows
========================================================= */

parentSchema.statics.getPhoneVariants =
  function (
    phone
  ) {
    if (!phone) {
      return [];
    }

    const raw =
      String(
        phone
      ).trim();

    const digits =
      raw.replace(
        /\D/g,
        ""
      );

    const variants =
      new Set();

    variants.add(
      raw
    );

    if (
      digits
    ) {
      variants.add(
        digits
      );
    }

    /* =====================================================
       INDIAN COUNTRY CODE FORMAT
    ===================================================== */

    if (
      digits.length ===
        12 &&
      digits.startsWith(
        "91"
      )
    ) {
      const nationalNumber =
        digits.slice(
          2
        );

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

    /* =====================================================
       10-DIGIT INDIAN NUMBER
    ===================================================== */

    if (
      digits.length ===
      10
    ) {
      variants.add(
        digits
      );

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
   FIND BY PHONE
========================================================= */

parentSchema.statics.findByPhone =
  function (
    phone
  ) {
    const variants =
      this.getPhoneVariants(
        phone
      );

    if (
      variants.length ===
      0
    ) {
      return null;
    }

    return this.findOne({
      phone: {
        $in:
          variants,
      },
    });
  };

/* =========================================================
   PHONE EXISTS
========================================================= */

parentSchema.statics.phoneExists =
  async function (
    phone
  ) {
    const variants =
      this.getPhoneVariants(
        phone
      );

    if (
      variants.length ===
      0
    ) {
      return false;
    }

    const count =
      await this.countDocuments({
        phone: {
          $in:
            variants,
        },
      });

    return count >
      0;
  };

/* =========================================================
   CHILDREN VIRTUAL
========================================================= */

parentSchema.virtual(
  "children",
  {
    ref:
      "Child",

    localField:
      "_id",

    foreignField:
      "parentId",
  }
);

/* =========================================================
   TRIPS VIRTUAL
========================================================= */

parentSchema.virtual(
  "trips",
  {
    ref:
      "Trip",

    localField:
      "_id",

    foreignField:
      "parent",
  }
);

/* =========================================================
   NOTIFICATIONS VIRTUAL
========================================================= */

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
    ref:
      "Driver",

    localField:
      "driverId",

    foreignField:
      "driverId",

    justOne:
      true,
  }
);

/* =========================================================
   JSON CLEANUP
========================================================= */

const cleanParent = (
  doc,
  ret
) => {
  delete ret.__v;

  return ret;
};

parentSchema.set(
  "toJSON",
  {
    virtuals:
      true,

    transform:
      cleanParent,
  }
);

parentSchema.set(
  "toObject",
  {
    virtuals:
      true,

    transform:
      cleanParent,
  }
);

/* =========================================================
   MODEL
========================================================= */

const Parent =
  mongoose.models
    .Parent ||
  mongoose.model(
    "Parent",
    parentSchema
  );

export default Parent;
