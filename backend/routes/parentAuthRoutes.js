import express from "express";

import verifyPhoneEmail from "../middleware/verifyPhoneEmail.js";

import {
  parentAuthLimiter,
} from "../middleware/rateLimiters.js";

import {
  loginParent,
  registerParent,
} from "../controllers/parentAuthController.js";

const router =
  express.Router();

/* =========================================================
   PARENT PHONE.EMAIL AUTH ROUTES
========================================================= */

/*
  AUTH FLOW:

  Phone.Email
      ↓
  OTP verification
      ↓
  userJsonUrl
      ↓
  Parent frontend
      ↓
  ASAN Backend
      ↓
  verifyPhoneEmail
      ↓
  req.verifiedIdentity
      ↓
  Parent auth controller
      ↓
  MongoDB Parent
      ↓
  ASAN Parent JWT
*/

/* =========================================================
   LOGIN
========================================================= */

/*
  POST /api/parent-auth/login

  Body:

  {
    "userJsonUrl":
      "https://user.phone.email/user_xxxxx.json"
  }

  Existing Parent:

  {
    "success": true,
    "needsRegistration": false,
    "token": "<ASAN_PARENT_JWT>",
    "data": {}
  }

  New Parent:

  {
    "success": true,
    "needsRegistration": true,
    "phone": "+91XXXXXXXXXX"
  }
*/

router.post(
  "/login",

  parentAuthLimiter,

  verifyPhoneEmail,

  loginParent
);

/* =========================================================
   REGISTER
========================================================= */

/*
  POST /api/parent-auth/register

  Body:

  {
    "userJsonUrl":
      "https://user.phone.email/user_xxxxx.json",

    "name":
      "Parent Name",

    "email":
      "parent@gmail.com",

    "address":
      "Hyderabad",

    "latitude":
      17.385,

    "longitude":
      78.4867
  }

  DO NOT send:

  phone
  otp
  firebaseUid
  password

  Phone comes only from the verified
  Phone.Email response.
*/

router.post(
  "/register",

  parentAuthLimiter,

  verifyPhoneEmail,

  registerParent
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
