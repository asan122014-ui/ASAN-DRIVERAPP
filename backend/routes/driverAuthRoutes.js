import express from "express";

import {
  loginDriver,
  getCurrentDriver,
  logoutDriver,
} from "../controllers/driverAuthController.js";

import verifyDriver from "../middleware/verifyDriver.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

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

  No authentication middleware is required here
  because this endpoint creates the Driver session.
*/

router.post(
  "/login",
  loginDriver
);

/* =========================================================
   CURRENT DRIVER SESSION
========================================================= */

/*
  GET /api/driver-auth/me

  HEADER:

  Authorization: Bearer <DRIVER_JWT>

  This endpoint works for:

  pending Drivers
  approved Drivers
  rejected Drivers

  because verifyDriver checks authentication only.
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

  If an FCM token is supplied, it will be removed
  from the Driver account during logout.
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
