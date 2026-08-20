import express from "express";

import {
  createRequest,
  getAllRequests,
  assignDriver,
  rejectDriverRequest,
} from "../controllers/driverRequestController.js";

import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router =
  express.Router();

/* =========================================================
   DRIVER REQUEST ROUTES
========================================================= */

/*
  Parent authentication:

  ASAN Parent JWT
        ↓
  verifyParent
        ↓
  req.parent
*/

/* =========================================================
   PARENT CREATES DRIVER REQUEST
========================================================= */

router.post(
  "/",

  verifyParent,

  createRequest
);

/* =========================================================
   ADMIN GETS ALL REQUESTS
========================================================= */

router.get(
  "/",

  verifyAdmin,

  getAllRequests
);

/* =========================================================
   ADMIN ASSIGNS DRIVER
========================================================= */

router.put(
  "/:id/assign",

  verifyAdmin,

  assignDriver
);

/* =========================================================
   ADMIN REJECTS REQUEST
========================================================= */

router.put(
  "/:id/reject",

  verifyAdmin,

  rejectDriverRequest
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
