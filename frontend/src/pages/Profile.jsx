import {
  Car,
  Mail,
  MapPin,
  Bell,
  Shield,
  HelpCircle,
  Star,
  LogOut,
  Home,
  Users,
  Map,
  User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

function Profile() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);

  useEffect(() => {
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        "https://asan-driverapp.onrender.com/api/driver/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setDriver(res.data);

    } catch (err) {
      console.error(err);
    }
  };

  fetchProfile();
}, []);
if (!driver) {
  return (
    <div className="h-screen flex items-center justify-center">
      Loading...
    </div>
  );
}
  return (
    <div className="min-h-screen bg-gray-200 flex justify-center items-start py-6">
  <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
  {/* Dark Background */}
  <div className="bg-gradient-to-b from-[#2f3e55] to-[#3b4b63] 
                  pt-10 pb-24 px-5 
                  rounded-b-[40px] 
                  shadow-lg">

    {/* Avatar */}
    <div className="flex flex-col items-center">
      <div className="w-24 h-24 bg-yellow-400 rounded-full 
                      flex items-center justify-center 
                      text-2xl font-bold text-black shadow-md">
       <div className="w-24 h-24 bg-yellow-400 rounded-full 
flex items-center justify-center 
text-2xl font-bold text-black shadow-md">
  {driver.name?.split(" ").map(n => n[0]).join("")}
</div>
      </div>

      <div className="mt-3 bg-yellow-400 text-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md font-semibold">
  <Star size={14} />
  {(driver.rating ?? 0).toFixed(1)}
</div>

      <h2 className="mt-3 text-lg font-semibold text-white">
        {driver.name}
      </h2>

      <p className="text-sm text-gray-300">
        +91 {driver.phone}
      </p>
    </div>

    {/* Stats Card */}
    <div className="mt-6 bg-white/10 backdrop-blur-md 
rounded-2xl p-4 flex justify-between text-center text-white border border-white/10"
    >
      <div className="flex-1">
        <p className="font-bold text-yellow-400">{driver.totalTrips||0}</p>
        <p className="text-xs opacity-80">Total Trips</p>
      </div>

      <div className="w-[1px] bg-white/20"></div>

      <div className="flex-1">
        <p className="font-bold text-yellow-400">{(driver.rating ?? 0).toFixed(1)}/5</p>
        <p className="text-xs opacity-80">Rating</p>
      </div>

      <div className="w-[1px] bg-white/20"></div>

      <div className="flex-1">
        <p className="font-bold text-yellow-400">
{new Date(driver.createdAt).toLocaleDateString("en-IN", {
  month: "long",
  year: "numeric"
})}</p>
        <p className="text-xs opacity-80">Since</p>
      </div>
    </div>

  </div>

        {/* ===== CONTENT SECTION ===== */}
        <div className="px-5 -mt-10 pb-24 space-y-6">

          {/* VEHICLE DETAILS */}
          <div>
            <h3 className="text-xs text-white font-semibold mb-3 tracking-wide">
              VEHICLE DETAILS
            </h3>

            <div className="bg-white rounded-2xl shadow-sm divide-y">

              <div className="flex items-center gap-4 p-4">
                <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
                  <Car size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Vehicle Type</p>
                  <p className="font-medium">{driver.vehicleType}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
                  <Car size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Registration</p>
                  <p className="font-medium">{driver.vehicleNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
                  <Car size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">License No.</p>
                  <p className="font-medium">{driver.licenseNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4">
  <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
    <Shield size={18} className="text-yellow-600" />
  </div>
  <div>
    <p className="text-xs text-gray-500">Driver ID</p>
    <p className="font-medium tracking-wide">{driver.driverId}</p>
  </div>
</div>
            </div>
          </div>

          {/* PERSONAL INFO */}
          <div>
            <h3 className="text-xs text-gray-500 font-semibold mb-3 tracking-wide">
              PERSONAL INFO
            </h3>

            <div className="bg-white rounded-2xl shadow-sm divide-y">

              <div className="flex items-center gap-4 p-4">
                <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
                  <Mail size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium">{driver.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4">
                <div className="bg-yellow-100/70 backdrop-blur-sm p-3 rounded-xl">
                  <MapPin size={18} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="font-medium">
                    {driver.address || "Not Provided"}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* SETTINGS */}
          <div>
            <h3 className="text-xs text-gray-500 font-semibold mb-3 tracking-wide">
              SETTINGS
            </h3>

            <div className="bg-white rounded-2xl shadow-sm divide-y">

              {[
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Shield, label: "Privacy Policy", path: "/privacy-policy" },
  { icon: HelpCircle, label: "Help & Support",path:"/help-support" },
  { icon: Star, label: "Rate the App" },
].map((item, index) => {
  const Icon = item.icon;

  return (
    <div
      key={index}
      onClick={() => item.path && navigate(item.path)}
      className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
    >
      <div className="flex items-center gap-4">
        <div className="bg-gray-100 p-3 rounded-xl">
          <Icon size={18} className="text-gray-600" />
        </div>
        <p className="font-medium">{item.label}</p>
      </div>
      <span className="text-gray-400">›</span>
    </div>
  );
})}

            </div>
          </div>

          {/* LOGOUT */}
          <div>
            <button
              onClick={() => {
  localStorage.removeItem("token");
  navigate("/");
}}
              className="w-full bg-red-100 text-red-600 py-3 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-red-200 transition"
            >
              <LogOut size={18} />
              Logout
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              ASAN Driver v1.0.0
            </p>
          </div>

        </div>

        {/* ===== BOTTOM NAV ===== */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white py-3 flex justify-around border-t shadow-md z-50">

          {[
            { icon: Home, label: "Home", path: "/dashboard" },
            { icon: Users, label: "Students", path: "/students" },
            { icon: Map, label: "Trips", path: "/trips" },
            { icon: User, label: "Profile", path: "/profile" },
          ].map((item, index) => {
            const Icon = item.icon;
            const active = item.label === "Profile";

            return (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center text-xs cursor-pointer ${
                  active ? "text-yellow-500" : "text-gray-600"
                }`}
              >
                <Icon size={20} />
                <span className="mt-1">{item.label}</span>
              </div>
            );
          })}

        </div>
        

      </div>
    </div>
  );
}

export default Profile;
