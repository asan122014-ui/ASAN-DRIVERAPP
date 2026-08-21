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
  driverOtpSendLimiter,
  driverOtpVerifyLimiter,
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

  FLOW:

  Driver enters email
        ↓
  Registration OTP is generated
        ↓
  OTP is stored as a SHA-256 hash
        ↓
  OTP is sent through Resend
        ↓
  No Driver account is created yet
*/

router.post(
  "/send-register-otp",

  driverOtpSendLimiter,

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


  REQUIRED FILE FIELDS:

  licenseFront
  licenseBack
  rcFront
  rcBack
  insurance
  idFront
  idBack


  OPTIONAL FILE FIELD:

  profilePhoto


  FLOW:

  Driver submits OTP
        +
  Driver details
        +
  Driver documents
        ↓
  OTP is verified
        ↓
  Required details are validated
        ↓
  Required documents are validated
        ↓
  Driver account is created
        ↓
  Driver status = pending
        ↓
  Public Driver ID generated
        ↓
  ASAN Driver JWT issued
*/

router.post(
  "/verify-register-otp",

  driverOtpVerifyLimiter,

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

  FLOW:

  Driver enters registered email
        ↓
  Existing Driver account is checked
        ↓
  6-digit OTP generated
        ↓
  OTP hash stored in MongoDB
        ↓
  OTP sent through Resend
*/

router.post(
  "/send-login-otp",

  driverOtpSendLimiter,

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


  FLOW:

  Driver submits email + OTP
        ↓
  OTP is verified
        ↓
  Current Driver loaded from MongoDB
        ↓
  ASAN Driver JWT created


  JWT PAYLOAD:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }


  ACCOUNT STATUS:

  pending
        ↓
  approval-pending


  approved
        ↓
  dashboard


  rejected
        ↓
  application-rejected
*/

router.post(
  "/verify-login-otp",

  driverOtpVerifyLimiter,

  verifyLoginOtp
);

/* =========================================================
   CURRENT DRIVER SESSION
========================================================= */

/*
  GET /api/driver-auth/me

  HEADER:

  Authorization: Bearer <DRIVER_JWT>


  This endpoint works for:

  pending
  approved
  rejected


  verifyDriver only verifies authentication.

  It does NOT require approval.
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


  If fcmToken is supplied:

  it is removed from the Driver account.


  Driver is also marked:

  isOnline = false
  currentStatus = offline


  JWT itself is stateless.

  The frontend must delete the stored Driver JWT locally.
*/

router.post(
  "/logout",

  verifyDriver,

  logoutDriver
);

/* =========================================================
   FINAL DRIVER AUTH ENDPOINTS
========================================================= */

/*

  REGISTRATION

  POST /api/driver-auth/send-register-otp

  POST /api/driver-auth/verify-register-otp


  LOGIN

  POST /api/driver-auth/send-login-otp

  POST /api/driver-auth/verify-login-otp


  SESSION

  GET /api/driver-auth/me

  POST /api/driver-auth/logout


  IMPORTANT:

  Driver authentication is completely passwordless.

  There is no:

  /login with password
  bcrypt password comparison
  password field in Driver registration
  password stored in Driver MongoDB documents

*/

/* =========================================================
   EXPORT
========================================================= */

export default router;
