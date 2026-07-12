import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import cron from "node-cron";
import connectDB from "./config/db.js";
import Driver from "./models/Driver.js";
import cleanupVerificationPhotos from "./jobs/cleanupVerificationPhotos.js";

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
import billingRoutes from "./routes/billingRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import driverRequestRoutes from "./routes/driverRequest.js";

/* ================= INIT ================= */
dotenv.config();
const app = express();
const server = http.createServer(app);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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
app.use("/api/admin/billing", billingRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/children", childRoutes);
app.use("/api/driver-request", driverRequestRoutes);

/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

/* ================= SOCKET MAPS ================= */
const parentSockets = new Map(); // parentId -> socket.id
const driverSockets = new Map(); // driverId -> socket.id
const driverParentsMap = new Map(); // driverId -> Set of parentIds

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  /* ===== JOIN DRIVER ROOM ===== */
  socket.on("join_driver_room", (data) => {
    // Support both old and new formats
    const driverId = typeof data === "string" ? data : data?.driverId;
    const parentId = typeof data === "object" ? data?.parentId : null;

    if (!driverId) return;

    const room = String(driverId);
    socket.join(room);
    console.log("🚗 Joined driver room:", room, parentId ? `as parent: ${parentId}` : "");

    // ✅ Store driver socket if this is a driver
    if (!parentId) {
      driverSockets.set(driverId, socket.id);
      console.log("🚗 Driver socket stored:", driverId);
    }

    // ✅ Store parent socket mapping if parentId is provided
    if (parentId) {
      parentSockets.set(parentId, socket.id);
      
      // Track which parents are in this driver's room
      if (!driverParentsMap.has(driverId)) {
        driverParentsMap.set(driverId, new Set());
      }
      driverParentsMap.get(driverId).add(parentId);
      
      console.log("👨‍👩‍👧 Parent stored, waiting for camera request:", parentId);
    }
  });

  /* ===== JOIN PARENT ROOM (optional - legacy) ===== */
  socket.on("join_parent_room", (parentId) => {
    if (!parentId) return;
    const room = String(parentId);
    socket.join(room);
    console.log("👨‍👩‍👧 Joined parent room:", room);
  });

  /* ================= CAMERA REQUEST FROM PARENT ================= */
  socket.on("start_camera", ({ driverId, parentId }) => {
    const room = String(driverId);

    console.log("📷 Parent requested camera:", parentId, "for driver:", driverId);

    // ✅ Ensure parent is tracked
    if (parentId) {
      parentSockets.set(parentId, socket.id);
      
      if (!driverParentsMap.has(driverId)) {
        driverParentsMap.set(driverId, new Set());
      }
      driverParentsMap.get(driverId).add(parentId);
    }

    // ✅ Emit parent_joined to driver - this triggers peer creation
    io.to(room).emit("parent_joined", { parentId });
    console.log("👨‍👩‍👧 Emitted parent_joined to driver for parent:", parentId);
  });

  /* ================= WEBRTC SIGNALING ================= */

  // 📤 DRIVER → OFFER (send to specific parent only)
  socket.on("offer", ({ offer, driverId, parentId }) => {
    console.log("📤 Offer from driver:", driverId, "for parent:", parentId);

    if (parentId) {
      // ✅ Send only to the specific parent's socket
      const parentSocketId = parentSockets.get(parentId);
      if (parentSocketId) {
        io.to(parentSocketId).emit("offer", { offer, parentId, driverId });
        console.log("📤 Offer sent to parent socket:", parentSocketId);
      } else {
        console.log("⚠️ Parent socket not found for parent:", parentId);
      }
    } else {
      console.log("⚠️ No parentId provided in offer, ignoring");
    }
  });

  // 📩 PARENT → ANSWER (send to specific driver only)
  socket.on("answer", ({ answer, driverId, parentId }) => {
    console.log("📩 Answer from parent:", parentId, "for driver:", driverId);

    // ✅ Send only to the specific driver's socket
    const driverSocketId = driverSockets.get(driverId);
    if (driverSocketId) {
      io.to(driverSocketId).emit("answer", { answer, parentId, driverId });
      console.log("📩 Answer sent to driver socket:", driverSocketId);
    } else {
      console.log("⚠️ Driver socket not found for driver:", driverId);
    }
  });

  // 📡 ICE (both sides) - with sender field
  socket.on("ice-candidate", ({ candidate, driverId, parentId, sender }) => {
    console.log("📡 ICE candidate from:", sender, "driver:", driverId, "parent:", parentId);

    if (sender === "driver") {
      // ✅ From driver → send to specific parent
      const parentSocketId = parentSockets.get(parentId);
      if (parentSocketId) {
        io.to(parentSocketId).emit("ice-candidate", { candidate, parentId, driverId });
        console.log("📡 ICE candidate sent to parent socket:", parentSocketId);
      } else {
        console.log("⚠️ Parent socket not found for parent:", parentId);
      }
    } else if (sender === "parent") {
      // ✅ From parent → send to specific driver
      const driverSocketId = driverSockets.get(driverId);
      if (driverSocketId) {
        io.to(driverSocketId).emit("ice-candidate", { candidate, parentId, driverId });
        console.log("📡 ICE candidate sent to driver socket:", driverSocketId);
      } else {
        console.log("⚠️ Driver socket not found for driver:", driverId);
      }
    } else {
      console.log("⚠️ Unknown sender in ice-candidate, ignoring");
    }
  });

  /* ================= DRIVER CAMERA READY ================= */
  socket.on("driver_camera_ready", ({ driverId }) => {
    console.log("📷 Driver camera ready:", driverId);

    const room = String(driverId);
    
    // ✅ Get all parents in this driver's room
    const parentIds = driverParentsMap.get(driverId) || new Set();
    const parentIdList = Array.from(parentIds);
    
    if (parentIdList.length > 0) {
      console.log("👨‍👩‍👧 Sending existing parents to driver:", parentIdList);
      io.to(room).emit("existing_parents", { parentIds: parentIdList });
    } else {
      console.log("ℹ️ No existing parents for driver:", driverId);
    }
  });

  /* ================= PARENT LEFT ================= */
  socket.on("parent_left", ({ driverId, parentId }) => {
    console.log("👋 Parent left:", parentId, "from driver:", driverId);
    
    // Remove from parentSockets
    parentSockets.delete(parentId);
    
    // Remove from driverParentsMap
    if (driverId && driverParentsMap.has(driverId)) {
      driverParentsMap.get(driverId).delete(parentId);
      if (driverParentsMap.get(driverId).size === 0) {
        driverParentsMap.delete(driverId);
      }
    }
    
    // ✅ Notify driver (send to specific driver socket)
    const driverSocketId = driverSockets.get(driverId);
    if (driverSocketId) {
      io.to(driverSocketId).emit("parent_left", { parentId });
      console.log("📤 Emitted parent_left to driver socket:", driverSocketId);
    } else {
      // Fallback to room broadcast
      const room = String(driverId);
      io.to(room).emit("parent_left", { parentId });
    }
  });

  /* ================= LOCATION ================= */
  socket.on("send_location", async (data) => {
    try {
      const { driverId, lat, lng, eta } = data;
      if (!driverId || lat === undefined || lng === undefined) return;

      const room = String(driverId);

      await Driver.findOneAndUpdate(
        { driverId },
        {
          lastLocation: {
            lat,
            lng,
            eta: eta || "--",
            updatedAt: new Date(),
          },
        }
      );

      io.to(room).emit("live_location", { lat, lng, eta: eta || "--" });

      console.log("📍 Location sent:", room);
    } catch (err) {
      console.error("❌ Location error:", err.message);
    }
  });

  /* ================= OLD FRAME (optional) ================= */
  socket.on("camera_frame", (data) => {
    const { driverId, frame } = data;
    if (!driverId || !frame) return;

    const room = String(driverId);

    io.to(room).emit("camera_update", { driverId, frame });

    console.log("🎥 Frame broadcast:", room);
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
    
    // ✅ Remove from driverSockets if this was a driver
    for (const [driverId, socketId] of driverSockets.entries()) {
      if (socketId === socket.id) {
        driverSockets.delete(driverId);
        console.log("🧹 Removed driver from map:", driverId);
        break;
      }
    }
    
    // ✅ Find and remove parent, notify driver
    let foundParentId = null;
    let foundDriverId = null;
    
    for (const [parentId, socketId] of parentSockets.entries()) {
      if (socketId === socket.id) {
        foundParentId = parentId;
        parentSockets.delete(parentId);
        console.log("🧹 Removed parent from map:", parentId);
        break;
      }
    }
    
    // Find which driver this parent was in
    if (foundParentId) {
      for (const [driverId, parentSet] of driverParentsMap.entries()) {
        if (parentSet.has(foundParentId)) {
          foundDriverId = driverId;
          parentSet.delete(foundParentId);
          if (parentSet.size === 0) {
            driverParentsMap.delete(driverId);
          }
          console.log("🧹 Removed parent from driver map:", driverId);
          break;
        }
      }
      
      // ✅ Notify driver that parent disconnected
      if (foundDriverId) {
        const driverSocketId = driverSockets.get(foundDriverId);
        if (driverSocketId) {
          io.to(driverSocketId).emit("parent_left", { parentId: foundParentId });
          console.log("📤 Emitted parent_left to driver socket:", driverSocketId);
        } else {
          const room = String(foundDriverId);
          io.to(room).emit("parent_left", { parentId: foundParentId });
        }
      }
    }
  });
});

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", time: new Date() });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("ERROR:", err);
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
    console.log("✅ Database connected successfully");

    /* ================= DAILY CLEANUP CRON JOB ================= */
    // Runs at 2:00 AM every day
    cron.schedule("0 2 * * *", async () => {
      console.log("🕑 Running scheduled verification photo cleanup...");
      try {
        await cleanupVerificationPhotos();
        console.log("✅ Verification photo cleanup completed successfully");
      } catch (error) {
        console.error("❌ Verification photo cleanup failed:", error.message);
      }
    });

    console.log("⏰ Cron job scheduled: Daily at 2:00 AM");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB CONNECTION FAILED:", err);
    process.exit(1);
  });
