import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";
const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });

  if (!admin) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: admin._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    role: admin.role
  });
});
router.get("/drivers", verifyAdmin, async (req, res) => {
  try {
    const drivers = await Driver.find().select("name driverId status vehicleType vehicleNumber");

    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/drivers/:id", verifyAdmin, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/drivers/:id/approve", verifyAdmin, async (req, res) => {
  try {
    await Driver.findByIdAndUpdate(req.params.id, {
      status: "approved",
      rejectionReason: null
    });

    res.json({ message: "Driver approved" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/drivers/:id/reject", verifyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    await Driver.findByIdAndUpdate(req.params.id, {
      status: "rejected",
      rejectionReason: reason
    });

    res.json({ message: "Driver rejected" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
