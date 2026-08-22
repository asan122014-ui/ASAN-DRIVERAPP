import express from "express";

import {
  loginAdmin,
  getCurrentAdmin,
  logoutAdmin,
  createAdmin,
} from "../controllers/adminAuthController.js";

import verifyAdmin, {
  requireSuperAdmin,
} from "../middleware/verifyAdmin.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   ADMIN LOGIN
========================================================= */

/*
  POST
  /api/admin-auth/login

  Public route.

  Body:

  {
    "email": "admin@example.com",
    "password": "********"
  }
*/

router.post(
  "/login",
  loginAdmin
);

/* =========================================================
   CURRENT ADMIN
========================================================= */

/*
  GET
  /api/admin-auth/me

  Protected Admin route.

  Authorization:

  Bearer <admin-token>
*/

router.get(
  "/me",
  verifyAdmin,
  getCurrentAdmin
);

/* =========================================================
   ADMIN LOGOUT
========================================================= */

/*
  POST
  /api/admin-auth/logout

  Protected Admin route.
*/

router.post(
  "/logout",
  verifyAdmin,
  logoutAdmin
);

/* =========================================================
   CREATE NEW ADMIN
========================================================= */

/*
  POST
  /api/admin-auth/create

  Only superadmin can create another Admin.

  Body:

  {
    "email": "reviewer@example.com",
    "password": "strong-password",
    "role": "reviewer"
  }
*/

router.post(
  "/create",
  verifyAdmin,
  requireSuperAdmin,
  createAdmin
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
