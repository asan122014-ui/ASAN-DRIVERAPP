import express from "express";
import {
  createRequest,
  getAllRequests,
  assignDriver,
} from "../controllers/driverRequestController.js";

const router = express.Router();

/* ==================================================
   DRIVER REQUESTS
================================================== */

// Parent requests a driver
// POST /api/driver-requests
router.post("/", createRequest);

// Admin - Get all driver requests
// GET /api/driver-requests
router.get("/", getAllRequests);

// Admin - Assign a driver
// PUT /api/driver-requests/:id/assign
router.put("/:id/assign", assignDriver);

export default router;
