import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

/* ROUTES */
import driverOtpRoutes from "./routes/otp.js";       // driver (phone OTP)
import parentOtpRoutes from "./routes/email.js";     // parent (email OTP)

import parentRoutes from "./routes/parentRoutes.js";

/* INIT */
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

/* SOCKET */
const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);

/* MIDDLEWARE */
app.use(cors());
app.use(express.json());

/* ROUTES */
app.use("/api/otp", driverOtpRoutes);         // driver
app.use("/api/email-otp", parentOtpRoutes);   // parent
app.use("/api/parent", parentRoutes);

/* SOCKET LOGIC */
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("driver_location", (data) => {
    io.emit("live_location", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

/* START */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
