import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

const router = express.Router();


// ================= ADMIN LOGIN =================
router.post("/login", async (req, res) => {
  try {

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

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ================= GET ALL DRIVERS =================
router.get("/drivers", verifyAdmin, async (req, res) => {
  try {

    const drivers = await Driver.find()
      .sort({ createdAt: -1 });

    res.json(drivers);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ================= GET DRIVER DETAILS =================
router.get("/drivers/:id", verifyAdmin, async (req, res) => {
  try {

    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ================= APPROVE DRIVER =================
router.put("/drivers/:id/approve", verifyAdmin, async (req, res) => {
  try {

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        rejectionReason: null
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await AdminLog.create({
      adminId: req.adminId,
      action: "approve_driver",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });

    res.json({ message: "Driver approved successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ================= REJECT DRIVER =================
router.put("/drivers/:id/reject", verifyAdmin, async (req, res) => {
  try {

    const { reason } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectionReason: reason
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await AdminLog.create({
      adminId: req.adminId,
      action: "reject_driver",
      driverId: driver._id,
      message: `Driver ${driver.name} rejected`
    });

    res.json({ message: "Driver rejected successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ================= ADMIN LOGS =================
router.get("/logs", verifyAdmin, async (req, res) => {
  try {

    const logs = await AdminLog.find()
      .populate("adminId", "username")
      .populate("driverId", "name driverId")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/register", async (req, res) => {

  try {

    const driver = await Driver.create(req.body);

    // 🔥 REAL TIME UPDATE
    const io = req.app.get("io");

    io.emit("new_driver", driver);

    res.json(driver);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Driver registration failed"
    });

  }

});


export default router;
