import { useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flag, MapPin, CheckCircle } from "lucide-react";
import ActiveTripScreen from "./ActiveTripScreen";
import { useEffect } from "react";
import axios from "axios";
import { useRef } from "react";
import { useTransform } from "framer-motion";
import { Bell } from "lucide-react";
import {
  Sun,
  CloudSun,
  Users,
  Home,
  User,
  Clock,
  Star,       
  Play         
} from "lucide-react";

function DriverDashboard() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [tripType, setTripType] = useState("morning");
  const navigate = useNavigate();
  const startTrip = async () => {
  try {
    const token = localStorage.getItem("token");

    await axios.post(
      "http://localhost:5000/api/trip/start",
      { tripType },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setTripStarted(true);

  } catch (err) {
    console.error(err);
  }
};
  const [driverData, setDriverData] = useState(null);
  useEffect(() => {
  const fetchDashboard = async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      "http://localhost:5000/api/driver/dashboard",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setDriverData(res.data);

  } catch (err) {
    console.error(err);
  }
};

  fetchDashboard();
}, []);
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        "http://localhost:5000/api/notifications",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const unread = res.data.filter(n => !n.read).length;
      setUnreadCount(unread);

    } catch (err) {
      console.error(err);
    }
  };

  fetchNotifications();
}, []);
const sliderRef = useRef(null);
const x = useMotionValue(0);
const progressWidth = useTransform(x, [0, 250], ["0%", "100%"]);
const [tripStarted, setTripStarted] = useState(false);
const [currentDate, setCurrentDate] = useState(new Date());
const changeMonth = (dir) => {
  setCurrentDate(new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + dir,
    1
  ));
};
if (!driverData) {
  return <div>Loading...</div>;
}

return !tripStarted ? (
  <div className="min-h-screen bg-gray-100 flex justify-center">
    <div className="w-96 bg-gray-100 rounded-3xl overflow-hidden shadow-xl relative">

      {/* ===== YELLOW HEADER ===== */}
      <div className="bg-gradient-to-b from-yellow-400 to-yellow-300 p-5 pb-10 text-black">
        <p className="text-sm">Good Morning</p>
        <h1 className="text-2xl font-bold">
  {driverData.name}
</h1>
        <p className="text-sm mt-1">
{driverData?.vehicleNumber ?? "-"} • {driverData?.vehicleType ?? "-"}</p>

        {/* Notification Bell */}
<div className="absolute top-5 right-5">
  <div
    onClick={() => navigate("/notifications")}
    className="relative cursor-pointer"
  >
    <Bell size={22} className="text-black" />

    {unreadCount > 0 && (
      <span className="absolute -top-2 -right-2 bg-red-500 text-white
                       text-[10px] min-w-[18px] h-[18px]
                       flex items-center justify-center
                       rounded-full px-1 font-semibold">
        {unreadCount}
      </span>
    )}
  </div>
</div>
      </div>

      {/* ===== TODAY'S TRIPS CARD ===== */}
      <div className="px-5 -mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Today's Trips</h2>
            <span className="text-xs bg-yellow-100 px-2 py-1 rounded">
              {new Date().toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
})}
            </span>
          </div>

          <div className="flex gap-3 mt-3">
  <button
  onClick={() => setTripType("morning")}
  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium border-2 ${
    tripType === "morning"
      ? "border-green-600 bg-green-100 text-green-700"
      : "border-green-500 text-green-600"
  }`}
>
  <Sun size={16} />
  Morning
</button>

<button
  onClick={() => setTripType("afternoon")}
  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium border-2 ${
    tripType === "afternoon"
      ? "border-yellow-600 bg-yellow-100 text-yellow-700"
      : "border-yellow-500 text-yellow-600"
  }`}
>
  <CloudSun size={16} />
  Afternoon
</button>
</div>
        </div>
      </div>

      {/* ===== STUDENTS ASSIGNED CARD ===== */}
      <div className="px-5 mt-4">
        <div className="bg-yellow-100 rounded-2xl p-5 shadow-sm">
          <h1 className="text-4xl font-bold">
  {driverData?.studentsAssigned ?? 0}
</h1>

          <div className="flex justify-between mt-4 text-xs text-gray-600">

  <div className="flex flex-col items-center gap-1">
    <Flag size={16} />
    <span>Start</span>
  </div>

  <div className="flex flex-col items-center gap-1">
    <Users size={16} />
    <span>Pickup</span>
  </div>

  <div className="flex flex-col items-center gap-1">
    <MapPin size={16} />
    <span>Drop</span>
  </div>

  <div className="flex flex-col items-center gap-1">
    <CheckCircle size={16} />
    <span>Done</span>
  </div>

</div>
        </div>
      </div>

      {/* ===== ALL TIME STATS ===== */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl shadow-md p-4 flex justify-between text-center">

  <div className="flex-1">
    <p className="font-bold text-lg">{driverData?.totalTrips ?? 0}</p>
    <p className="text-xs text-gray-500">Total Trips</p>
  </div>

  <div className="w-[1px] bg-gray-200"></div>

  <div className="flex-1">
    <p className="font-bold text-lg">{driverData?.studentsAssigned ?? 0}</p>
    <p className="text-xs text-gray-500">Students</p>
  </div>

  <div className="w-[1px] bg-gray-200"></div>

  <div className="flex-1">
    <p className="font-bold text-lg">{Number(driverData?.rating || 0).toFixed(1)}</p>
    <p className="text-xs text-gray-500">Rating</p>
  </div>

</div>
      </div>

      {/* ===== SLIDE TO START ===== */}
<div className="px-5 mt-6 mb-24">
  <div
    ref={sliderRef}
    className="relative bg-yellow-100 rounded-full h-14 flex items-center"
  >
    {/* Progress Background */}
    <motion.div
      className="absolute left-0 top-0 h-full bg-green-500 rounded-full"
      style={{ width: progressWidth }}
    />

    {/* Drag Button */}
    <motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 240 }}
  style={{ x }}
  onDragEnd={() => {
    if (x.get() > 150) {
      startTrip();
    } else {
      animate(x, 0);
    }
  }}
  className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 ml-1"
>
  <Play size={18} className="text-green-600" />
</motion.div>

    {/* Center Text */}
    <div className="absolute inset-0 flex items-center justify-center font-semibold text-black pointer-events-none">
      Slide to Start {tripType.charAt(0).toUpperCase() + tripType.slice(1)} Trip
    </div>
  </div>
</div>


      {/* ===== BOTTOM NAV ===== */}
      <div className="absolute bottom-0 left-0 w-full bg-white py-3 flex justify-around border-t">

  {[
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Users, label: "Students", path: "/students" },
  { icon: Clock, label: "Trips", path: "/trips" },
  { icon: User, label: "Profile", path: "/profile" },
].map((item, index) => {
  const Icon = item.icon;
  return (
    <div
      key={index}
      onClick={() => navigate(item.path)}
      className="flex flex-col items-center text-xs text-gray-600 cursor-pointer"
    >
      <Icon size={20} />
      <span className="mt-1">{item.label}</span>
    </div>
  );
})}
</div>
    </div>
  </div>
) : (
  <ActiveTripScreen />
);
}

export default DriverDashboard;