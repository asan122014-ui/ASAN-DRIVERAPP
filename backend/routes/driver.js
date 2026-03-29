import express from "express";
import mongoose from "mongoose";
import Driver from "../models/Driver.js";

const router = express.Router();

/* ================= HELPER FUNCTION ================= */
const findDriver = async (driverId) => {
  // ✅ support BOTH Mongo _id and ASAN driverId
  if (mongoose.Types.ObjectId.isValid(driverId)) {
    return await Driver.findById(driverId);
  } else {
    return await Driver.findOne({ driverId });
  }
};

/* ================= DRIVER DASHBOARD ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Dashboard error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard"
    });
  }
});

/* ================= DRIVER PROFILE ================= */
router.get("/profile", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Driver profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load profile"
    });
  }
});

/* ================= DRIVER TRACKING ================= */
router.get("/tracking", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: {
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber
      }
    });

  } catch (error) {
    console.error("Tracking error:", error.message);
    res.status(500).json({
      success: false,
      message: "Tracking failed"
    });
  }
});

/* ================= UPDATE DRIVER PROFILE ================= */
router.put("/update", async (req, res) => {
  try {
    const { driverId, ...updates } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    Object.assign(driver, updates);
    await driver.save();

    res.json({
      success: true,
      message: "Driver updated",
      data: driver
    });

  } catch (error) {
    console.error("Update error:", error.message);
    res.status(500).json({
      success: false,
      message: "Update failed"
    });
  }
});

/* ================= GET DRIVER BY ID PARAM ================= */
router.get("/:id", async (req, res) => {
  try {
    const driver = await findDriver(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Get driver error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver"
    });
  }
});

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../../api/api";
import { Mail, Lock, User, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FloatingInput from "../../components/FloatingInput";

function Auth() {
  const navigate = useNavigate();

  /* ================= STATE ================= */
  const [mode, setMode] = useState("signin");
  const [step, setStep] = useState("auth"); // 🔥 NEW STEP CONTROL

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: ""
  });

  const [driverId, setDriverId] = useState(""); // 🔥 DRIVER ID
  const [loading, setLoading] = useState(false);

  /* ================= AUTO LOGIN ================= */
  useEffect(() => {
    const user = localStorage.getItem("parent");
    if (user) navigate("/app");
  }, [navigate]);

  /* ================= HELPERS ================= */

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    form.email.trim()
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveUser = (parent) => {
    localStorage.setItem("parent", JSON.stringify(parent));
  };

  /* ================= LOGIN ================= */

  const handleLogin = async () => {
    try {
      if (!isValidEmail) return alert("Enter valid email");
      if (!form.password) return alert("Enter password");

      setLoading(true);

      const res = await API.post("/parent/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password
      });

      const parent = res.data?.data?.parent;

      if (!parent) return alert("Login failed");

      saveUser(parent);

      // ✅ get driverId if exists
      if (parent.driverId) {
        localStorage.setItem("driverId", parent.driverId);
      }

      navigate("/app");

    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= SIGNUP ================= */

  const handleSignup = async () => {
    try {
      if (!form.name) return alert("Enter name");
      if (!isValidEmail) return alert("Enter valid email");
      if (form.password.length < 6)
        return alert("Min 6 char password");
      if (!form.phone) return alert("Enter phone");

      setLoading(true);

      const res = await API.post("/parent/register", {
        name: form.name,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone
      });

      const parent = res.data?.data?.parent;

      if (!parent) return alert("Signup failed");

      saveUser(parent);

      // 🔥 GO TO DRIVER ID STEP
      setStep("driver");

    } catch (err) {
      alert(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= SAVE DRIVER ID ================= */

  const handleDriverLink = () => {
    if (!driverId) return alert("Enter Driver ID");

    // ✅ store driverId
    localStorage.setItem("driverId", driverId);

    // OPTIONAL: send to backend later if needed

    navigate("/app");
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white px-4">

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6">

        {/* ================= STEP 1 ================= */}
        {step === "auth" && (
          <>
            {/* HEADER */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-yellow-500">
                ASAN
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Safe rides. Real-time tracking.
              </p>
            </div>

            {/* TOGGLE */}
            <div className="flex bg-gray-100 rounded-full p-1 mb-6">
              <button
                onClick={() => setMode("signin")}
                className={`w-1/2 py-2 rounded-full text-sm font-medium ${
                  mode === "signin"
                    ? "bg-yellow-500 text-white"
                    : "text-gray-500"
                }`}
              >
                Sign In
              </button>

              <button
                onClick={() => setMode("signup")}
                className={`w-1/2 py-2 rounded-full text-sm font-medium ${
                  mode === "signup"
                    ? "bg-yellow-500 text-white"
                    : "text-gray-500"
                }`}
              >
                Sign Up
              </button>
            </div>

            <AnimatePresence mode="wait">

              {/* SIGN IN */}
              {mode === "signin" && (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <FloatingInput
                    icon={Mail}
                    label="Email"
                    value={form.email}
                    onChange={(e) =>
                      updateField("email", e.target.value)
                    }
                  />

                  <FloatingInput
                    icon={Lock}
                    label="Password"
                    value={form.password}
                    onChange={(e) =>
                      updateField("password", e.target.value)
                    }
                    isPassword
                  />

                  <button
                    onClick={handleLogin}
                    className="w-full bg-yellow-500 text-white p-3 rounded-xl"
                  >
                    Login
                  </button>
                </motion.div>
              )}

              {/* SIGN UP */}
              {mode === "signup" && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <FloatingInput
                    icon={User}
                    label="Full Name"
                    value={form.name}
                    onChange={(e) =>
                      updateField("name", e.target.value)
                    }
                  />

                  <FloatingInput
                    icon={Mail}
                    label="Email"
                    value={form.email}
                    onChange={(e) =>
                      updateField("email", e.target.value)
                    }
                  />

                  <FloatingInput
                    icon={Lock}
                    label="Password"
                    value={form.password}
                    onChange={(e) =>
                      updateField("password", e.target.value)
                    }
                    isPassword
                  />

                  <FloatingInput
                    icon={Phone}
                    label="Phone"
                    value={form.phone}
                    onChange={(e) =>
                      updateField("phone", e.target.value)
                    }
                  />

                  <button
                    onClick={handleSignup}
                    className="w-full bg-yellow-500 text-white p-3 rounded-xl"
                  >
                    Create Account
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </>
        )}

        {/* ================= STEP 2 (DRIVER ID) ================= */}
        {step === "driver" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-center"
          >
            <h2 className="text-xl font-semibold text-gray-800">
              Link Driver
            </h2>

            <p className="text-sm text-gray-500">
              Enter your driver's ASAN ID
            </p>

            <input
              type="text"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              placeholder="Enter Driver ID"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:border-yellow-500"
            />

            <button
              onClick={handleDriverLink}
              className="w-full bg-yellow-500 text-white p-3 rounded-xl font-semibold"
            >
              Continue
            </button>
          </motion.div>
        )}

      </div>
    </div>
  );
}

export default Auth;

export default router;
