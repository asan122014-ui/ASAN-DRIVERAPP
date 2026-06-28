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

/* ===========================
   GET SINGLE INVOICE
   (Keep this LAST)
=========================== */
router.get("/:id", getInvoiceById);

export default router;
