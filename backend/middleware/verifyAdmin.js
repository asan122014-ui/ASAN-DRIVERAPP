import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Admin from "../models/Admin.js";

/* =========================================================
   ALLOWED ADMIN ROLES
========================================================= */

const ALLOWED_ADMIN_ROLES = new Set([
  "superadmin",
  "reviewer",
]);

/* =========================================================
   VERIFY ADMIN
========================================================= */

const verifyAdmin = async (
  req,
  res,
  next
) => {
  try {
    /* =====================================================
       JWT CONFIGURATION
    ===================================================== */

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        success: false,

        message:
          "Server authentication configuration error",
      });
    }

    /* =====================================================
       AUTHORIZATION HEADER
    ===================================================== */

    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Access denied. Token missing",
        });
    }

    /* =====================================================
       EXTRACT TOKEN
    ===================================================== */

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Access denied. Token missing",
        });
    }

    /* =====================================================
       VERIFY TOKEN
    ===================================================== */

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    /* =====================================================
       TOKEN PAYLOAD VALIDATION
    ===================================================== */

    if (
      !decoded?.id ||
      !decoded?.role
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid token",
        });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        String(decoded.id)
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid token",
        });
    }

    /* =====================================================
       TOKEN ROLE VALIDATION
    ===================================================== */

    if (
      !ALLOWED_ADMIN_ROLES.has(
        decoded.role
      )
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "Admin access denied",
        });
    }

    /* =====================================================
       VERIFY ADMIN STILL EXISTS
    ===================================================== */

    /*
      A valid JWT should not continue working if the
      Admin account was deleted or disabled later.
    */

    const admin =
      await Admin.findById(
        decoded.id
      ).select(
        "_id username role"
      );

    if (!admin) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Admin account not found",
        });
    }

    /* =====================================================
       DATABASE ROLE CHECK
    ===================================================== */

    /*
      Use the current database role rather than trusting
      only the role stored inside an old JWT.
    */

    if (
      !ALLOWED_ADMIN_ROLES.has(
        admin.role
      )
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "Admin access denied",
        });
    }

    /* =====================================================
       ATTACH AUTHENTICATED ADMIN
    ===================================================== */

    req.admin = {
      id:
        String(admin._id),

      username:
        admin.username,

      role:
        admin.role,
    };

    next();
  } catch (error) {
    /* =====================================================
       EXPIRED TOKEN
    ===================================================== */

    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Token expired",
        });
    }

    /* =====================================================
       INVALID JWT
    ===================================================== */

    if (
      error.name ===
        "JsonWebTokenError" ||
      error.name ===
        "NotBeforeError"
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid token",
        });
    }

    console.error(
      "ADMIN AUTH ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Admin authentication failed",
      });
  }
};

export default verifyAdmin;
