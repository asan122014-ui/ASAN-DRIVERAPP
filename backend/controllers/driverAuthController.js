import jwt from "jsonwebtoken";

import Driver from "../models/Driver.js";

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   NORMALIZE EMAIL
========================================================= */

const normalizeEmail = (
  value
) => {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
};

/* =========================================================
   VALIDATE EMAIL
========================================================= */

const isValidEmail = (
  value
) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(
      value
    )
  );
};

/* =========================================================
   CREATE DRIVER JWT
========================================================= */

/*
  Driver JWT structure:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }

  IMPORTANT:

  We intentionally do NOT put driverId,
  email or approval status inside the token.

  Those values may change.

  MongoDB _id remains the actual account identity.
*/

const createDriverToken = (
  driver
) => {
  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  if (
    !driver?._id
  ) {
    throw new Error(
      "Driver account ID is missing"
    );
  }

  return jwt.sign(
    {
      id:
        String(
          driver._id
        ),

      tokenType:
        "driver",
    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        "7d",

      algorithm:
        "HS256",
    }
  );
};

/* =========================================================
   SAFE DRIVER RESPONSE
========================================================= */

const getSafeDriver = (
  driver
) => {
  if (
    !driver
  ) {
    return null;
  }

  const data =
    typeof driver.toObject ===
    "function"
      ? driver.toObject()
      : {
          ...driver,
        };

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   DRIVER STATUS INFORMATION
========================================================= */

const getDriverStatusInfo = (
  driver
) => {
  /* =====================================================
     APPROVED
  ===================================================== */

  if (
    driver.status ===
    "approved"
  ) {
    return {
      status:
        "approved",

      code:
        "DRIVER_APPROVED",

      nextStep:
        "dashboard",

      message:
        "Login successful",
    };
  }

  /* =====================================================
     PENDING
  ===================================================== */

  if (
    driver.status ===
    "pending"
  ) {
    return {
      status:
        "pending",

      code:
        "DRIVER_PENDING",

      nextStep:
        "approval-pending",

      message:
        "Your Driver application is under review",
    };
  }

  /* =====================================================
     REJECTED
  ===================================================== */

  if (
    driver.status ===
    "rejected"
  ) {
    return {
      status:
        "rejected",

      code:
        "DRIVER_REJECTED",

      nextStep:
        "application-rejected",

      rejectionReason:
        driver.rejectionReason ||
        null,

      message:
        "Your Driver application was rejected",
    };
  }

  /* =====================================================
     UNKNOWN
  ===================================================== */

  return {
    status:
      driver.status ||
      "unknown",

    code:
      "DRIVER_STATUS_UNKNOWN",

    nextStep:
      "status",

    message:
      "Driver account status could not be determined",
  };
};

/* =========================================================
   DRIVER LOGIN
========================================================= */

/*
  POST /api/driver-auth/login

  BODY:

  {
    "email": "driver@example.com",
    "password": "password123"
  }
*/

export const loginDriver =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         INPUT
      =================================================== */

      const email =
        normalizeEmail(
          req.body?.email
        );

      const password =
        String(
          req.body?.password ||
            ""
        );

      /* ===================================================
         EMAIL VALIDATION
      =================================================== */

      if (
        !email
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Email is required",
          });
      }

      if (
        !isValidEmail(
          email
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
         PASSWORD VALIDATION
      =================================================== */

      if (
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Password is required",
          });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      /*
        Password has:

        select: false

        in Driver.js.

        Therefore we must explicitly select it.
      */

      const driver =
        await Driver.findOne({
          email,
        }).select(
          "+password"
        );

      /*
        IMPORTANT:

        Use the same generic response for:

        unknown email
          OR
        wrong password.

        This prevents revealing whether a specific
        Driver email exists.
      */

      if (
        !driver
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid email or password",
          });
      }

      /* ===================================================
         CHECK PASSWORD
      =================================================== */

      const passwordMatches =
        await driver.comparePassword(
          password
        );

      if (
        !passwordMatches
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid email or password",
          });
      }

      /* ===================================================
         CREATE JWT
      =================================================== */

      const token =
        createDriverToken(
          driver
        );

      /* ===================================================
         DRIVER STATUS
      =================================================== */

      const statusInfo =
        getDriverStatusInfo(
          driver
        );

      /* ===================================================
         SAFE DRIVER DATA
      =================================================== */

      const safeDriver =
        getSafeDriver(
          driver
        );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            statusInfo.message,

          token,

          tokenType:
            "Bearer",

          expiresIn:
            "7d",

          status:
            statusInfo.status,

          code:
            statusInfo.code,

          nextStep:
            statusInfo.nextStep,

          rejectionReason:
            statusInfo
              .rejectionReason ||
            null,

          data:
            safeDriver,
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to login Driver",
        });
    }
  };

/* =========================================================
   GET CURRENT DRIVER
========================================================= */

/*
  GET /api/driver-auth/me

  HEADER:

  Authorization: Bearer <DRIVER_JWT>

  Route must use:

  verifyDriver
*/

export const getCurrentDriver =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         DRIVER FROM verifyDriver
      =================================================== */

      if (
        !req.driver
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Driver authentication required",
          });
      }

      /*
        Reload the account so the frontend always receives
        the latest approval status and profile information.
      */

      const driver =
        await Driver.findById(
          req.driver._id
        );

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver account not found",
          });
      }

      const statusInfo =
        getDriverStatusInfo(
          driver
        );

      return res
        .status(200)
        .json({
          success:
            true,

          status:
            statusInfo.status,

          code:
            statusInfo.code,

          nextStep:
            statusInfo.nextStep,

          rejectionReason:
            statusInfo
              .rejectionReason ||
            null,

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "GET CURRENT DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load Driver account",
        });
    }
  };

/* =========================================================
   DRIVER LOGOUT
========================================================= */

/*
  POST /api/driver-auth/logout

  HEADER:

  Authorization: Bearer <DRIVER_JWT>

  OPTIONAL BODY:

  {
    "fcmToken": "..."
  }

  JWT authentication is stateless.

  Therefore the frontend must delete its stored JWT
  after this endpoint succeeds.

  If an FCM token is supplied, it is removed from the
  Driver account so that device stops receiving Driver
  notifications after logout.
*/

export const logoutDriver =
  async (
    req,
    res
  ) => {
    try {
      if (
        !req.driver
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Driver authentication required",
          });
      }

      /* ===================================================
         OPTIONAL FCM TOKEN
      =================================================== */

      const fcmToken =
        typeof req.body
          ?.fcmToken ===
        "string"
          ? req.body.fcmToken.trim()
          : "";

      if (
        fcmToken
      ) {
        await Driver.findByIdAndUpdate(
          req.driver._id,

          {
            $pull: {
              fcmTokens:
                fcmToken,
            },
          }
        );
      }

      /* ===================================================
         ONLINE STATUS
      =================================================== */

      /*
        Logging out should make the Driver unavailable.

        If the Driver has an active trip, your Trip/socket
        flow can later handle this differently if needed.
      */

      await Driver.findByIdAndUpdate(
        req.driver._id,

        {
          $set: {
            isOnline:
              false,

            currentStatus:
              "offline",
          },
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Logged out successfully",
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER LOGOUT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to logout Driver",
        });
    }
  };
