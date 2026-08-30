import express from "express";

import {
  sendRegisterOtp,
  verifyRegisterOtp,
  sendLoginOtp,
  verifyLoginOtp,
  getCurrentDriver,
  getRejectedApplicationStatus,
  acknowledgeRejectedApplication,
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
  Existing Driver account is checked
        ↓
  Active rejection is checked
        ↓
  If an unacknowledged rejection exists:
        DRIVER_REJECTED is returned
        ↓
  Otherwise registration OTP is generated
        ↓
  OTP is stored as a SHA-256 hash
        ↓
  OTP is sent through Resend
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
  Active rejection is checked
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

  Driver enters email
        ↓
  Existing Driver account is checked
        ↓
  If Driver exists:
        OTP is generated and sent

  If Driver does not exist:
        ↓
  Active RejectedDriver record is checked
        ↓
  If found:
        DRIVER_REJECTED is returned

  IMPORTANT:

  The rejection reason is NOT exposed from this unauthenticated
  endpoint.
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


  NORMAL FLOW:

  Driver submits email + OTP
        ↓
  OTP is verified
        ↓
  Current Driver loaded from MongoDB
        ↓
  ASAN Driver JWT created


  DRIVER JWT:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }


  STATUS:

  pending
        ↓
  approval-pending


  approved
        ↓
  dashboard


  SPECIAL REJECTION FLOW:

  Driver requested OTP while account still existed
        ↓
  Admin rejects Driver
        ↓
  Driver document is deleted
        ↓
  Driver verifies previously issued OTP
        ↓
  RejectedDriver record is found
        ↓
  Temporary rejection JWT is issued


  REJECTION JWT:

  {
    rejectionId: "<RejectedDriver _id>",
    originalDriverMongoId: "<old Driver _id>",
    tokenType: "driver_rejection"
  }


  nextStep:

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


  This endpoint is intended for a Driver document that still
  exists in MongoDB.

  It works for:

  pending
  approved
  legacy rejected Driver records


  IMPORTANT:

  Once a new rejection is completed, the Driver document is
  deleted.

  At that point /me may no longer work because verifyDriver
  normally requires the Driver document to exist.

  The frontend must use:

  GET /api/driver-auth/rejection-status

  to detect the rejection.
*/

router.get(
  "/me",

  verifyDriver,

  getCurrentDriver
);

/* =========================================================
   REJECTED APPLICATION STATUS
========================================================= */

/*
  GET /api/driver-auth/rejection-status

  HEADER:

  Authorization: Bearer <TOKEN>


  SUPPORTED TOKENS:

  1. Existing Driver JWT

     {
       id: "<old Driver _id>",
       tokenType: "driver"
     }

     This token may remain valid in the Driver app even after
     the original Driver record has been deleted.


  2. Temporary Rejection JWT

     {
       rejectionId: "<RejectedDriver _id>",
       originalDriverMongoId: "<old Driver _id>",
       tokenType: "driver_rejection"
     }


  IMPORTANT:

  DO NOT add verifyDriver here.

  verifyDriver normally checks that the Driver MongoDB record
  exists.

  Rejected Driver records are deliberately deleted, so this
  endpoint verifies the JWT internally inside the controller.


  EXAMPLE REJECTED RESPONSE:

  {
    "success": true,
    "rejected": true,
    "status": "rejected",
    "code": "DRIVER_REJECTED",
    "nextStep": "application-rejected",
    "message": "Your Driver application was rejected",
    "rejectionReason": "Uploaded licence is unclear",
    "rejectedAt": "...",
    "data": {
      ...
    }
  }


  EXAMPLE PENDING RESPONSE:

  {
    "success": true,
    "rejected": false,
    "status": "pending",
    "code": "DRIVER_PENDING",
    "nextStep": "approval-pending",
    "rejectionReason": null
  }
*/

router.get(
  "/rejection-status",

  getRejectedApplicationStatus
);

/* =========================================================
   ACKNOWLEDGE REJECTED APPLICATION
========================================================= */

/*
  POST /api/driver-auth/acknowledge-rejection

  HEADER:

  Authorization: Bearer <TOKEN>


  CALLED WHEN:

  Driver sees:

  Application Rejected
        +
  Rejection reason
        ↓
  Driver taps:
  "Back to Sign In"
        ↓
  Frontend calls this endpoint


  BACKEND:

  acknowledged = true

  acknowledgedAt = current time

  active = false

        ↓

  Old Driver OTP records are removed


  FRONTEND AFTER SUCCESS:

  Clear:

  accessToken
  driver
  any stored rejection data

        ↓

  Navigate to:

  /DriverLogin


  IMPORTANT:

  DO NOT add verifyDriver here.

  The original Driver document no longer exists.
*/

router.post(
  "/acknowledge-rejection",

  acknowledgeRejectedApplication
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


  IMPORTANT:

  A rejected Driver whose original Driver document was deleted
  should normally use acknowledge-rejection instead of logout.
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


  REJECTION

  GET /api/driver-auth/rejection-status

  POST /api/driver-auth/acknowledge-rejection


  IMPORTANT:

  Driver authentication is completely passwordless.

  There is no:

  /login with password
  bcrypt password comparison
  password field in Driver registration
  password stored in Driver MongoDB documents


  REJECTION FLOW:

  Admin Rejects Driver
        ↓
  Rejection snapshot created
        ↓
  Rejection email sent
        ↓
  Original Driver deleted
        ↓
  Existing Driver JWT remains in app
        ↓
  rejection-status detects RejectedDriver
        ↓
  Driver sees rejection page
        ↓
  Driver acknowledges
        ↓
  Rejection becomes inactive
        ↓
  Frontend clears session
        ↓
  Driver returns to Sign In
*/

/* =========================================================
   EXPORT
========================================================= */

export default router;
