import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import Driver from "./models/Driver.js"; // 🔥 IMPORTANT

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

  /* ===== JOIN DRIVER ROOM ===== */
  socket.on("join_driver_room", (driverId) => {
    if (!driverId) return;

    const room = String(driverId);
    socket.join(room);

    console.log("🚐 Joined driver room:", room);
  });

  /* ===== JOIN PARENT ROOM ===== */
  socket.on("join_parent", (parentId) => {
    if (!parentId) return;

    const room = String(parentId);
    socket.join(room);

    console.log("👨‍👩‍👧 Parent joined:", room);
  });

  /* ===== LIVE LOCATION (🔥 MOST IMPORTANT) ===== */
  socket.on("send_location", async (data) => {
  try {
    const { driverId, lat, lng, eta } = data; // 🔥 ADD ETA

    // ✅ VALIDATION (allow 0 also)
    if (!driverId || lat === undefined || lng === undefined) return;

    const room = String(driverId);

    /* 🔥 SAVE TO DATABASE */
    await Driver.findOneAndUpdate(
      { driverId },
      {
        lastLocation: {
          lat,
          lng,
          eta: eta || "--", // 🔥 STORE ETA
          updatedAt: new Date(),
        },
        location: {
          type: "Point",
          coordinates: [lng, lat],
        },
      }
    );

    /* 🔥 EMIT TO ALL PARENTS */
    io.to(room).emit("live_location", {
      lat,
      lng,
      eta: eta || "--", // 🔥 SEND ETA TO FRONTEND
    });

    console.log("📍 Location + ETA updated:", room, eta);

  } catch (err) {
    console.error("❌ Location socket error:", err.message);
  }
});

      // ✅ FIX: allow 0 values also
      if (!driverId || lat === undefined || lng === undefined) return;

      const room = String(driverId);

      /* 🔥 SAVE TO DATABASE */
      await Driver.findOneAndUpdate(
        { driverId },
        {
          lastLocation: {
  lat: Number,
  lng: Number,
  eta: {
    type: String,
    default: "--"
  },
  updatedAt: Date,
},
        }
      );

      /* 🔥 EMIT TO ALL PARENTS */
      io.to(room).emit("live_location", {
        lat,
        lng,
      });

      console.log("📍 Location updated + sent:", room);

    } catch (err) {
      console.error("❌ Location socket error:", err.message);
    }
  });

  /* ===== NOTIFICATIONS ===== */
  socket.on("child_picked", (data) => {
    io.emit("notification", {
      title: "Pickup",
      message: "Child has been picked up",
      ...data,
    });
  });

  socket.on("child_dropped", (data) => {
    io.emit("notification", {
      title: "Drop",
      message: "Child has been dropped",
      ...data,
    });
  });

  /* ===== DISCONNECT ===== */
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
