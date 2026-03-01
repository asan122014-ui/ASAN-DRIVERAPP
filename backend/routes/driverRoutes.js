import express from "express";
import Driver from "../models/Driver.js";

const router = express.Router();

// Create Driver
router.post("/", async (req, res) => {
  const driver = await Driver.create(req.body);
  res.json(driver);
});

// Get Driver
router.get("/:id", async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  res.json(driver);
});

export default router;