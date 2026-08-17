import Parent from "../models/Parent.js";

/* =========================================================
   HELPERS
========================================================= */

/*
  Firebase normally returns phone numbers
  in E.164 format:

  +918309649713

  Existing Parent accounts may still contain:

  8309649713

  Parent.getPhoneVariants() handles both formats.
*/

const normalizeFirebasePhone = (phone) => {
  if (!phone) {
    return null;
  }

  let value =
    String(phone).trim();

  /*
    Remove spaces, brackets and hyphens,
    but preserve leading +.
  */

  value = value.replace(
    /[\s()-]/g,
    ""
  );

  /*
    Fallback for 10-digit Indian number.
  */

  if (/^\d{10}$/.test(value)) {
    return `+91${value}`;
  }

  /*
    Fallback for:

    918309649713
  */

  if (
    /^91\d{10}$/.test(value)
  ) {
    return `+${value}`;
  }

  return value;
};

/* =========================================================
   VALIDATE COORDINATES
========================================================= */

const validateCoordinates = (
  latitude,
  longitude
) => {
  const lat =
    Number(latitude);

  const lng =
    Number(longitude);

  /* =====================================================
     NUMERIC VALIDATION
  ===================================================== */

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return {
      valid: false,

      message:
        "Valid latitude and longitude are required",
    };
  }

  /* =====================================================
     LATITUDE
  ===================================================== */

  if (
    lat < -90 ||
    lat > 90
  ) {
    return {
      valid: false,

      message:
        "Latitude must be between -90 and 90",
    };
  }

  /* =====================================================
     LONGITUDE
  ===================================================== */

  if (
    lng < -180 ||
    lng > 180
  ) {
    return {
      valid: false,

      message:
        "Longitude must be between -180 and 180",
    };
  }

  return {
    valid: true,

    latitude:
      lat,

    longitude:
      lng,
  };
};

/* =========================================================
   SAFE PARENT RESPONSE
========================================================= */

const getSafeParent = (
  parent
) => {
  if (!parent) {
    return null;
  }

  /*
    Parent model's toJSON transform removes:

    firebaseUid
    __v
  */

  return parent.toJSON();
};

/* =========================================================
   FIND PARENT BY VERIFIED PHONE
========================================================= */

/*
  This helper explicitly selects firebaseUid because
  firebaseUid has:

  select: false

  in Parent.js.

  We need to see the UID during migration so an
  existing Parent account cannot be linked to
  two different Firebase accounts.
*/

const findParentByVerifiedPhone =
  async (phone) => {
    const phoneVariants =
      Parent.getPhoneVariants(
        phone
      );

    if (
      !phoneVariants.length
    ) {
      return null;
    }

    return Parent.findOne({
      phone: {
        $in:
          phoneVariants,
      },
    }).select(
      "+firebaseUid"
    );
  };

/* =========================================================
   CHECK FIREBASE LINK CONFLICT
========================================================= */

const hasFirebaseConflict = (
  parent,
  firebaseUid
) => {
  return Boolean(
    parent?.firebaseUid &&
      parent.firebaseUid !==
        firebaseUid
  );
};

/* =========================================================
   FIREBASE PARENT LOGIN
========================================================= */

/*
  FLOW:

  Firebase Phone OTP
        ↓
  OTP verified by Firebase
        ↓
  Frontend receives Firebase ID token
        ↓
  verifyFirebaseToken
        ↓
  req.firebaseUser
        ↓
  loginParentWithFirebase
*/

