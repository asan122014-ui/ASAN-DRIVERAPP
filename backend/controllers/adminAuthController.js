import jwt from "jsonwebtoken";

import Admin from "../models/Admin.js";
import AdminLog from "../models/AdminLog.js";

/* =========================================================
   HELPERS
========================================================= */

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(email)
  );

/* =========================================================
   CREATE ADMIN TOKEN
========================================================= */

const createAdminToken = (admin) => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      id: String(admin._id),

      tokenType: "admin",

      role: admin.role,
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "8h",

      algorithm: "HS256",
    }
  );
};

/* =========================================================
   SAFE ADMIN DATA
========================================================= */

const getSafeAdmin = (admin) => {
  if (!admin) {
    return null;
  }

  const data =
    admin.toObject
      ? admin.toObject()
      : { ...admin };

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   SAFE ADMIN LOG
========================================================= */

const createAdminLog =
  async ({
    adminId,
    action,
    message,
    metadata = {},
  }) => {
    try {
      await AdminLog.create({
        adminId,

        action,

        message,

        metadata,
      });
    } catch (error) {
      console.warn(
        "Admin auth log failed:",
        error?.message
      );
    }
  };

/* =========================================================
   LOGIN ADMIN
========================================================= */

export const loginAdmin =
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      /* =====================================================
         VALIDATE INPUT
      ===================================================== */

      const normalizedEmail =
        normalizeEmail(email);

      if (
        !normalizedEmail ||
        !password
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Email and password are required",
        });
      }

      if (
        !isValidEmail(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Enter a valid email address",
        });
      }

      /* =====================================================
         FIND ADMIN
      ===================================================== */

      const admin =
        await Admin.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password"
        );

      if (!admin) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password",
        });
      }

      /* =====================================================
         ACTIVE CHECK
      ===================================================== */

      if (
        admin.isActive ===
        false
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Admin account is disabled",
        });
      }

      /* =====================================================
         VERIFY PASSWORD
      ===================================================== */

      const passwordMatches =
        await admin.comparePassword(
          password
        );

      if (
        !passwordMatches
      ) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password",
        });
      }

      /* =====================================================
         UPDATE LAST LOGIN
      ===================================================== */

      admin.lastLoginAt =
        new Date();

      await admin.save();

      /* =====================================================
         TOKEN
      ===================================================== */

      const token =
        createAdminToken(
          admin
        );

      /* =====================================================
         LOG
      ===================================================== */

      await createAdminLog({
        adminId:
          admin._id,

        action:
          "ADMIN_LOGIN",

        message:
          `Admin ${admin.email} logged in`,

        metadata: {
          role:
            admin.role,

          ipAddress:
            req.ip || null,

          userAgent:
            req.headers[
              "user-agent"
            ] || null,
        },
      });

      /* =====================================================
         RESPONSE
      ===================================================== */

      return res.status(200).json({
        success: true,

        message:
          "Admin logged in successfully",

        token,

        data:
          getSafeAdmin(
            admin
          ),
      });
    } catch (error) {
      console.error(
        "Admin Login Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Admin login failed",
      });
    }
  };

/* =========================================================
   GET CURRENT ADMIN
========================================================= */

export const getCurrentAdmin =
  async (req, res) => {
    try {
      if (
        !req.admin?._id
      ) {
        return res.status(401).json({
          success: false,

          message:
            "Admin session not found",
        });
      }

      const admin =
        await Admin.findById(
          req.admin._id
        );

      if (
        !admin
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Admin account not found",
        });
      }

      if (
        admin.isActive ===
        false
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Admin account is disabled",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          getSafeAdmin(
            admin
          ),
      });
    } catch (error) {
      console.error(
        "Get Current Admin Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch Admin account",
      });
    }
  };

/* =========================================================
   LOGOUT ADMIN
========================================================= */

export const logoutAdmin =
  async (req, res) => {
    try {
      if (
        req.admin?._id
      ) {
        await createAdminLog({
          adminId:
            req.admin._id,

          action:
            "ADMIN_LOGOUT",

          message:
            `Admin ${req.admin.email} logged out`,

          metadata: {
            role:
              req.admin.role,

            ipAddress:
              req.ip || null,

            userAgent:
              req.headers[
                "user-agent"
              ] || null,
          },
        });
      }

      /*
        JWT is stateless.

        Frontend must remove the Admin token
        after this response.
      */

      return res.status(200).json({
        success: true,

        message:
          "Admin logged out successfully",
      });
    } catch (error) {
      console.error(
        "Admin Logout Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Admin logout failed",
      });
    }
  };

/* =========================================================
   CREATE ADMIN
========================================================= */

export const createAdmin =
  async (req, res) => {
    try {
      /* =====================================================
         ONLY SUPERADMIN
      ===================================================== */

      if (
        req.admin?.role !==
        "superadmin"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Super Admin access required",
        });
      }

      const {
        email,
        password,
        role = "reviewer",
      } = req.body;

      const normalizedEmail =
        normalizeEmail(email);

      /* =====================================================
         VALIDATION
      ===================================================== */

      if (
        !normalizedEmail ||
        !password
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Email and password are required",
        });
      }

      if (
        !isValidEmail(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Enter a valid email address",
        });
      }

      if (
        String(password).length <
        8
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Password must contain at least 8 characters",
        });
      }

      if (
        ![
          "superadmin",
          "reviewer",
        ].includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid Admin role",
        });
      }

      /* =====================================================
         CHECK EXISTING ADMIN
      ===================================================== */

      const existingAdmin =
        await Admin.findOne({
          email:
            normalizedEmail,
        });

      if (
        existingAdmin
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Admin account already exists",
        });
      }

      /* =====================================================
         CREATE
      ===================================================== */

      const admin =
        await Admin.create({
          email:
            normalizedEmail,

          password,

          role,

          isActive:
            true,
        });

      /* =====================================================
         AUDIT LOG
      ===================================================== */

      await createAdminLog({
        adminId:
          req.admin._id,

        action:
          "ADMIN_CREATED",

        message:
          `Admin ${admin.email} created`,

        metadata: {
          createdAdminId:
            String(
              admin._id
            ),

          createdAdminEmail:
            admin.email,

          createdAdminRole:
            admin.role,
        },
      });

      return res.status(201).json({
        success: true,

        message:
          "Admin created successfully",

        data:
          getSafeAdmin(
            admin
          ),
      });
    } catch (error) {
      console.error(
        "Create Admin Error:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Admin account already exists",
        });
      }

      return res.status(500).json({
        success: false,

        message:
          "Failed to create Admin",
      });
    }
  };
