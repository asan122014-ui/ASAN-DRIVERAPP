import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
function TripSuccess() {
 const location = useLocation();
const navigate = useNavigate();

const [trip, setTrip] = useState(location.state || null);
const [loading, setLoading] = useState(!location.state);

  if (!trip) {
    navigate("/dashboard");
    return null;
  }

  useEffect(() => {
  if (trip) return;

  const fetchLatestTrip = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        "https://asan-driverapp.onrender.com/api/trip/latest",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTrip(res.data);
    } catch (err) {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  fetchLatestTrip();
}, []);

  useEffect(() => {
  if (!trip) return;

  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 },
  });

  const timer = setTimeout(() => {
    navigate("/dashboard");
  }, 8000);

  return () => clearTimeout(timer);
}, [trip]);

  if (loading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }
  const duration =
    trip.startTime && trip.endTime
      ? Math.floor(
          (new Date(trip.endTime) - new Date(trip.startTime)) / 60000
        )
      : trip.duration;
  return (
  <div className="h-screen w-full max-w-sm mx-auto 
  flex flex-col 
  bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 
  text-white px-6 pt-16 pb-10">

  {/* SUCCESS ICON */}
<div className="relative flex items-center justify-center mt-6 w-full">

  {/* Ring Wrapper */}
  <div className="relative w-[140px] h-[140px] flex items-center justify-center">

    {/* Animated Ring */}
    <motion.svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      className="absolute"
    >
      <motion.circle
        cx="70"
        cy="70"
        r="60"
        stroke="#22c55e"
        strokeWidth="6"
        fill="transparent"
        strokeDasharray="377"
        strokeDashoffset="377"
        initial={{ strokeDashoffset: 377 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </motion.svg>

    {/* Center Icon */}
    <motion.div
      className="flex items-center justify-center"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 180, delay: 0.3 }}
      style={{
        boxShadow: "0 0 25px rgba(34,197,94,0.7)",
        borderRadius: "9999px"
      }}
    >
      <CheckCircle
        size={60}
        strokeWidth={2.5}
        className="text-white"
      />
    </motion.div>

  </div>
</div>

    {/* TITLE */}
    <div className="text-center mt-8">
      <h1 className="text-2xl font-semibold tracking-wide">
        Trip Completed
      </h1>

      <p className="text-green-200 text-sm mt-2">
        Great job today, driver
      </p>
    </div>

    {/* SUMMARY CARD */}
    {/* SUMMARY CARD */}
<div className="mt-10 bg-white/10 backdrop-blur-lg
rounded-3xl p-8 shadow-2xl border border-white/10
max-w-sm mx-auto">

  <div className="grid grid-cols-2 gap-y-10 gap-x-6 text-center">

    {/* Picked Up */}
    <div className="flex flex-col items-center">
      <p className="text-3xl font-bold leading-none">
        {trip.students}
      </p>
      <p className="text-green-200 text-xs mt-2 tracking-wide">
        Picked Up
      </p>
    </div>

    {/* Dropped Off */}
    <div className="flex flex-col items-center">
      <p className="text-3xl font-bold leading-none">
        {trip.students}
      </p>
      <p className="text-green-200 text-xs mt-2 tracking-wide">
        Dropped Off
      </p>
    </div>

    {/* Duration */}
    <div className="flex flex-col items-center">
      <p className="text-3xl font-bold leading-none">
        {duration}
      </p>
      <p className="text-green-200 text-xs mt-2 tracking-wide">
        Minutes
      </p>
    </div>

    {/* Earned */}
    <div className="flex flex-col items-center">
      <p className="text-3xl font-bold leading-none">
        ₹{trip.amount}
      </p>
      <p className="text-green-200 text-xs mt-2 tracking-wide">
        Earned
      </p>
    </div>

  </div>

</div>
    {/* INFO SECTION */}
    <div className="mt-6 bg-white/5 rounded-2xl p-4 
    text-sm text-green-200 border border-white/5">
      All students have been safely transported.  
      Payment will be processed within 24 hours.
    </div>

    {/* BUTTONS */}
    <div className="mt-auto">

      <button
        onClick={() => navigate("/dashboard")}
        className="w-full bg-yellow-400 hover:bg-yellow-300
        text-black font-semibold py-3 rounded-2xl
        shadow-lg transition"
      >
        Back to Home
      </button>

      <button
        onClick={() => navigate("/trips")}
        className="w-full text-center text-green-300 text-sm mt-4 hover:text-white transition"
      >
        View Trip History
      </button>

    </div>
  </div>
);
}

export default TripSuccess;
