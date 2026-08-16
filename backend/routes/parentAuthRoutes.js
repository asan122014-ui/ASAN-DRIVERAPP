import express from "express";

import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

import {
  loginParentWithFirebase,
  registerParentWithFirebase,
} from "../controllers/parentAuthController.js";

const router = express.Router();

/* =========================================================
   PARENT FIREBASE AUTH ROUTES
========================================================= */

/*
  IMPORTANT:

  Firebase itself handles:

  1. Send OTP
  2. Verify OTP

  After OTP verification, the frontend receives
  a Firebase ID token.

  That ID token is sent to these backend routes:

  Authorization: Bearer <FIREBASE_ID_TOKEN>

  verifyFirebaseToken.js verifies the token first.
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

  The verified phone number comes from Firebase.

  Possible result:

  Existing Parent:
  {
    success: true,
    needsRegistration: false,
    data: {...}
  }

  New Parent:
  {
    success: true,
    needsRegistration: true,
    phone: "+91XXXXXXXXXX"
  }
*/

router.post(
  "/login",
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

  Phone is taken only from the verified
  Firebase ID token.
*/

router.post(
  "/register",
  verifyFirebaseToken,
  registerParentWithFirebase
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
