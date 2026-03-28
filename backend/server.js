import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

/* ROUTES */
import otpRoutes from "./routes/otp.js";          // ✅ unified OTP (driver + parent)
import parentRoutes from "./routes/parentRoutes.js";

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
app.use("/api/otp", otpRoutes);          // ✅ single OTP system
app.use("/api/parent", parentRoutes);

/* ================= SOCKET LOGIC ================= */
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Driver sends location
  socket.on("driver_location", (data) => {
    // broadcast to all parents
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
  console.log(`🌍 Server running on port ${PORT}`);
  console.log("=================================");
});
