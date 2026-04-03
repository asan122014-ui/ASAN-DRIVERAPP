import express from "express";
import Parent from "../models/Parent.js";

const router = express.Router();

/* ================= SAVE FCM TOKEN ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { parentId, token } = req.body;

    if (!parentId || !token) {
      return res.status(400).json({
        success: false,
        message: "parentId and token required",
      });
    }

    console.log("👉 Saving token for:", parentId);
    console.log("👉 Token:", token);

    const parent = await Parent.findByIdAndUpdate(
      parentId,
      {
        $addToSet: { fcmTokens: token }, // ✅ ARRAY BASED
      },
      { returnDocument: "after" } // ✅ UPDATED (no warning)
    );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    console.log("✅ TOKEN SAVED IN DB:", parent.fcmTokens);

    res.json({
      success: true,
      data: parent.fcmTokens,
    });

  } catch (error) {
    console.error("❌ Save token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save token",
    });
  }
});

export default router;
