import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
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
import locationRoutes from "./routes/locationRoutes.js";

/* MIDDLEWARE */
import verifyToken from "./middleware/auth.js";

/* FIREBASE */
import admin from "firebase-admin";

/* ================= ENV CONFIG ================= */

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
    origin: "",
    methods: ["GET", "POST"]
  }
});

/* Make socket available globally */

app.set("io", io);

/* ================= FIREBASE INIT ================= */

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

/* ================= SOCKET CONNECTION ================= */

io.on("connection", (socket) => {

  console.log("Socket client connected:", socket.id);

  socket.on("joinDriverRoom", (driverId) => {

    if (!driverId) return;

    socket.join(driverId.toString());

    console.log(`Driver ${driverId} joined notification room`);

  });

  socket.on("driver_join", (driverId) => {

    if (!driverId) return;

    socket.join(`driver_${driverId}`);

    console.log(`Driver ${driverId} joined tracking room`);

  });

  socket.on("disconnect", () => {

    console.log("Socket client disconnected:", socket.id);

  });

});

/* ================= GLOBAL MIDDLEWARE ================= */

app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));

app.use(express.json({ limit: "10mb" }));
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
app.use("/api/location", locationRoutes);

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
