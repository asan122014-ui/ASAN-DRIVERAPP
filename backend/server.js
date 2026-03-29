import express from "express";
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

/* ================= 🔥 FULL OPEN CORS ================= */
// ✅ This allows EVERYTHING (no restriction)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");

  // ✅ handle preflight automatically
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* ================= BODY ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*", // ✅ FULL OPEN
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("driver_join", (driverId) => {
    if (!driverId) return;
    socket.join(`driver_${driverId}`);
    console.log("🚗 Driver joined:", driverId);
  });

  socket.on("join_parent", (parentId) => {
    if (!parentId) return;
    socket.join(`parent_${parentId}`);
    console.log("👨‍👩‍👧 Parent joined:", parentId);
  });

  // 🔥 LIVE LOCATION
  socket.on("driver_location", (data) => {
    if (!data?.driverId) return;

    io.to(`driver_${data.driverId}`).emit("live_location", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend running 🚀",
    time: new Date(),
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  res.status(500).json({
    success: false,
    message: err.message || "Server error",
  });
});

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("=================================");
});
