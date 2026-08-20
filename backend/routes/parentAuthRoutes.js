import express from "express";

import verifyPhoneEmail from "../middleware/verifyPhoneEmail.js";

import {
  parentAuthLimiter,
} from "../middleware/rateLimiters.js";

import {
  loginParent,
  registerParent,
} from "../controllers/parentAuthController.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   PARENT AUTH FLOW

   Phone.Email OTP Verification
        ↓
   userJsonUrl
        ↓
   verifyPhoneEmail
        ↓
   req.verifiedIdentity.phone
        ↓
   MongoDB Parent
        ↓
   ASAN Parent JWT
========================================================= */

/* =========================================================
   LOGIN EXISTING PARENT
========================================================= */

/*
POST /api/parent-auth/login

BODY:

{
  "userJsonUrl": "https://user.phone.email/..."
}

FLOW:

Phone.Email verifies OTP
        ↓
Backend verifies userJsonUrl
        ↓
Verified phone extracted
        ↓
Parent searched in MongoDB
        ↓
ASAN Parent JWT issued
        ↓
Dashboard
*/

router.post(
  "/login",

  parentAuthLimiter,

  verifyPhoneEmail,

  loginParent
);

/* =========================================================
   REGISTER NEW PARENT
========================================================= */

/*
POST /api/parent-auth/register

BODY:

{
  "userJsonUrl": "https://user.phone.email/...",
  "name": "Parent Name",
  "email": "parent@gmail.com",
  "address": "Hyderabad",
  "latitude": 17.385,
  "longitude": 78.486
}

IMPORTANT:

The phone number is NOT accepted as trusted identity
from req.body.

The verified phone number must come from:

req.verifiedIdentity.phone
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
