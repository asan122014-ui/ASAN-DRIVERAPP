import express from "express";

import {
  parentAuthLimiter,
} from "../middleware/rateLimiters.js";

import {
  sendLoginOtp,
  verifyLoginOtp,
  sendRegisterOtp,
  verifyRegisterOtp,
} from "../controllers/parentAuthController.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   PARENT AUTH FLOW

   EMAIL
     ↓
   Resend OTP
     ↓
   OTP Verification
     ↓
   MongoDB Parent
     ↓
   ASAN Parent JWT
========================================================= */

/* =========================================================
   SEND LOGIN OTP
========================================================= */

/*
POST /api/parent-auth/send-login-otp

BODY:

{
  "email": "parent@gmail.com"
}

FLOW:

Email entered
    ↓
Parent account checked
    ↓
OTP generated
    ↓
OTP hash stored
    ↓
OTP sent through Resend
*/

router.post(
  "/send-login-otp",

  parentAuthLimiter,

  sendLoginOtp
);

/* =========================================================
   VERIFY LOGIN OTP
========================================================= */

/*
POST /api/parent-auth/verify-login-otp

BODY:

{
  "email": "parent@gmail.com",
  "otp": "123456"
}

FLOW:

OTP verified
    ↓
Existing Parent fetched
    ↓
ASAN Parent JWT issued
    ↓
Dashboard
*/

router.post(
  "/verify-login-otp",

  parentAuthLimiter,

  verifyLoginOtp
);

/* =========================================================
   SEND REGISTER OTP
========================================================= */

/*
POST /api/parent-auth/send-register-otp

BODY:

{
  "email": "parent@gmail.com"
}

FLOW:

Email entered during registration
    ↓
Check that email is not already registered
    ↓
OTP generated
    ↓
OTP hash stored
    ↓
OTP sent through Resend
*/

router.post(
  "/send-register-otp",

  parentAuthLimiter,

  sendRegisterOtp
);

/* =========================================================
   VERIFY REGISTER OTP + CREATE PARENT
========================================================= */

/*
POST /api/parent-auth/verify-register-otp

BODY:

{
  "name": "Parent Name",
  "email": "parent@gmail.com",
  "phone": "8309649713",
  "address": "Hyderabad",
  "latitude": 17.385,
  "longitude": 78.486,
  "otp": "123456"
}

FLOW:

Registration details entered
    ↓
Email OTP verified
    ↓
Parent created in MongoDB
    ↓
ASAN Parent JWT issued
    ↓
Add Children
    ↓
Driver Choice
*/

router.post(
  "/verify-register-otp",

  parentAuthLimiter,

  verifyRegisterOtp
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
