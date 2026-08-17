import express from "express";

import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

import {
  parentAuthLimiter,
} from "../middleware/rateLimiters.js";

import {
  loginParentWithFirebase,
  registerParentWithFirebase,
} from "../controllers/parentAuthController.js";

const router = express.Router();

/* =========================================================
   PARENT FIREBASE AUTH ROUTES
========================================================= */

/*
  Firebase handles:

  1. Send OTP
  2. Verify OTP

  After successful OTP verification,
  the frontend receives a Firebase ID token.

  Send it to the backend as:

  Authorization: Bearer <FIREBASE_ID_TOKEN>

  Flow:

  Firebase ID Token
        ↓
  Rate Limiter
        ↓
  verifyFirebaseToken
        ↓
  Parent Auth Controller
*/

/* =========================================================
   FIREBASE LOGIN
========================================================= */

/*
  POST /api/parent-auth/login

  Headers:

  Authorization: Bearer <firebase-id-token>

  Body:

  No phone required.
  No OTP required.
  No password required.

  Phone and Firebase UID are obtained only
  from the verified Firebase token.

  Existing Parent:

  {
    "success": true,
    "needsRegistration": false,
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

  verifyFirebaseToken,

  loginParentWithFirebase
);

/* =========================================================
   FIREBASE REGISTRATION
========================================================= */

/*
  POST /api/parent-auth/register

  Headers:

  Authorization: Bearer <firebase-id-token>

  Body:

  {
    "name": "Parent Name",
    "email": "parent@gmail.com",
    "address": "Hyderabad",
    "latitude": 17.385,
    "longitude": 78.4867
  }

  DO NOT send:

  password
  otp
  phone
  firebaseUid

  Phone and Firebase UID are taken only
  from the verified Firebase ID token.
*/

router.post(
  "/register",

  parentAuthLimiter,

  verifyFirebaseToken,

  registerParentWithFirebase
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
