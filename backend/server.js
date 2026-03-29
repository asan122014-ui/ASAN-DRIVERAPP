import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

/* ================= ROUTES ================= */
import otpRoutes from "./routes/otp.js";
import parentRoutes from "./routes/parentRoutes.js";
import driverRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import studentRoutes from "./routes/student.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import locationRoutes from "./routes/locationRoutes.js";

/* ================= INIT ================= */
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

/* ================= CORS (OPEN) ================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })
);

// 🔥 VERY IMPORTANT (fix preflight issues)
app.options("/*", cors());

/* ================= BODY ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set("io", io);

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Driver joins room
  socket.on("driver_join", (driverId) => {
    if (!driverId) return;
    socket.join(`driver_${driverId}`);
    console.log(`🚗 Driver joined: driver_${driverId}`);
  });

  // Parent joins room
  socket.on("join_parent", (parentId) => {
    if (!parentId) return;
    socket.join(`parent_${parentId}`);
    console.log(`👨‍👩‍👧 Parent joined: parent_${parentId}`);
  });

  // 🔥 Live tracking (FIXED)
  socket.on("driver_location", (data) => {
    if (!data?.driverId) return;

    io.to(`driver_${data.driverId}`).emit("live_location", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

/* ================= ROUTES ================= */

// Auth
app.use("/api/auth", authRoutes);

// OTP
app.use("/api/otp", otpRoutes);

// Parent
app.use("/api/parent", parentRoutes);

// Driver
app.use("/api/driver", driverRoutes);

// Trip
app.use("/api/trip", tripRoutes);

// Notifications
app.use("/api/notifications", notificationRoutes);

// Students
app.use("/api/students", studentRoutes);

// Location
app.use("/api/location", locationRoutes);

// Admin
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);

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
  console.error("🔥 Server Error:", err.message);

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
  console.log("🚀 ASAN BACKEND STARTED");
  console.log(`🌍 Running on port ${PORT}`);
  console.log("=================================");
});
