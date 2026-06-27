const express = require("express");

const router = express.Router();

const {
  getBillingSettings,
  updateBillingSettings,
} = require("../controllers/billingController");

/*
GET Billing Settings
*/
router.get("/", getBillingSettings);

/*
UPDATE Billing Settings
*/
router.put("/", updateBillingSettings);

module.exports = router;
