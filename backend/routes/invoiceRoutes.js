import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Invoice from "../models/Invoice.js";

import {
  getAllInvoices,
  getInvoiceById,
  getParentInvoices,
  getDriverInvoices,
  generateInvoice,
  generateAllInvoices,
  markInvoicePaid,
} from "../controllers/invoiceController.js";

import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyDriver from "../middleware/verifyDriver.js";
import verifyParent from "../middleware/verifyParent.js";

const router =
  express.Router();

/* =========================================================
   CONSTANTS
========================================================= */

const ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (
  driverId
) => {
  return String(
    driverId || ""
  )
    .trim()
    .toUpperCase();
};

/* =========================================================
   VERIFY PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParent = (
  req,
  res,
  next
) => {
  const requestedParentId =
    String(
      req.params?.parentId ||
        ""
    ).trim();

  const authenticatedParentId =
    String(
      req.parent?._id ||
        ""
    ).trim();

  if (!requestedParentId) {
    return res
      .status(400)
      .json({
        success:
          false,

        message:
          "Parent ID is required",
      });
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      requestedParentId
    )
  ) {
    return res
      .status(400)
      .json({
        success:
          false,

        message:
          "Invalid Parent ID",
      });
  }

  if (!authenticatedParentId) {
    return res
      .status(401)
      .json({
        success:
          false,

        message:
          "Parent authentication required",
      });
  }

  if (
    requestedParentId !==
    authenticatedParentId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Parent's invoices",
      });
  }

  return next();
};

/* =========================================================
   VERIFY DRIVER PARAM OWNERSHIP
========================================================= */

const requireOwnDriver = (
  req,
  res,
  next
) => {
  const requestedDriverId =
    normalizeDriverId(
      req.params?.driverId
    );

  const authenticatedDriverId =
    normalizeDriverId(
      req.driver?.driverId
    );

  if (!requestedDriverId) {
    return res
      .status(400)
      .json({
        success:
          false,

        message:
          "Driver ID is required",
      });
  }

  if (!authenticatedDriverId) {
    return res
      .status(401)
      .json({
        success:
          false,

        message:
          "Driver authentication required",
      });
  }

  if (
    requestedDriverId !==
    authenticatedDriverId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Driver's invoices",
      });
  }

  return next();
};

/* =========================================================
   ADMIN OR PARENT INVOICE ACCESS
========================================================= */

/*
  GET /api/invoices/:id

  Allowed:

  Admin
  OR
  Parent who owns the invoice

  Driver should use:

  GET /api/invoices/driver/:driverId
*/

const authorizeInvoiceAccess =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      /* ===================================================
         INVOICE ID
      =================================================== */

      if (
        !mongoose.Types.ObjectId.isValid(
          String(id)
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Invoice ID",
          });
      }

      /* ===================================================
         BEARER TOKEN
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
              "Authentication required",
          });
      }

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
              "Authentication required",
          });
      }

      /* ===================================================
         TOKEN HINT
      =================================================== */

      /*
        jwt.decode() is used only to decide which
        authentication middleware should verify the token.

        It is NOT trusted as authentication.
      */

      let decoded =
        null;

      try {
        decoded =
          jwt.decode(
            token
          );
      } catch {
        decoded =
          null;
      }

      /* ===================================================
         ADMIN
      =================================================== */

      if (
        decoded &&
        typeof decoded ===
          "object" &&
        ADMIN_ROLES.has(
          decoded.role
        )
      ) {
        return verifyAdmin(
          req,
          res,

          () => {
            req.invoiceAccess =
              {
                type:
                  "admin",
              };

            return next();
          }
        );
      }

      /* ===================================================
         DRIVER
      =================================================== */

      if (
        decoded &&
        typeof decoded ===
          "object" &&
        decoded.tokenType ===
          "driver"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Drivers must use the Driver invoice endpoint",
          });
      }

      /* ===================================================
         PARENT
      =================================================== */

      if (
        decoded &&
        typeof decoded ===
          "object" &&
        decoded.tokenType ===
          "parent"
      ) {
        return verifyParent(
          req,
          res,

          async () => {
            try {
              const invoice =
                await Invoice.findOne({
                  _id:
                    id,

                  parentId:
                    req.parent._id,
                }).select(
                  "_id parentId"
                );

              if (!invoice) {
                return res
                  .status(404)
                  .json({
                    success:
                      false,

                    message:
                      "Invoice not found",
                  });
              }

              req.invoiceAccess =
                {
                  type:
                    "parent",

                  parentId:
                    req.parent._id,
                };

              return next();
            } catch (error) {
              console.error(
                "INVOICE OWNERSHIP ERROR:",
                error
              );

              return res
                .status(500)
                .json({
                  success:
                    false,

                  message:
                    "Invoice authorization failed",
                });
            }
          }
        );
      }

      /* ===================================================
         UNKNOWN TOKEN
      =================================================== */

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Unsupported authentication token",
        });
    } catch (error) {
      console.error(
        "INVOICE ACCESS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Invoice authorization failed",
        });
    }
  };

/* =========================================================
   GET ALL INVOICES
   ADMIN ONLY
========================================================= */

router.get(
  "/",

  verifyAdmin,

  getAllInvoices
);

/* =========================================================
   GET PARENT INVOICES
   AUTHENTICATED PARENT ONLY
========================================================= */

router.get(
  "/parent/:parentId",

  verifyParent,

  requireOwnParent,

  getParentInvoices
);

/* =========================================================
   GET DRIVER INVOICES
   AUTHENTICATED DRIVER ONLY
========================================================= */

router.get(
  "/driver/:driverId",

  verifyDriver,

  requireOwnDriver,

  getDriverInvoices
);

/* =========================================================
   GENERATE SINGLE INVOICE
   ADMIN ONLY
========================================================= */

router.post(
  "/generate",

  verifyAdmin,

  generateInvoice
);

/* =========================================================
   GENERATE ALL MONTHLY INVOICES
   ADMIN ONLY
========================================================= */

router.post(
  "/generate-all",

  verifyAdmin,

  generateAllInvoices
);

/* =========================================================
   MARK INVOICE AS PAID
   ADMIN ONLY
========================================================= */

/*
  Parent or Driver must never be able
  to manually mark an Invoice as paid.

  Payment gateway verification can be
  added separately.
*/

router.put(
  "/:id/pay",

  verifyAdmin,

  markInvoicePaid
);

/* =========================================================
   GET SINGLE INVOICE
   ADMIN OR OWNING PARENT
========================================================= */

/*
  Keep this route LAST so:

  /parent/...
  /driver/...
  /generate
  /generate-all

  are matched first.
*/

router.get(
  "/:id",

  authorizeInvoiceAccess,

  getInvoiceById
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
