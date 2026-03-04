import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import driverRoutes from "./routes/driverRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otp.js";
import dashboardRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import studentRoutes from "./routes/student.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";

import verifyToken from "./middleware/auth.js";

dotenv.config();

/* ---------------- DATABASE ---------------- */
connectDB();

/* ---------------- EXPRESS ---------------- */
const app = express();

/* ---------------- SERVER (FOR SOCKET.IO) ---------------- */
const server = http.createServer(app);

/* ---------------- SOCKET.IO ---------------- */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://asan-driverapp.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

/* Make io accessible in routes */
app.set("io", io);

io.on("connection", (socket) => {
  console.log("⚡ Admin connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Admin disconnected:", socket.id);
  });
});

/* ---------------- MIDDLEWARE ---------------- */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://asan-driverapp.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json());

/* ---------------- ROUTES ---------------- */

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);

app.use("/api/drivers", driverRoutes);
app.use("/api/driver", dashboardRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

app.use("/api/trip", tripRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);

/* ---------------- TEST ROUTES ---------------- */

app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    message: "Protected route working",
    user: req.user
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    server: "ASAN backend running"
  });
});

app.get("/api/driver/dashboard", (req, res) => {
  res.send("DIRECT HIT WORKING");
});

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    message: "Internal Server Error"
  });
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🔥 ASAN BACKEND STARTED 🔥");
  console.log(`🚀 Server running on port ${PORT}`);
});
