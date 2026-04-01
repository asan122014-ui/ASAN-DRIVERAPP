import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

/* ================= INIT FIREBASE ================= */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FCM_PROJECT_ID,
      clientEmail: process.env.FCM_CLIENT_EMAIL,
      privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  console.log("🔥 Firebase Admin Initialized");
}

export default admin;
