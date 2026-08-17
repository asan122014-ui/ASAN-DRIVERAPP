import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Invoice from "../models/Invoice.js";
import Parent from "../models/Parent.js";

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
import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

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
   LOAD AUTHENTICATED PARENT
========================================================= */

const requireParentAccount =
  async (
    req,
    res,
    next
  ) => {
    try {
      const firebaseUid =
        req.firebaseUser?.uid;

      if (!firebaseUid) {
        return res.status(401).json({
          success: false,

          message:
            "Parent authentication required",
        });
      }

      const parent =
        await Parent.findOne({
          firebaseUid,
        }).select(
          "+firebaseUid"
        );

      if (!parent) {
        return res.status(404).json({
          success: false,

          message:
            "Parent account not found",
        });
      }

      if (
        parent.status ===
        "inactive"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Parent account is inactive",
        });
      }

      req.parent =
        parent;

      return next();
    } catch (error) {
      console.error(
        "INVOICE PARENT AUTH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Parent authentication failed",
      });
    }
  };

/* =========================================================
   VERIFY PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParent =
  (
    req,
    res,
    next
  ) => {
    const requestedParentId =
      String(
        req.params?.parentId ||
          ""
      );

    if (!requestedParentId) {
      return res.status(400).json({
        success: false,

        message:
          "Parent ID is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        requestedParentId
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid Parent ID",
      });
    }

    if (
      requestedParentId !==
      String(
        req.parent._id
      )
    ) {
      return res.status(403).json({
        success: false,

        message:
          "You cannot access another Parent's invoices",
      });
    }

    return next();
  };

/* =========================================================
   VERIFY DRIVER PARAM OWNERSHIP
========================================================= */

const requireOwnDriver =
  (
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
      return res.status(400).json({
        success: false,

        message:
          "Driver ID is required",
      });
    }

    if (
      requestedDriverId !==
      authenticatedDriverId
    ) {
      return res.status(403).json({
        success: false,

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
          String(
            id
          )
        )
      ) {
        return res.status(400).json({
          success: false,

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
        return res.status(401).json({
          success: false,

          message:
            "Authentication required",
        });
      }

      const token =
        authHeader
          .slice(7)
          .trim();

      if (!token) {
        return res.status(401).json({
          success: false,

          message:
            "Authentication required",
        });
      }

      /* ===================================================
         DETERMINE TOKEN TYPE
      =================================================== */

      /*
        jwt.decode() is used ONLY to decide which
        verified middleware should process the token.

        It is NOT used for authentication.

        Actual verification is still performed by:

        verifyAdmin
        OR
        verifyFirebaseToken
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
         ADMIN TOKEN
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
            req.invoiceAccess = {
              type:
                "admin",
            };

            return next();
          }
        );
      }

      /* ===================================================
         DRIVER TOKEN NOT ALLOWED HERE
      =================================================== */

      if (
        decoded &&
        typeof decoded ===
          "object" &&
        decoded.tokenType ===
          "driver"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Drivers must use the Driver invoice endpoint",
        });
      }

      /* ===================================================
         PARENT FIREBASE TOKEN
      =================================================== */

      return verifyFirebaseToken(
        req,
        res,

        () => {
          return requireParentAccount(
            req,
            res,

            async () => {
              try {
                /* =========================================
                   VERIFY INVOICE OWNERSHIP
                ========================================= */

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
                  /*
                    Return 404 rather than revealing whether
                    another Parent owns the Invoice.
                  */

                  return res.status(404).json({
                    success: false,

                    message:
                      "Invoice not found",
                  });
                }

                req.invoiceAccess = {
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

                return res.status(500).json({
                  success: false,

                  message:
                    "Invoice authorization failed",
                });
              }
            }
          );
        }
      );
    } catch (error) {
      console.error(
        "INVOICE ACCESS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

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

  verifyFirebaseToken,
  requireParentAccount,
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
  Parent or Driver must NEVER be able to mark
  an Invoice as paid by themselves.

  Razorpay verification will be added separately.
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
  Keep LAST so:

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
