import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import DriverRequest from "../models/DriverRequest.js";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";
// import Billing from "../models/Billing.js";

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
      password,
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
   CHECK EMAIL
============================================================ */
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Email not found",
      });
    }

    res.json({
      success: true,
      message: "Email found",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to check email",
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
   DOWNLOAD USER DATA
============================================================ */
router.get("/download-data/:parentId", async (req, res) => {
  try {
    const { parentId } = req.params;

    const parent = await Parent.findById(parentId).select("-password");
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // ✅ FIXED: Use parent (not parentId) for Trip model
    const children = await Child.find({ parentId });
    const trips = await Trip.find({ parent: parentId })
      .populate("child", "name grade school")
      .sort({ createdAt: -1 });
    const notifications = await Notification.find({ parentId });
    // const billing = await Billing.find({ parentId });

    const downloadData = {
      parent: parent.toObject(),
      children: children.map(c => c.toObject()),
      trips: trips.map(t => t.toObject()),
      notifications: notifications.map(n => n.toObject()),
      // billing: billing.map(b => b.toObject()),
      downloadedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: "Data downloaded successfully",
      data: downloadData,
    });
  } catch (error) {
    console.error("DOWNLOAD DATA ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download data",
    });
  }
});

/* ============================================================
   GET SINGLE PARENT
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id).select("-password");

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    res.json({
      success: true,
      data: parent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parent",
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
    const parent = await Parent.findById(req.params.id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // ✅ FIXED: Use parent (not parentId) for Trip model
    await Child.deleteMany({ parentId: req.params.id });
    await Trip.deleteMany({ parent: req.params.id });
    await Notification.deleteMany({ parentId: req.params.id });
    await DriverRequest.deleteMany({ parentId: req.params.id });

    await Parent.findByIdAndDelete(req.params.id);

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

/* ============================================================
   LINK DRIVER (Parent App)
============================================================ */
router.post("/link-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    if (!parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID and Driver ID are required",
      });
    }

    const parent = await Parent.findById(parentId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    const driver = await Driver.findOne({
      driverId: driverId.trim().toUpperCase(),
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Invalid Driver ID",
      });
    }

    parent.driverId = driver.driverId;
    await parent.save();

    await Child.updateMany(
      { parentId: parent._id },
      {
        driverId: driver.driverId,
      }
    );

    const updatedParent = await Parent.findById(parent._id).select(
      "-password"
    );

    res.json({
      success: true,
      message: "Driver linked successfully",
      data: updatedParent,
    });
  } catch (error) {
    console.error("LINK DRIVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to link driver",
    });
  }
});

/* ============================================================
   RESET PASSWORD
============================================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    parent.password = newPassword;
    await parent.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
});

export default router;
