import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trips.js";
import bcrypt from "bcryptjs";
import Child from "../models/Child.js";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    const existing = await Parent.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const parent = await Parent.create({
      name,
      email: email.trim().toLowerCase(),
      phone,
      password: hashedPassword,
    });

    const data = parent.toObject();
    delete data.password;

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ REGISTER ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!parent) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const data = parent.toObject();
    delete data.password;

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ================= GET ALL PARENTS ================= */
router.get("/", async (req, res) => {
  try {
    const parents = await Parent.find().select("-password");

    const enrichedParents = await Promise.all(
      parents.map(async (p) => {
        const children = await Child.find({ parentId: p._id });

        let driver = null;

        if (p.driverId) {
          driver = await Driver.findOne({ driverId: p.driverId }).select("-password");
        }

        return {
          ...p.toObject(),
          children,
          driver,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedParents,
    });

  } catch (err) {
    console.error("❌ FETCH PARENTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parents",
    });
  }
});

/* ================= DELETE PARENT ================= */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Parent.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    res.json({
      success: true,
      message: "Parent deleted",
    });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});

export default router;
