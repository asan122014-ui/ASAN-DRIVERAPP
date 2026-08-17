import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    String(value)
  );
};

/* =========================================================
   ADMIN LOGIN
========================================================= */

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        username,
        password,
      } = req.body;

      /* ===================================================
         VALIDATION
      =================================================== */

      const normalizedUsername =
        typeof username === "string"
          ? username.trim()
          : "";

      if (
        !normalizedUsername ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Username and password are required",
          });
      }

      /* ===================================================
         JWT SECRET
      =================================================== */

      if (
        !process.env.JWT_SECRET
      ) {
        console.error(
          "JWT_SECRET is not configured"
        );

        return res
          .status(500)
          .json({
            success: false,

            message:
              "Server authentication configuration error",
          });
      }

      /* ===================================================
         FIND ADMIN
      =================================================== */

      const admin =
        await Admin.findOne({
          username:
            normalizedUsername,
        }).select(
          "+password"
        );

      /*
        Use the same message whether username
        or password is incorrect.

        This avoids exposing which Admin usernames
        exist in the system.
      */

      if (!admin) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid username or password",
          });
      }

      /* ===================================================
         PASSWORD
      =================================================== */

      const isMatch =
        await bcrypt.compare(
          String(password),
          admin.password
        );

      if (!isMatch) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid username or password",
          });
      }

      /* ===================================================
         TOKEN
      =================================================== */

      const token =
        jwt.sign(
          {
            id:
              String(
                admin._id
              ),

            role:
              admin.role,
          },

          process.env.JWT_SECRET,

          {
            expiresIn: "7d",
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          token,

          role:
            admin.role,
        });
    } catch (error) {
      console.error(
        "ADMIN LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Login failed",
        });
    }
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

router.get(
  "/analytics",
  verifyAdmin,
  async (req, res) => {
    try {
      const [
        total,
        pending,
        approved,
        rejected,
      ] =
        await Promise.all([
          Driver.countDocuments(),

          Driver.countDocuments({
            status:
              "pending",
          }),

          Driver.countDocuments({
            status:
              "approved",
          }),

          Driver.countDocuments({
            status:
              "rejected",
          }),
        ]);

      return res
        .status(200)
        .json({
          success: true,

          data: {
            summary: {
              total,
              pending,
              approved,
              rejected,
            },
          },
        });
    } catch (error) {
      console.error(
        "ADMIN ANALYTICS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Analytics failed",
        });
    }
  }
);

/* =========================================================
   GET ALL DRIVERS
========================================================= */

router.get(
  "/drivers",
  verifyAdmin,
  async (req, res) => {
    try {
      const drivers =
        await Driver.find()
          .select(
            "-password"
          )
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,

          count:
            drivers.length,

          data:
            drivers,
        });
    } catch (error) {
      console.error(
        "ADMIN DRIVERS FETCH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch drivers",
        });
    }
  }
);

/* =========================================================
   GET DRIVER DETAILS
========================================================= */

router.get(
  "/drivers/:id",
  verifyAdmin,
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Driver ID",
          });
      }

      const driver =
        await Driver.findById(
          id
        ).select(
          "-password"
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data:
            driver,
        });
    } catch (error) {
      console.error(
        "ADMIN DRIVER FETCH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch driver",
        });
    }
  }
);

/* =========================================================
   APPROVE DRIVER
========================================================= */

