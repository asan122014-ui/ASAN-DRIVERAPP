import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";

const router = express.Router();

/* ================= LINK DRIVER ================= */

router.post("/link-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    await Parent.findByIdAndUpdate(parentId, {
      driverId
    });

    res.json({
      success: true,
      message: "Driver linked successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Linking failed"
    });
  }
});

export default router;
