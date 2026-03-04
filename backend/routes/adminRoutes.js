import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";
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
  { 
    id: admin._id,
    role: admin.role
  },
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
    const drivers = await Driver.find().sort({ createdAt: -1 });

    console.log("Drivers found:", drivers);

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

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejectionReason: null },
      { new: true }
    );

    await AdminLog.create({
      adminId: req.adminId,
      action: "approve_driver",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });

    res.json({ message: "Driver approved" });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/drivers/:id/reject", verifyAdmin, async (req, res) => {
  try {

    const { reason } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectionReason: reason },
      { new: true }
    );

    await AdminLog.create({
      adminId: req.adminId,
      action: "reject_driver",
      driverId: driver._id,
      message: `Driver ${driver.name} rejected`
    });

    res.json({ message: "Driver rejected" });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/logs", verifyAdmin, async (req, res) => {
  try {

    const logs = await AdminLog.find()
      .populate("adminId", "username")
      .populate("driverId", "name driverId")
      .sort({ createdAt: -1 });

    res.json(logs);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
