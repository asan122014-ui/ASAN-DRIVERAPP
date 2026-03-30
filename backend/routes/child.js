import express from "express";
import Child from "../models/Child.js";

const router = express.Router();


// ================= ADD CHILD =================
router.post("/add", async (req, res) => {
  try {
    const { name, age, school, parentId, driverId } = req.body;

    if (!name || !parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const child = await Child.create({
      name,
      age,
      school,
      parentId,
      driverId,
    });

    res.json({ success: true, data: child });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ================= GET BY PARENT =================
router.get("/parent/:parentId", async (req, res) => {
  try {
    const children = await Child.find({
      parentId: req.params.parentId,
    });

    res.json({ success: true, data: children });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ================= GET BY DRIVER =================
router.get("/driver/:driverId", async (req, res) => {
  try {
    const children = await Child.find({
      driverId: req.params.driverId,
    });

    res.json({ success: true, data: children });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
