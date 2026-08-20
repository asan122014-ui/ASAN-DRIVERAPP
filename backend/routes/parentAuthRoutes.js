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
   PARENT AUTH
========================================================= */

/*
  Phone.Email OTP
        ↓
  userJsonUrl
        ↓
  verifyPhoneEmail
        ↓
  req.verifiedIdentity
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

  {
    "userJsonUrl":
      "https://user.phone.email/..."
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

  {
    "userJsonUrl": "...",

    "name": "Parent Name",
    "email": "parent@gmail.com",
    "address": "Hyderabad",
    "latitude": 17.385,
    "longitude": 78.486
  }

  Phone is NOT accepted from req.body.
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
