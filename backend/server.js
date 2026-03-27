import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

/* ROUTES */
import authRoutes from "./routes/authRoutes.js";
import parentRoutes from "./routes/parentRoutes.js"; // ✅ fixed typo
import otpRoutes from "./routes/otp.js";
import dashboardRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import studentRoutes from "./routes/student.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import locationRoutes from "./routes/locationRoutes.js";

/* FIREBASE */
import admin from "firebase-admin";

/* ================= ENV ================= */
dotenv.config();

/* ================= DB ================= */
connectDB();

/* ================= APP ================= */
const app = express();

/* ================= SERVER ================= */
const server = http.createServer(app);

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// make io accessible everywhere
app.set("io", io);

/* ================= SOCKET CONNECTION ================= */
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  /* ===== DRIVER JOINS TRACKING ROOM ===== */
  socket.on("driver_join", (driverId) => {
    if (!driverId) return;

    socket.join(`driver_${driverId}`);
    console.log(`Driver ${driverId} joined tracking room`);
  });

  /* ===== PARENT JOINS DRIVER ROOM ===== */
  socket.on("join_driver_room", (driverId) => {
    if (!driverId) return;

    socket.join(`driver_${driverId}`);
    console.log(`Parent joined driver ${driverId}`);
  });

  /* ===== LIVE LOCATION ===== */
  socket.on("driver_location", (data) => {
    if (!data?.driverId) return;

    io.to(`driver_${data.driverId}`).emit("live_location", data);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

/* ================= FIREBASE ================= */
const firebaseServiceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount)
  });
}

/* ================= MIDDLEWARE ================= */
app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= ROUTES ================= */

app.use("/api/auth", authRoutes);
app.use("/api/parent", parentRoutes); // ✅ IMPORTANT
app.use("/api/otp", otpRoutes);
app.use("/api/driver", dashboardRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);
app.use("/api/location", locationRoutes);

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ASAN backend running",
    time: new Date()
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("=================================");
  console.log("ASAN BACKEND STARTED");
  console.log(`Server running on port ${PORT}`);
  console.log("=================================");
});
