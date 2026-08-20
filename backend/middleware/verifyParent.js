import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Parent from "../models/Parent.js";

/* =========================================================
   VERIFY PARENT JWT
========================================================= */

const verifyParent =
  async (
    req,
    res,
    next
  ) => {
    try {
      /* ===================================================
         AUTH HEADER
      =================================================== */

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
            success:
              false,

            message:
              "Parent authentication token missing",
          });
      }

      /* ===================================================
         TOKEN
      =================================================== */

      const token =
        authHeader
          .slice(7)
          .trim();

      if (!token) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Parent authentication token missing",
          });
      }

      /* ===================================================
         SECRET
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
            success:
              false,

            message:
              "Authentication service unavailable",
          });
      }

      /* ===================================================
         VERIFY
      =================================================== */

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

      if (
        !decoded ||
        typeof decoded !==
          "object" ||
        decoded.tokenType !==
          "parent" ||
        !decoded.id
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid Parent authentication token",
          });
      }

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
            success:
              false,

            message:
              "Invalid Parent authentication token",
          });
      }

      /* ===================================================
         CURRENT PARENT
      =================================================== */

      const parent =
        await Parent.findById(
          decoded.id
        );

      if (!parent) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Parent account not found",
          });
      }

      if (
        parent.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Parent account is inactive",
          });
      }

      /* ===================================================
         REQUEST USER
      =================================================== */

      req.parent =
        parent;

      req.parentAuth =
        {
          id:
            String(
              parent._id
            ),

          phone:
            parent.phone,

          tokenType:
            "parent",
        };

      next();
    } catch (error) {
      console.error(
        "PARENT JWT ERROR:",
        error?.name ||
          error?.message
      );

      if (
        error.name ===
        "TokenExpiredError"
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Parent session expired",
          });
      }

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Invalid Parent authentication token",
        });
    }
  };

export default verifyParent;
