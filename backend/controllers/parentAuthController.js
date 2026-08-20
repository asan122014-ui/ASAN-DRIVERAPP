import jwt from "jsonwebtoken";
import Parent from "../models/Parent.js";

/* =========================================================
   PHONE NORMALIZATION
========================================================= */

const normalizePhone = (
  phone
) => {
  if (!phone) {
    return null;
  }

  const value =
    String(phone)
      .trim()
      .replace(
        /[\s()-]/g,
        ""
      );

  if (
    /^\+\d{8,15}$/.test(
      value
    )
  ) {
    return value;
  }

  if (
    /^\d{10}$/.test(
      value
    )
  ) {
    return `+91${value}`;
  }

  if (
    /^91\d{10}$/.test(
      value
    )
  ) {
    return `+${value}`;
  }

  return null;
};

/* =========================================================
   LOCATION VALIDATION
========================================================= */

const validateCoordinates = (
  latitude,
  longitude
) => {
  const lat =
    Number(
      latitude
    );

  const lng =
    Number(
      longitude
    );

  if (
    !Number.isFinite(
      lat
    ) ||
    !Number.isFinite(
      lng
    )
  ) {
    return {
      valid:
        false,

      message:
        "Valid latitude and longitude are required",
    };
  }

  if (
    lat < -90 ||
    lat > 90
  ) {
    return {
      valid:
        false,

      message:
        "Latitude must be between -90 and 90",
    };
  }

  if (
    lng < -180 ||
    lng > 180
  ) {
    return {
      valid:
        false,

      message:
        "Longitude must be between -180 and 180",
    };
  }

  return {
    valid:
      true,

    latitude:
      lat,

    longitude:
      lng,
  };
};

/* =========================================================
   SAFE PARENT
========================================================= */

const getSafeParent = (
  parent
) => {
  if (!parent) {
    return null;
  }

  return parent.toJSON();
};

/* =========================================================
   CREATE PARENT JWT
========================================================= */

const createParentToken = (
  parent
) => {
  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      id:
        String(
          parent._id
        ),

      tokenType:
        "parent",
    },

    process.env.JWT_SECRET,

    {
      algorithm:
        "HS256",

      expiresIn:
        "7d",
    }
  );
};

/* =========================================================
   AUTH RESPONSE
========================================================= */

const sendAuthenticatedParent = (
  res,
  parent,
  statusCode = 200,
  message = "Login successful"
) => {
  const token =
    createParentToken(
      parent
    );

  return res
    .status(
      statusCode
    )
    .json({
      success:
        true,

      message,

      needsRegistration:
        false,

      token,

      data:
        getSafeParent(
          parent
        ),
    });
};

/* =========================================================
   LOGIN
========================================================= */

export const loginParent =
  async (
    req,
    res
  ) => {
    try {
      const {
        provider,
        phone,
      } =
        req.verifiedIdentity ||
        {};

      if (
        provider !==
          "phone.email" ||
        !phone
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Verified phone identity not found",
          });
      }

      const verifiedPhone =
        normalizePhone(
          phone
        );

      if (
        !verifiedPhone
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid verified phone number",
          });
      }

      const parent =
        await Parent.findByPhone(
          verifiedPhone
        );

      /* ===================================================
         NEW PARENT
      =================================================== */

      if (!parent) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "Phone verified. Complete registration.",

            needsRegistration:
              true,

            phone:
              verifiedPhone,
          });
      }

      /* ===================================================
         ACTIVE
      =================================================== */

      if (
        parent.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Parent account is inactive",
          });
      }

      return sendAuthenticatedParent(
        res,
        parent,
        200,
        "Login successful"
      );
    } catch (error) {
      console.error(
        "PARENT LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to login Parent",
        });
    }
  };

/* =========================================================
   REGISTER
========================================================= */

export const registerParent =
  async (
    req,
    res
  ) => {
    try {
      const {
        provider,
        phone,
      } =
        req.verifiedIdentity ||
        {};

      if (
        provider !==
          "phone.email" ||
        !phone
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Verified phone identity not found",
          });
      }

      const verifiedPhone =
        normalizePhone(
          phone
        );

      if (
        !verifiedPhone
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid verified phone number",
          });
      }

      const {
        name,
        email,
        address,
        latitude,
        longitude,
      } =
        req.body ||
        {};

      /* ===================================================
         REQUIRED
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
            success:
              false,

            message:
              "Name, email, address, latitude and longitude are required",
          });
      }

      const normalizedName =
        String(
          name
        ).trim();

      const normalizedEmail =
        String(
          email
        )
          .trim()
          .toLowerCase();

      const normalizedAddress =
        String(
          address
        ).trim();

      /* ===================================================
         EMAIL
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
            success:
              false,

            message:
              "Enter a valid email address",
          });
      }

      /* ===================================================
         LOCATION
      =================================================== */

      const location =
        validateCoordinates(
          latitude,
          longitude
        );

      if (
        !location.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              location.message,
          });
      }

      /* ===================================================
         EXISTING PHONE
      =================================================== */

      const existingPhoneParent =
        await Parent.findByPhone(
          verifiedPhone
        );

      if (
        existingPhoneParent
      ) {
        if (
          existingPhoneParent
            .isActive ===
          false
        ) {
          return res
            .status(403)
            .json({
              success:
                false,

              message:
                "Parent account is inactive",
            });
        }

        return sendAuthenticatedParent(
          res,
          existingPhoneParent,
          200,
          "Parent account already exists. Login successful."
        );
      }

      /* ===================================================
         EXISTING EMAIL
      =================================================== */

      const existingEmail =
        await Parent.findByEmail(
          normalizedEmail
        );

      if (
        existingEmail
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Email is already registered",
          });
      }

      /* ===================================================
         CREATE
      =================================================== */

      const parent =
        await Parent.create({
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

      return sendAuthenticatedParent(
        res,
        parent,
        201,
        "Parent registered successfully"
      );
    } catch (error) {
      console.error(
        "PARENT REGISTER ERROR:",
        error
      );

      /* ===================================================
         DUPLICATE
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
          return res
            .status(409)
            .json({
              success:
                false,

              message:
                "Email is already registered",
            });
        }

        if (
          duplicateField ===
          "phone"
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              message:
                "Phone number is already registered",
            });
        }

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Parent account already exists",
          });
      }

      /* ===================================================
         VALIDATION
      =================================================== */

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to register Parent",
        });
    }
  };
