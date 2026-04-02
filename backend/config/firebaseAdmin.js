import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// 🔥 get absolute path
const serviceAccountPath = path.resolve("config/asan-app-4b7ea-firebase-adminsdk-fbsvc-1dd8033fce.json");

// 🔥 read JSON file
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
