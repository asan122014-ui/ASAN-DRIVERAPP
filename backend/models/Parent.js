import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* =========================================================
   PARENT SCHEMA
========================================================= */

const parentSchema = new mongoose.Schema(
  {
    /* =====================================================
       FIREBASE AUTHENTICATION
    ===================================================== */

    /*
      Firebase UID becomes the primary authentication
      identity for Parent accounts.

      sparse: true allows existing legacy Parent accounts
      to remain in MongoDB even if they do not yet have
      a firebaseUid.

      As soon as an old Parent successfully signs in
      through Firebase Phone Auth, we will attach the
      Firebase UID to that existing account.
    */

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
      IMPORTANT:

      Existing Parent accounts may currently store:

      8309649713

      while Firebase normally gives:

      +918309649713

      We are NOT enforcing an E.164 validator here yet
      because that could break existing Parent records.

      The Firebase authentication controller will handle
      phone normalization/migration safely.
    */

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    /* =====================================================
       LEGACY PASSWORD
    ===================================================== */

    /*
      Password authentication is being replaced by
      Firebase Phone OTP authentication.

      We are keeping this field TEMPORARILY so that:

      1. Existing Parent accounts remain compatible.
      2. Existing /parent/login does not immediately break.
      3. We can migrate Firebase authentication gradually.

      New Firebase-created parents will NOT require
      this field.

      After Firebase Parent authentication is completely
      tested, this field and the old password endpoints
      can be removed.
    */

    password: {
      type: String,
      required: false,
      minlength: 6,
      select: false,
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

        /*
          GeoJSON format:

          [
            longitude,
            latitude
          ]
        */

        required: true,
        default: [0, 0],
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
       REFERRAL CODE
    ===================================================== */

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    /* =====================================================
       REFERRED BY
    ===================================================== */

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
    },
  },

  {
    timestamps: true,

    /*
      Include virtual fields whenever we convert a Parent
      document into JSON or a plain object.
    */

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

/* =========================================================
   GEO INDEX
========================================================= */

parentSchema.index({
  homeLocation: "2dsphere",
});

/* =========================================================
   LEGACY PASSWORD HASHING
========================================================= */

/*
  TEMPORARY.

  This remains only while the old Parent password
  authentication routes still exist.

  Firebase-created Parent accounts will normally
  have no password, so this middleware simply exits.
*/

parentSchema.pre(
  "save",
  async function () {
    /*
      Password not changed / not provided.
    */

    if (
      !this.isModified(
        "password"
      )
    ) {
      return;
    }

    /*
      Firebase Parent account with no password.
    */

    if (!this.password) {
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
   LEGACY PASSWORD COMPARISON
========================================================= */

/*
  TEMPORARY compatibility method.

  This prevents the existing old /parent/login route
  from breaking while Firebase authentication is being
  added.

  Eventually this method will be removed.
*/

parentSchema.methods.comparePassword =
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
      enteredPassword,
      this.password
    );
  };

/* =========================================================
   VIRTUAL FIELDS
========================================================= */

parentSchema
  .virtual("fullName")
  .get(function () {
    return this.name;
  });

/* =========================================================
   JSON TRANSFORM
========================================================= */

parentSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform:
      function (
        doc,
        ret
      ) {
        /*
          Never expose password.
        */

        delete ret.password;

        /*
          Firebase UID is an internal authentication
          identifier. Frontend does not need it.
        */

        delete ret.firebaseUid;

        /*
          Remove MongoDB version key.
        */

        delete ret.__v;

        return ret;
      },
  }
);

/* =========================================================
   OBJECT TRANSFORM
========================================================= */

parentSchema.set(
  "toObject",
  {
    virtuals: true,

    transform:
      function (
        doc,
        ret
      ) {
        /*
          Prevent accidental exposure when controllers
          use parent.toObject().
        */

        delete ret.password;
        delete ret.firebaseUid;
        delete ret.__v;

        return ret;
      },
  }
);

/* =========================================================
   PHONE HELPERS
========================================================= */

/*
  Firebase returns phone numbers in E.164 format:

  +918309649713

  Older ASAN accounts may contain:

  8309649713

  These helpers allow the upcoming Firebase controller
  to safely migrate existing Indian Parent accounts.
*/

parentSchema.statics.getPhoneVariants =
  function (phone) {
    if (!phone) {
      return [];
    }

    const raw =
      String(phone).trim();

    const digits =
      raw.replace(
        /\D/g,
        ""
      );

    const variants =
      new Set();

    /*
      Original supplied value.
    */

    variants.add(raw);

    /*
      Digits-only representation.
    */

    if (digits) {
      variants.add(digits);
    }

    /*
      Indian Firebase E.164:
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
      email: String(email)
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
    });
  };

/* =========================================================
   CHECK EMAIL EXISTS
========================================================= */

parentSchema.statics.emailExists =
  async function (email) {
    if (!email) {
      return false;
    }

    const count =
      await this.countDocuments(
        {
          email:
            String(email)
              .trim()
              .toLowerCase(),
        }
      );

    return count > 0;
  };

/* =========================================================
   CHECK PHONE EXISTS
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
      await this.countDocuments(
        {
          phone: {
            $in: variants,
          },
        }
      );

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
  Your current Trip queries use:

  Trip.find({
    parent: parentId
  })

  Therefore foreignField must be "parent",
  not "parentId".
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

parentSchema.virtual(
  "notifications",
  {
    ref: "Notification",

    localField:
      "_id",

    foreignField:
      "parentId",
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
   MODEL
========================================================= */

const Parent =
  mongoose.model(
    "Parent",
    parentSchema
  );

export default Parent;
