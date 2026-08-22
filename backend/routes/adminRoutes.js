import express from "express";

import {
  getDashboardStats,
  getDrivers,
  getDriverById,
  approveDriver,
  rejectDriver,
  getLogs,
  getAnalytics,
} from "../controllers/adminController.js";

import verifyAdmin, {
  requireReviewer,
  requireSuperAdmin,
} from "../middleware/verifyAdmin.js";

/* =========================================================
   ROUTER
========================================================= */

const router =
  express.Router();

/* =========================================================
   PROTECT ALL ADMIN ROUTES
========================================================= */

/*
  Every route below requires:

  Authorization:
  Bearer <admin-token>

  Admin JWT:

  {
    id: "<MongoDB Admin _id>",
    tokenType: "admin",
    role: "superadmin" | "reviewer"
  }
*/

router.use(
  verifyAdmin
);

/* =========================================================
   DASHBOARD
========================================================= */

/*
  GET /api/admin/dashboard

  Available to:

  superadmin
  reviewer
*/

router.get(
  "/dashboard",
  requireReviewer,
  getDashboardStats
);

/* =========================================================
   ANALYTICS
========================================================= */

/*
  GET /api/admin/analytics

  Available to:

  superadmin
  reviewer
*/

router.get(
  "/analytics",
  requireReviewer,
  getAnalytics
);

/* =========================================================
   GET ALL DRIVERS
========================================================= */

/*
  GET /api/admin/drivers

  Optional filters:

  ?status=pending

  ?status=approved

  ?status=rejected

  ?search=sai

  Examples:

  GET /api/admin/drivers?status=pending

  GET /api/admin/drivers?search=ASAN-001

  GET /api/admin/drivers?status=approved&search=sai
*/

router.get(
  "/drivers",
  requireReviewer,
  getDrivers
);

/* =========================================================
   GET DRIVER DETAILS
========================================================= */

/*
  GET /api/admin/drivers/:id

  IMPORTANT:

  :id is the MongoDB Driver _id,
  not the public ASAN driverId.
*/

router.get(
  "/drivers/:id",
  requireReviewer,
  getDriverById
);

/* =========================================================
   APPROVE DRIVER
========================================================= */

/*
  PUT /api/admin/drivers/:id/approve

  Available to:

  superadmin
  reviewer

  Driver must normally be:

  status = pending
*/

router.put(
  "/drivers/:id/approve",
  requireReviewer,
  approveDriver
);

/* =========================================================
   REJECT DRIVER
========================================================= */

/*
  PUT /api/admin/drivers/:id/reject

  Available to:

  superadmin
  reviewer

  Body:

  {
    "reason": "Driving license document is unclear"
  }
*/

router.put(
  "/drivers/:id/reject",
  requireReviewer,
  rejectDriver
);

/* =========================================================
   ADMIN AUDIT LOGS
========================================================= */

/*
  GET /api/admin/logs

  Recommended:

  Only superadmin should see the complete
  Admin audit history.
*/

router.get(
  "/logs",
  requireSuperAdmin,
  getLogs
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
