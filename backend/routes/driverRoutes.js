import express from "express";
import verifyToken from "../middleware/auth.js";

import {
  getDriverProfile,
  getDriverDashboard,
  getAssignedStudents,
  updateDriverLocation,
  startTrip,
  endTrip,
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

/* ================= TRIP MANAGEMENT ================= */

router.post("/trip/start", verifyToken, startTrip);
router.post("/trip/end", verifyToken, endTrip);

/* ================= NOTIFICATIONS ================= */

router.get("/notifications", verifyToken, getDriverNotifications);

export default router;
