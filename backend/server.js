import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";

import connectDB from "./config/db.js";

/* ROUTES */
import driverRoutes from "./routes/driverRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otp.js";
import dashboardRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import studentRoutes from "./routes/student.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";

/* MIDDLEWARE */
import verifyToken from "./middleware/auth.js";

/* FIREBASE */
import admin from "firebase-admin";

/* ENV CONFIG */
dotenv.config();

/* ================= DATABASE ================= */

connectDB();

/* ================= EXPRESS APP ================= */

const app = express();

/* ================= HTTP SERVER ================= */

const server = http.createServer(app);

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* Make socket accessible everywhere */

app.set("io", io);

/* ================= FIREBASE INIT ================= */

const serviceAccount = JSON.parse(
  fs.readFileSync("./firebase-service.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/* ================= SOCKET CONNECTION ================= */

io.on("connection", (socket) => {

  console.log("Socket client connected:", socket.id);

  /* Driver joins notification room */

  socket.on("joinDriverRoom", (driverId) => {
    socket.join(driverId);
    console.log(`Driver ${driverId} joined notification room`);
  });

  /* Driver joins tracking room */

  socket.on("driver_join", (driverId) => {
    socket.join(`driver_${driverId}`);
    console.log(`Driver ${driverId} joined tracking room`);
  });

  socket.on("disconnect", () => {
    console.log("Socket client disconnected:", socket.id);
  });

});

/* ================= GLOBAL MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= ROUTES ================= */

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAnalyticsRoutes);

app.use("/api/drivers", driverRoutes);
app.use("/api/driver", dashboardRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

app.use("/api/trip", tripRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);

/* ================= HEALTH CHECK ================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ASAN backend running",
    timestamp: new Date()
  });
});

/* ================= TEST PROTECTED ROUTE ================= */

app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "Protected route working",
    user: req.user
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {

  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });

});

/* ================= 404 HANDLER ================= */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "API route not found"
  });

});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log("=================================");
  console.log("ASAN BACKEND STARTED");
  console.log(`Server running on port ${PORT}`);
  console.log("=================================");

});
