import express from "express";

import {
  getBillingSettings,
  updateBillingSettings,
} from "../controllers/billingController.js";

const router = express.Router();

/* ================= GET BILLING SETTINGS ================= */
router.get("/", getBillingSettings);

/* ================= UPDATE BILLING SETTINGS ================= */
router.put("/", updateBillingSettings);

export default router;
