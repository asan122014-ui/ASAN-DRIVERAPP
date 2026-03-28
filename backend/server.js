import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

/* ================= ROUTES ================= */
import otpRoutes from "./routes/otp.js"; // ✅ unified OTP (email + phone)
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

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("io", io);

/* ================= MIDDLEWARE ================= */
app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= ROUTES ================= */

// 🔐 Auth
app.use("/api/auth", authRoutes);

// 🔑 OTP (driver + parent unified)
app.use("/api/otp", otpRoutes);

// 👨‍👩‍👧 Parent
app.use("/api/parent", parentRoutes);

// 🚗 Driver
app.use("/api/driver", driverRoutes);

// 🚌 Trip
app.use("/api/trip", tripRoutes);

// 🔔 Notifications
app.use("/api/notifications", notificationRoutes);

// 🎓 Students
app.use("/api/students", studentRoutes);

// 📍 Location tracking
app.use("/api/location", locationRoutes);

// 🛠 Admin
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);


/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Driver joins tracking room
  socket.on("driver_join", (driverId) => {
    if (!driverId) return;
    socket.join(`driver_${driverId}`);
    console.log(`🚗 Driver joined room: driver_${driverId}`);
  });

  // Parent joins notification room
  socket.on("join_parent", (parentId) => {
    if (!parentId) return;
    socket.join(`parent_${parentId}`);
    console.log(`👨‍👩‍👧 Parent joined room: parent_${parentId}`);
  });

  // Live location broadcast
  socket.on("driver_location", (data) => {
    io.emit("live_location", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

/* ================= HEALTH CHECK ================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ASAN backend running 🚀",
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
  console.log(`🌍 Server running on port ${PORT}`);
  console.log("=================================");
});
