import admin from "firebase-admin";

/* ================= DRIVER FIREBASE ================= */
const driverServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

/* ================= PARENT FIREBASE ================= */
const parentServiceAccount = {
  projectId: process.env.PARENT_FIREBASE_PROJECT_ID,
  clientEmail: process.env.PARENT_FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.PARENT_FIREBASE_PRIVATE_KEY
    ? process.env.PARENT_FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

/* ================= INIT FIREBASE APPS ================= */
let driverApp;
let parentApp;

try {
  driverApp =
    admin.apps.find((app) => app.name === "driver") ||
    admin.initializeApp(
      {
        credential: admin.credential.cert(driverServiceAccount),
      },
      "driver"
    );

  parentApp =
    admin.apps.find((app) => app.name === "parent") ||
    admin.initializeApp(
      {
        credential: admin.credential.cert(parentServiceAccount),
      },
      "parent"
    );

  console.log("🔥 Driver Firebase Initialized");
  console.log("🔥 Parent Firebase Initialized");
} catch (err) {
  console.error("❌ Firebase Init Error:", err.message);
}

export const driverMessaging = driverApp.messaging();
export const parentMessaging = parentApp.messaging();

export default admin;
