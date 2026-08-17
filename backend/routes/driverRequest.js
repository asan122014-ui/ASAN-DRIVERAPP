import express from "express";

import {
  createRequest,
  getAllRequests,
  assignDriver,
  rejectDriverRequest,
} from "../controllers/driverRequestController.js";

const router = express.Router();

/* =========================================================
   DRIVER REQUESTS
========================================================= */

/* Parent requests a Driver */
router.post("/", createRequest);

/* Admin gets all requests */
router.get("/", getAllRequests);

/* Admin assigns a Driver */
router.put("/:id/assign", assignDriver);

/* Admin rejects a Driver request */
router.put("/:id/reject", rejectDriverRequest);

export default router;
