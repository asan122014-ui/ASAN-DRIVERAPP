import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
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
import locationRoutes from "./routes/locationRoutes.js";
import childRoutes from "./routes/child.js";

/* ================= INIT ================= */
dotenv.config();
const app = express();
const server = http.createServer(app);

/* ================= CORS ================= */
app.use(cors());

/* ================= BODY ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/children", childRoutes);

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.set("io", io);

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  /* ===== DRIVER JOIN ===== */
  socket.on("join_driver_room", (driverId) => {
    if (driverId) {
      socket.join(driverId);
      console.log("🚐 Driver joined:", driverId);
    }
  });

  /* ===== PARENT JOIN ===== */
  socket.on("join_parent", (parentId) => {
    if (parentId) {
      socket.join(parentId);
      console.log("👨‍👩‍👧 Parent joined:", parentId);
    }
  });

  /* ===== LIVE LOCATION FROM DRIVER ===== */
  socket.on("send_location", (data) => {
    const { driverId, lat, lng } = data;

    if (!driverId || !lat || !lng) return;

    // ✅ send to all parents tracking this driver
    io.to(driverId).emit("live_location", {
      lat,
      lng,
    });

    console.log("📍 Location:", driverId, lat, lng);
  });

  /* ===== OPTIONAL: PICKUP EVENT ===== */
  socket.on("child_picked", ({ childId }) => {
    io.emit("notification", {
      title: "Pickup",
      message: "Child has been picked up",
    });
  });

  /* ===== OPTIONAL: DROP EVENT ===== */
  socket.on("child_dropped", ({ childId }) => {
    io.emit("notification", {
      title: "Drop",
      message: "Child has been dropped",
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    time: new Date(),
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal error",
  });
});

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB CONNECTION FAILED:", err);
    process.exit(1);
  });
