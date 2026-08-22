import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Admin from "../models/Admin.js";

/* =========================================================
   ALLOWED ADMIN ROLES
========================================================= */

const ALLOWED_ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   VERIFY ADMIN
========================================================= */

const verifyAdmin =
  async (
    req,
    res,
    next
  ) => {
    try {
      /* =====================================================
         JWT CONFIGURATION
      ===================================================== */

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

      if (
        !token
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
         VERIFY TOKEN
      ===================================================== */

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
        !decoded.id
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
         TOKEN TYPE
      ===================================================== */

      /*
        This is important because the same JWT_SECRET
        may also be used for:

        parent
        driver
        admin

        An Admin API must accept only Admin tokens.
      */

      if (
        decoded.tokenType !==
        "admin"
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
        decoded.role &&
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
         FETCH CURRENT ADMIN
      ===================================================== */

      /*
        The current MongoDB record is authoritative.

        This means:

        - deleted Admin → loses access
        - disabled Admin → loses access
        - changed role → new permissions apply immediately
      */

      const admin =
        await Admin.findById(
          decoded.id
        ).select(
          "_id email role isActive"
        );

      if (
        !admin
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Admin account not found",
          });
      }

      /* =====================================================
         ACTIVE ACCOUNT CHECK
      ===================================================== */

      if (
        admin.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "Admin account is disabled",
          });
      }

      /* =====================================================
         CURRENT DATABASE ROLE CHECK
      ===================================================== */

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
        _id:
          admin._id,

        id:
          String(
            admin._id
          ),

        email:
          admin.email,

        role:
          admin.role,

        isActive:
          admin.isActive,
      };

      /* =====================================================
         OPTIONAL AUTH INFO
      ===================================================== */

      req.adminAuth = {
        tokenType:
          decoded.tokenType,

        issuedAt:
          decoded.iat || null,

        expiresAt:
          decoded.exp || null,
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
         INVALID TOKEN
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

/* =========================================================
   REQUIRE SUPERADMIN
========================================================= */

export const requireSuperAdmin =
  (
    req,
    res,
    next
  ) => {
    if (
      !req.admin ||
      req.admin.role !==
        "superadmin"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "Super Admin access required",
        });
    }

    return next();
  };

/* =========================================================
   REQUIRE REVIEWER OR SUPERADMIN
========================================================= */

export const requireReviewer =
  (
    req,
    res,
    next
  ) => {
    if (
      !req.admin ||
      ![
        "superadmin",
        "reviewer",
      ].includes(
        req.admin.role
      )
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "Reviewer access required",
        });
    }

    return next();
  };

export default verifyAdmin;
