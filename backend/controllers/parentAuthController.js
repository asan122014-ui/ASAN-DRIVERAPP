import Parent from "../models/Parent.js";

/* =========================================================
   HELPERS
========================================================= */

/*
  Firebase normally returns phone numbers in E.164 format:

  +918309649713

  For NEW Parent accounts we store that verified format.

  Existing Parent accounts may still have:
  8309649713

  Parent.findByPhone() already handles both formats.
*/

const normalizeFirebasePhone = (phone) => {
  if (!phone) {
    return null;
  }

  let value = String(phone).trim();

  /*
    Remove spaces, brackets and hyphens,
    but preserve the leading +.
  */

  value = value.replace(
    /[\s()-]/g,
    ""
  );

  /*
    Firebase Phone Auth should normally already
    provide E.164.

    This fallback handles a 10-digit Indian number
    if one somehow reaches this controller.
  */

  if (/^\d{10}$/.test(value)) {
    return `+91${value}`;
  }

  if (/^91\d{10}$/.test(value)) {
    return `+${value}`;
  }

  return value;
};

/* =========================================================
   VALIDATE LOCATION
========================================================= */

const validateCoordinates = (
  latitude,
  longitude
) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

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
    latitude: lat,
    longitude: lng,
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
    - password
    - firebaseUid
    - __v
  */

  return parent.toJSON();
};

/* =========================================================
   FIREBASE PARENT LOGIN
========================================================= */

/*
  Flow:

  Firebase OTP verified on frontend
            ↓
  Firebase ID token sent in Authorization header
            ↓
  verifyFirebaseToken middleware
            ↓
  req.firebaseUser
            ↓
  This controller
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

      if (!uid || !phone) {
        return res.status(401).json({
          success: false,
          message:
            "Verified Firebase user not found",
        });
      }

      const verifiedPhone =
        normalizeFirebasePhone(
          phone
        );

      if (!verifiedPhone) {
        return res.status(400).json({
          success: false,
          message:
            "Verified phone number not found",
        });
      }

      /* ===================================================
         1. LOOKUP BY FIREBASE UID
      =================================================== */

      let parent =
        await Parent.findByFirebaseUid(
          uid
        );

      if (parent) {
        if (!parent.isActive) {
          return res.status(403).json({
            success: false,
            message:
              "Parent account is inactive",
          });
        }

        return res.status(200).json({
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
         2. MIGRATE EXISTING PASSWORD ACCOUNT
      =================================================== */

      /*
        Example:

        Old MongoDB:
        phone = 8309649713

        Firebase:
        phone = +918309649713

        Parent.findByPhone() checks both forms.
      */

      parent =
        await Parent.findByPhone(
          verifiedPhone
        );

      if (parent) {
        if (!parent.isActive) {
          return res.status(403).json({
            success: false,
            message:
              "Parent account is inactive",
          });
        }

        /*
          Attach Firebase UID.

          DO NOT overwrite the existing phone number yet.

          This avoids unnecessary changes to old accounts
          while Firebase authentication is being migrated.
        */

        parent.firebaseUid =
          uid;

        await parent.save();

        return res.status(200).json({
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
         3. NEW USER
      =================================================== */

      /*
        OTP is valid, but there is no Parent account yet.

        Frontend should now display the registration form.

        Do NOT create an incomplete Parent document here,
        because Parent requires name, email, address etc.
      */

      return res.status(200).json({
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
        "❌ FIREBASE PARENT LOGIN ERROR:",
        error
      );

      /*
        Duplicate firebaseUid should be extremely rare,
        but handle it safely.
      */

      if (
        error?.code ===
        11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This Firebase account is already linked to another Parent account",
        });
      }

      return res.status(500).json({
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

      if (!uid || !phone) {
        return res.status(401).json({
          success: false,
          message:
            "Verified Firebase user not found",
        });
      }

      const verifiedPhone =
        normalizeFirebasePhone(
          phone
        );

      if (!verifiedPhone) {
        return res.status(400).json({
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
      } = req.body;

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (
        !name?.trim() ||
        !email?.trim() ||
        !address?.trim() ||
        latitude === undefined ||
        longitude === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, email, address, latitude and longitude are required",
        });
      }

      /* ===================================================
         NORMALIZE EMAIL
      =================================================== */

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      /* ===================================================
         SIMPLE EMAIL VALIDATION
      =================================================== */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
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
        return res.status(400).json({
          success: false,
          message:
            location.message,
        });
      }

      /* ===================================================
         CHECK FIREBASE UID
      =================================================== */

      const firebaseParent =
        await Parent.findByFirebaseUid(
          uid
        );

      if (firebaseParent) {
        return res.status(409).json({
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
         CHECK PHONE
      =================================================== */

      const existingPhoneParent =
        await Parent.findByPhone(
          verifiedPhone
        );

      /*
        This can happen when an old password-based Parent
        verifies Firebase OTP and directly calls register
        instead of calling login first.

        Rather than creating a duplicate Parent, migrate
        the existing account.
      */

      if (
        existingPhoneParent
      ) {
        if (
          !existingPhoneParent.isActive
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Parent account is inactive",
          });
        }

        existingPhoneParent.firebaseUid =
          uid;

        await existingPhoneParent.save();

        return res.status(200).json({
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
         CHECK EMAIL
      =================================================== */

      const existingEmail =
        await Parent.findOne({
          email:
            normalizedEmail,
        });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "Email is already registered",
        });
      }

      /* ===================================================
         CREATE PARENT
      =================================================== */

      const parent =
        await Parent.create({
          firebaseUid:
            uid,

          name:
            name.trim(),

          email:
            normalizedEmail,

          /*
            IMPORTANT:

            Phone is NOT accepted from req.body.

            It comes only from the verified Firebase token.
          */

          phone:
            verifiedPhone,

          address:
            address.trim(),

          homeLocation: {
            type:
              "Point",

            coordinates: [
              location.longitude,
              location.latitude,
            ],
          },
        });

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(201).json({
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
        "❌ FIREBASE PARENT REGISTER ERROR:",
        error
      );

      /* ===================================================
         DUPLICATE MONGODB FIELD
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
          "email"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Email is already registered",
          });
        }

        if (
          duplicateField ===
          "phone"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Phone number is already registered",
          });
        }

        if (
          duplicateField ===
          "firebaseUid"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Firebase account is already registered",
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "Parent account already exists",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to register Parent",
      });
    }
  };
