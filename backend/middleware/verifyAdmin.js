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

      return res
        .status(500)
        .json({
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

    /*
      Admin tokens are created using HS256.

      Explicitly allow only HS256 here as well.
    */

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
          algorithms: [
            "HS256",
          ],
        }
      );

    /* =====================================================
       TOKEN PAYLOAD VALIDATION
    ===================================================== */

    if (
      !decoded ||
      typeof decoded !==
        "object" ||
      !decoded.id ||
      !decoded.role
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
       ADMIN ID VALIDATION
    ===================================================== */

    if (
      !mongoose.Types.ObjectId.isValid(
        String(
          decoded.id
        )
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
      Do not trust only the JWT payload.

      Read the current Admin record so deleted Admins
      immediately lose API access.
    */

    const admin =
      await Admin.findById(
        decoded.id
      ).select(
        "_id email role"
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
       CURRENT DATABASE ROLE CHECK
    ===================================================== */

    /*
      The role currently stored in MongoDB is authoritative.

      This means role changes take effect without having
      to wait for an old JWT to expire.
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
        String(
          admin._id
        ),

      email:
        admin.email,

      role:
        admin.role,
    };

    return next();
  } catch (error) {
    /* =====================================================
       EXPIRED TOKEN
    ===================================================== */

    if (
      error?.name ===
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
       INVALID / MALFORMED TOKEN
    ===================================================== */

    if (
      error?.name ===
        "JsonWebTokenError" ||
      error?.name ===
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

    /* =====================================================
       SERVER / DATABASE ERROR
    ===================================================== */

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
