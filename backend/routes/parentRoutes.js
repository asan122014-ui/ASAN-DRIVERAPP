import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import DriverRequest from "../models/DriverRequest.js";

const router = express.Router();

/* ============================================================
   REGISTER PARENT
============================================================ */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      address,
      latitude,
      longitude,
    } = req.body;

    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !address ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existing = await Parent.findOne({
      $or: [
        { email: email.trim().toLowerCase() },
        { phone },
      ],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already registered",
      });
    }

    const parent = await Parent.create({
      name,
      email: email.trim().toLowerCase(),
      phone,
      password, // Model will hash this
      address,
      homeLocation: {
        type: "Point",
        coordinates: [
          Number(longitude),
          Number(latitude),
        ],
      },
    });

    const data = parent.toObject();
    delete data.password;

    res.status(201).json({
      success: true,
      message: "Parent registered successfully",
      data,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ============================================================
   LOGIN
============================================================ */
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

    const isMatch = await parent.comparePassword(password);

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
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ============================================================
   GET ALL PARENTS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const parents = await Parent.find().select("-password");

    const result = await Promise.all(
      parents.map(async (parent) => {
        const children = await Child.find({
          parentId: parent._id,
        });

        const driver = parent.driverId
          ? await Driver.findOne({
              driverId: parent.driverId,
            }).select("-password")
          : null;

        return {
          ...parent.toObject(),
          children,
          driver,
        };
      })
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parents",
    });
  }
});

/* ============================================================
   ASSIGN DRIVER
============================================================ */
router.put("/assign-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    if (!parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "parentId and driverId required",
      });
    }

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const updated = await Parent.findByIdAndUpdate(
      parentId,
      { driverId },
      { new: true }
    ).select("-password");

    await Child.updateMany(
      { parentId },
      { driverId }
    );

    res.json({
      success: true,
      message: "Driver assigned successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to assign driver",
    });
  }
});

/* ============================================================
   UPDATE PARENT
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    if (
      updates.latitude !== undefined &&
      updates.longitude !== undefined
    ) {
      updates.homeLocation = {
        type: "Point",
        coordinates: [
          Number(updates.longitude),
          Number(updates.latitude),
        ],
      };

      delete updates.latitude;
      delete updates.longitude;
    }

    const updated = await Parent.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Parent updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
});

/* ============================================================
   DELETE PARENT
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Parent.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // Delete all children of this parent
    await Child.deleteMany({
      parentId: req.params.id,
    });

    // Delete all driver requests of this parent
    await DriverRequest.deleteMany({
      parentId: req.params.id,
    });

    res.json({
      success: true,
      message: "Parent and related records deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});