export const loginParentWithFirebase =
  async (req, res) => {
    try {
      /* ===================================================
         FIREBASE USER
      =================================================== */

      const {
        uid,
        phone,
      } =
        req.firebaseUser ||
        {};

      if (
        !uid ||
        !phone
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Verified Firebase user not found",
          });
      }

      /* ===================================================
         NORMALIZE VERIFIED PHONE
      =================================================== */

      const verifiedPhone =
        normalizeFirebasePhone(
          phone
        );

      if (!verifiedPhone) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Verified phone number not found",
          });
      }

      /* ===================================================
         1. FIND BY FIREBASE UID
      =================================================== */

      let parent =
        await Parent.findByFirebaseUid(
          uid
        );

      if (parent) {
        /* ===============================================
           ACTIVE STATUS
        =============================================== */

        if (!parent.isActive) {
          return res
            .status(403)
            .json({
              success: false,

              message:
                "Parent account is inactive",
            });
        }

        return res
          .status(200)
          .json({
            success: true,

            message:
              "Login successful",

            needsRegistration:
              false,

            data:
              getSafeParent(
                parent
              ),
          });
      }

      /* ===================================================
         2. FIND EXISTING ACCOUNT BY PHONE
      =================================================== */

      /*
        Example:

        MongoDB:

        8309649713

        Firebase:

        +918309649713

        We search all supported phone variants.
      */

      parent =
        await findParentByVerifiedPhone(
          verifiedPhone
        );

      if (parent) {
        /* ===============================================
           ACTIVE STATUS
        =============================================== */

        if (!parent.isActive) {
          return res
            .status(403)
            .json({
              success: false,

              message:
                "Parent account is inactive",
            });
        }

        /* ===============================================
           FIREBASE UID CONFLICT
        =============================================== */

        /*
          If this MongoDB Parent is already linked
          to another Firebase UID, do NOT replace it.
        */

        if (
          hasFirebaseConflict(
            parent,
            uid
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This Parent account is already linked to another Firebase account",
            });
        }

        /* ===============================================
           LINK FIREBASE UID
        =============================================== */

        parent.firebaseUid =
          uid;

        /*
          Keep the existing MongoDB phone value.

          We do not force migration from:

          8309649713

          to:

          +918309649713

          during login.
        */

        await parent.save();

        return res
          .status(200)
          .json({
            success: true,

            message:
              "Login successful",

            migratedToFirebase:
              true,

            needsRegistration:
              false,

            data:
              getSafeParent(
                parent
              ),
          });
      }

      /* ===================================================
         3. NEW FIREBASE USER
      =================================================== */

      /*
        Firebase authentication succeeded,
        but no Parent account exists yet.

        Frontend should now open Parent registration.
      */

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Phone verified. Complete registration.",

          needsRegistration:
            true,

          phone:
            verifiedPhone,
        });
    } catch (error) {
      console.error(
        "FIREBASE PARENT LOGIN ERROR:",
        error
      );

      /* ===================================================
         DUPLICATE FIREBASE UID
      =================================================== */

      if (
        error?.code ===
        11000
      ) {
        const duplicateField =
          Object.keys(
            error.keyPattern ||
              {}
          )[0];

        if (
          duplicateField ===
          "firebaseUid"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This Firebase account is already linked to another Parent account",
            });
        }

        if (
          duplicateField ===
          "phone"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Phone number is already registered",
            });
        }

        return res
          .status(409)
          .json({
            success: false,

            message:
              "Parent account already exists",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to login Parent",
        });
    }
  };

/* =========================================================
   FIREBASE PARENT REGISTRATION
========================================================= */

