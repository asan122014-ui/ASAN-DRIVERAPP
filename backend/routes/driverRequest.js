import express from "express";

import Parent from "../models/Parent.js";

import {
  createRequest,
  getAllRequests,
  assignDriver,
  rejectDriverRequest,
} from "../controllers/driverRequestController.js";

import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* =========================================================
   LOAD AUTHENTICATED PARENT
========================================================= */

const requireParentAccount = async (
  req,
  res,
  next
) => {
  try {
    const firebaseUid =
      req.firebaseUser?.uid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message:
          "Parent authentication required",
      });
    }

    const parent =
      await Parent.findOne({
        firebaseUid,
      }).select(
        "+firebaseUid"
      );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message:
          "Parent account not found",
      });
    }

    if (
      parent.status ===
      "inactive"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Parent account is inactive",
      });
    }

    req.parent =
      parent;

    return next();
  } catch (error) {
    console.error(
      "DRIVER REQUEST PARENT AUTH ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Parent authentication failed",
    });
  }
};

/* =========================================================
   PARENT CREATES DRIVER REQUEST
========================================================= */

router.post(
  "/",

  verifyFirebaseToken,
  requireParentAccount,

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
