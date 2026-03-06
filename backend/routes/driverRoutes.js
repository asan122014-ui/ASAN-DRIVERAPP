import express from "express";
import verifyToken from "../middleware/auth.js";

import {
  getDriverProfile,
  getDriverDashboard,
  getAssignedStudents,
  updateDriverLocation,
  getDriverNotifications
} from "../controllers/driverController.js";

const router = express.Router();

/* ================= DRIVER PROFILE ================= */

router.get("/profile", verifyToken, getDriverProfile);

/* ================= DRIVER DASHBOARD ================= */

router.get("/dashboard", verifyToken, getDriverDashboard);

/* ================= STUDENTS ================= */

router.get("/students", verifyToken, getAssignedStudents);

/* ================= LOCATION UPDATE ================= */

router.post("/location/update", verifyToken, updateDriverLocation);

/* ================= NOTIFICATIONS ================= */

router.get("/notifications", verifyToken, getDriverNotifications);

export default router;