export const registerParentWithFirebase =
  async (req, res) => {
    try {
      /* ===================================================
         FIREBASE USER
      =================================================== */

      const {
        uid,
        phone,
      } =
        req.firebaseUser ||
        {};

      if (
        !uid ||
        !phone
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Verified Firebase user not found",
          });
      }

      /* ===================================================
         VERIFIED PHONE
      =================================================== */

      const verifiedPhone =
        normalizeFirebasePhone(
          phone
        );

      if (!verifiedPhone) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Verified phone number not found",
          });
      }

      /* ===================================================
         REGISTRATION DATA
      =================================================== */

      const {
        name,
        email,
        address,
        latitude,
        longitude,
      } =
        req.body || {};

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (
        !name?.trim?.() ||
        !email?.trim?.() ||
        !address?.trim?.() ||
        latitude ===
          undefined ||
        longitude ===
          undefined
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Name, email, address, latitude and longitude are required",
          });
      }

      /* ===================================================
         NORMALIZE INPUT
      =================================================== */

      const normalizedName =
        String(name).trim();

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const normalizedAddress =
        String(address).trim();

      /* ===================================================
         EMAIL VALIDATION
      =================================================== */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Enter a valid email address",
          });
      }

      /* ===================================================
         LOCATION VALIDATION
      =================================================== */

      const location =
        validateCoordinates(
          latitude,
          longitude
        );

      if (!location.valid) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              location.message,
          });
      }

      /* ===================================================
         1. CHECK FIREBASE UID
      =================================================== */

      const firebaseParent =
        await Parent.findByFirebaseUid(
          uid
        );

      if (firebaseParent) {
        if (
          !firebaseParent.isActive
        ) {
          return res
            .status(403)
            .json({
              success: false,

              message:
                "Parent account is inactive",
            });
        }

        return res
          .status(409)
          .json({
            success: false,

            message:
              "Parent account already registered",

            needsRegistration:
              false,

            data:
              getSafeParent(
                firebaseParent
              ),
          });
      }

      /* ===================================================
         2. CHECK EXISTING PHONE
      =================================================== */

      const existingPhoneParent =
        await findParentByVerifiedPhone(
          verifiedPhone
        );

      /*
        This may happen when an existing Parent
        directly calls /register after Firebase
        verification instead of first calling /login.

        Do not create a duplicate account.

        Instead link the existing Parent safely.
      */

      if (
        existingPhoneParent
      ) {
        /* ===============================================
           ACTIVE STATUS
        =============================================== */

        if (
          !existingPhoneParent.isActive
        ) {
          return res
            .status(403)
            .json({
              success: false,

              message:
                "Parent account is inactive",
            });
        }

        /* ===============================================
           FIREBASE CONFLICT CHECK
        =============================================== */

        if (
          hasFirebaseConflict(
            existingPhoneParent,
            uid
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This Parent account is already linked to another Firebase account",
            });
        }

        /* ===============================================
           LINK FIREBASE
        =============================================== */

        existingPhoneParent.firebaseUid =
          uid;

        await existingPhoneParent.save();

        return res
          .status(200)
          .json({
            success: true,

            message:
              "Existing Parent account linked with Firebase successfully",

            migratedToFirebase:
              true,

            needsRegistration:
              false,

            data:
              getSafeParent(
                existingPhoneParent
              ),
          });
      }

      /* ===================================================
         3. CHECK EMAIL
      =================================================== */

      const existingEmail =
        await Parent.findOne({
          email:
            normalizedEmail,
        });

      if (existingEmail) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Email is already registered",
          });
      }

      /* ===================================================
         4. CREATE NEW PARENT
      =================================================== */

      /*
        SECURITY:

        Phone is NOT read from req.body.

        It comes exclusively from the Firebase
        verified authentication token.
      */

      const parent =
        await Parent.create({
          firebaseUid:
            uid,

          name:
            normalizedName,

          email:
            normalizedEmail,

          phone:
            verifiedPhone,

          address:
            normalizedAddress,

          homeLocation: {
            type:
              "Point",

            coordinates: [
              location.longitude,
              location.latitude,
            ],
          },

          isActive:
            true,
        });

      /* ===================================================
         SUCCESS
      =================================================== */

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Parent registered successfully",

          needsRegistration:
            false,

          data:
            getSafeParent(
              parent
            ),
        });
    } catch (error) {
      console.error(
        "FIREBASE PARENT REGISTER ERROR:",
        error
      );

      /* ===================================================
         MONGODB DUPLICATE
      =================================================== */

      if (
        error?.code ===
        11000
      ) {
        const duplicateField =
          Object.keys(
            error.keyPattern ||
              {}
          )[0];

        /* ===============================================
           EMAIL
        =============================================== */

        if (
          duplicateField ===
          "email"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Email is already registered",
            });
        }

        /* ===============================================
           PHONE
        =============================================== */

        if (
          duplicateField ===
          "phone"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Phone number is already registered",
            });
        }

        /* ===============================================
           FIREBASE UID
        =============================================== */

        if (
          duplicateField ===
          "firebaseUid"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Firebase account is already registered",
            });
        }

        return res
          .status(409)
          .json({
            success: false,

            message:
              "Parent account already exists",
          });
      }

      /* ===================================================
         MONGOOSE VALIDATION
      =================================================== */

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              error.message,
          });
      }

      /* ===================================================
         GENERAL ERROR
      =================================================== */

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to register Parent",
        });
    }
  };
