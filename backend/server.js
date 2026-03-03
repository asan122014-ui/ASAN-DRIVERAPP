import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import driverRoutes from "./routes/driverRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otp.js";
import dashboardRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import studentRoutes from "./routes/student.js";
import verifyToken from "./middleware/auth.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());
app.use("/api/admin", adminRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/driver", dashboardRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/protected", verifyToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

const PORT = process.env.PORT || 5000;

app.get("/api/driver/dashboard", (req, res) => {
  res.send("DIRECT HIT WORKING");
});

app.listen(PORT, () => {
  console.log("🔥 THIS IS THE CORRECT BACKEND 🔥");
  console.log(`Server running on port ${PORT}`);
});
