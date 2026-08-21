import express from "express";

import {
  sendRegisterOtp,
  verifyRegisterOtp,
  sendLoginOtp,
  verifyLoginOtp,
  getCurrentDriver,
  logoutDriver,
} from "../controllers/driverAuthController.js";

import verifyDriver from "../middleware/verifyDriver.js";

import {
  driverUpload,
} from "../config/cloudinary.js";

import {
  signupLimiter,
  loginLimiter,
} from "../middleware/rateLimiters.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   DRIVER REGISTRATION OTP
========================================================= */

/*
  STEP 1

  POST /api/driver-auth/send-register-otp

  BODY:

  {
    "email": "driver@example.com"
  }

  This sends an OTP to the Driver email.

  No Driver account is created yet.
*/

router.post(
  "/send-register-otp",

  signupLimiter,

  sendRegisterOtp
);

/* =========================================================
   VERIFY REGISTRATION OTP + CREATE DRIVER
========================================================= */

/*
  STEP 2

  POST /api/driver-auth/verify-register-otp

  CONTENT TYPE:

  multipart/form-data

  TEXT FIELDS:

  email
  otp
  name
  phone
  address
  latitude
  longitude
  vehicleNumber
  vehicleType
  vehicleModel
  licenseNumber

  FILE FIELDS:

  licenseFront
  licenseBack
  rcFront
  rcBack
  insurance
  idFront
  idBack
  profilePhoto

  After successful OTP verification:

  Driver account is created with:

  status = "pending"
*/

router.post(
  "/verify-register-otp",

  signupLimiter,

  driverUpload.fields([
    {
      name:
        "licenseFront",

      maxCount:
        1,
    },

    {
      name:
        "licenseBack",

      maxCount:
        1,
    },

    {
      name:
        "rcFront",

      maxCount:
        1,
    },

    {
      name:
        "rcBack",

      maxCount:
        1,
    },

    {
      name:
        "insurance",

      maxCount:
        1,
    },

    {
      name:
        "idFront",

      maxCount:
        1,
    },

    {
      name:
        "idBack",

      maxCount:
        1,
    },

    {
      name:
        "profilePhoto",

      maxCount:
        1,
    },
  ]),

  verifyRegisterOtp
);

/* =========================================================
   DRIVER LOGIN OTP
========================================================= */

/*
  STEP 1

  POST /api/driver-auth/send-login-otp

  BODY:

  {
    "email": "driver@example.com"
  }

  Sends a 6-digit OTP to the registered Driver email.
*/

router.post(
  "/send-login-otp",

  loginLimiter,

  sendLoginOtp
);

/* =========================================================
   VERIFY DRIVER LOGIN OTP
========================================================= */

/*
  STEP 2

  POST /api/driver-auth/verify-login-otp

  BODY:

  {
    "email": "driver@example.com",
    "otp": "123456"
  }

  If OTP is valid:

  {
    id: "<Driver MongoDB _id>",
    tokenType: "driver"
  }

  is signed into the JWT.
*/

router.post(
  "/verify-login-otp",

  loginLimiter,

  verifyLoginOtp
);

/* =========================================================
   CURRENT DRIVER SESSION
========================================================= */

/*
  GET /api/driver-auth/me

  HEADER:

  Authorization: Bearer <DRIVER_JWT>

  Works for:

  pending
  approved
  rejected

  Drivers because verifyDriver only authenticates
  the Driver account.

  Approval-based access is handled separately.
*/

router.get(
  "/me",

  verifyDriver,

  getCurrentDriver
);

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
*/

router.post(
  "/logout",

  verifyDriver,

  logoutDriver
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
