import express from "express";
import Driver from "../models/Driver.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

// GET ALL DRIVERS
router.get("/drivers", verifyAdmin, async (req, res) => {
  const drivers = await Driver.find().select("-password");
  res.json(drivers);
});

// UPDATE DRIVER STATUS
router.put("/drivers/:id/status", verifyAdmin, async (req, res) => {
  const { status } = req.body;

  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  res.json(driver);
});

export default router;
