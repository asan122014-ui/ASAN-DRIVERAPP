import express from "express";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

router.get("/test", async (req, res) => {
  const success = await sendEmail(
    "yourtestemail@gmail.com",
    "Test Email",
    "Hello from ASAN 🚀"
  );

  res.json({ success });
});

export default router;