router.put(
  "/drivers/:id/approve",
  verifyAdmin,
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      /* ===================================================
         VALIDATE ID
      =================================================== */

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Driver ID",
          });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findById(
          id
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      /* ===================================================
         IDEMPOTENT APPROVAL
      =================================================== */

      if (
        driver.status ===
        "approved"
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Driver is already approved",

            data: {
              _id:
                driver._id,

              driverId:
                driver.driverId,

              status:
                driver.status,
            },
          });
      }

      /* ===================================================
         APPROVE
      =================================================== */

      driver.status =
        "approved";

      driver.rejectionReason =
        null;

      await driver.save();

      /* ===================================================
         ADMIN LOG
      =================================================== */

      try {
        await AdminLog.create({
          action:
            "DRIVER_APPROVED",

          driverId:
            driver._id,

          message:
            `Driver ${driver.name} approved`,
        });
      } catch (logError) {
        /*
          Driver approval should not fail merely
          because audit logging failed.
        */

        console.error(
          "ADMIN APPROVAL LOG ERROR:",
          logError.message
        );
      }

      /* ===================================================
         SOCKET EVENT
      =================================================== */

      const io =
        req.app.get("io");

      if (io) {
        io.emit(
          "driver_approved",
          {
            driverId:
              driver.driverId,

            driverMongoId:
              String(
                driver._id
              ),

            status:
              driver.status,

            date:
              new Date()
                .toISOString()
                .split("T")[0],
          }
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver approved successfully",

          data: {
            _id:
              driver._id,

            driverId:
              driver.driverId,

            status:
              driver.status,
          },
        });
    } catch (error) {
      console.error(
        "APPROVE DRIVER ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Approval failed",
        });
    }
  }
);

/* =========================================================
   REJECT DRIVER
========================================================= */

router.put(
  "/drivers/:id/reject",
  verifyAdmin,
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        reason,
      } = req.body;

      /* ===================================================
         VALIDATE ID
      =================================================== */

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Driver ID",
          });
      }

      /* ===================================================
         REJECTION REASON
      =================================================== */

      const rejectionReason =
        typeof reason ===
          "string"
          ? reason.trim()
          : "";

      if (
        !rejectionReason
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Rejection reason is required",
          });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findById(
          id
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      /* ===================================================
         ALREADY REJECTED
      =================================================== */

      if (
        driver.status ===
          "rejected" &&
        driver.rejectionReason ===
          rejectionReason
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Driver is already rejected",

            data: {
              _id:
                driver._id,

              driverId:
                driver.driverId,

              status:
                driver.status,

              rejectionReason:
                driver.rejectionReason,
            },
          });
      }

      /* ===================================================
         REJECT
      =================================================== */

      driver.status =
        "rejected";

      driver.rejectionReason =
        rejectionReason;

      /*
        A rejected Driver should not remain
        operationally online.
      */

      driver.isOnline =
        false;

      driver.currentStatus =
        "offline";

      await driver.save();

      /* ===================================================
         ADMIN LOG
      =================================================== */

      try {
        await AdminLog.create({
          action:
            "DRIVER_REJECTED",

          driverId:
            driver._id,

          message:
            `Driver ${driver.name} rejected: ${rejectionReason}`,
        });
      } catch (logError) {
        console.error(
          "ADMIN REJECTION LOG ERROR:",
          logError.message
        );
      }

      /* ===================================================
         SOCKET EVENT
      =================================================== */

      const io =
        req.app.get("io");

      if (io) {
        io.emit(
          "driver_rejected",
          {
            driverId:
              driver.driverId,

            driverMongoId:
              String(
                driver._id
              ),

            status:
              driver.status,

            reason:
              rejectionReason,
          }
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver rejected successfully",

          data: {
            _id:
              driver._id,

            driverId:
              driver.driverId,

            status:
              driver.status,

            rejectionReason:
              driver.rejectionReason,
          },
        });
    } catch (error) {
      console.error(
        "REJECT DRIVER ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Rejection failed",
        });
    }
  }
);

/* =========================================================
   ADMIN LOGS
========================================================= */

router.get(
  "/logs",
  verifyAdmin,
  async (req, res) => {
    try {
      const logs =
        await AdminLog.find()
          .populate(
            "adminId",
            "username role"
          )
          .populate(
            "driverId",
            "name driverId"
          )
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,

          count:
            logs.length,

          data:
            logs,
        });
    } catch (error) {
      console.error(
        "ADMIN LOGS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch logs",
        });
    }
  }
);

export default router;
