import admin from "firebase-admin";

/* ================= SERVICE ACCOUNT ================= */
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

/* ================= INIT FIREBASE ================= */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("🔥 Firebase Admin Initialized");

  } catch (err) {
    console.error("❌ Firebase Init Error:", err.message);
  }
}

export default admin;
