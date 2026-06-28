import express from "express";

import {
  getAllInvoices,
  getInvoiceById,
  getParentInvoices,
  getDriverInvoices,
  generateInvoice,
  markInvoicePaid,
} from "../controllers/invoiceController.js";
const router = express.Router();

/* ===========================
   GET ALL INVOICES (ADMIN)
=========================== */
router.get("/", getAllInvoices);

/* ===========================
   GET SINGLE INVOICE
=========================== */
router.get("/:id", getInvoiceById);

/* ===========================
   GET PARENT INVOICES
=========================== */
router.get("/parent/:parentId", getParentInvoices);

/* ===========================
   GET DRIVER INVOICES
=========================== */
router.get("/driver/:driverId", getDriverInvoices);

/* ===========================
   GENERATE INVOICE
=========================== */
router.post("/generate", generateInvoice);

/* ===========================
   MARK INVOICE AS PAID
=========================== */
router.put("/:id/pay", markInvoicePaid);

export default router;
