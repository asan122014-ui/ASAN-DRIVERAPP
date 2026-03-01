  import { useState } from "react";
  import { Sun, Moon, Users, Clock, Home, User, Map,Star } from "lucide-react";
  import { useNavigate } from "react-router-dom";
  import { useEffect } from "react";
  import axios from "axios";

  function Trips() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("All");

    const [tripsData, setTripsData] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get(
          "https://asan-driverapp.onrender.com/api/trip/history",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setTripsData(res.data);

      } catch (err) {
        console.error(err);
      }
    };

    fetchTrips();
  }, []);
  const totalEarnings = tripsData.reduce((sum, t) => sum + t.amount, 0);
  const totalTrips = tripsData.length;
  const avgRating =
    tripsData.length > 0
      ? (
          tripsData.reduce((sum, t) => sum + (t.rating || 0), 0) /
          tripsData.length
        ).toFixed(1)
      : 0;

    const filteredTrips =
      activeTab === "All"
        ? tripsData
        : tripsData.filter((trip) => trip.tripType === activeTab);

    return (
      <div className="min-h-screen bg-gray-100 flex justify-center">
        <div className="w-96 bg-gray-100 rounded-3xl overflow-hidden shadow-xl relative">

          {/* ===== HEADER ===== */}
          <div className="p-5">
            <h1 className="text-2xl font-semibold">My Trips</h1>
          </div>

          {/* ===== SUMMARY CARD ===== */}
          <div className="px-5">
            <div className="bg-[#1f2937] text-white rounded-2xl p-5 flex justify-between text-center">

              <div className="flex-1">
                <p className="text-yellow-400 text-xl font-bold">₹{totalEarnings}</p>
                <p className="text-xs text-gray-300">Total Earnings</p>
              </div>

              <div className="w-[1px] bg-gray-600 mx-3"></div>

              <div className="flex-1">
                <p className="text-yellow-400 text-xl font-bold">{totalTrips}</p>
                <p className="text-xs text-gray-300">Trips Done</p>
              </div>

              <div className="w-[1px] bg-gray-600 mx-3"></div>

              <div className="flex-1 flex flex-col items-center">
  <div className="flex items-center gap-1">
    <p className="text-yellow-400 text-xl font-bold">
      {avgRating}
    </p>
    <Star size={16} className="text-yellow-400" />
  </div>
  <p className="text-xs text-gray-300 mt-1">Avg. Rating</p>
</div>

            </div>
          </div>

          {/* ===== TABS ===== */}
          <div className="px-5 mt-6 flex justify-between text-gray-500 font-medium relative">

            {["All", "Morning", "Afternoon"].map((tab) => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer pb-2 ${
                  activeTab === tab ? "text-black" : ""
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="h-1 bg-yellow-400 rounded-full mt-1"></div>
                )}
              </div>
            ))}

          </div>

          {/* ===== TRIP LIST ===== */}
          <div className="px-5 mt-4 space-y-4 mb-24">
            {filteredTrips.map((trip, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-4 shadow-md"
              >
                <div className="flex justify-between items-start">

                  {/* LEFT ICON */}
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    {trip.triptype === "Morning" ? (
                      <Sun size={20} strokeWidth={2} className="text-yellow-500" />
                    ) : (
                      <Moon size={20} strokeWidth={2} className="text-purple-500" />
                    )}
                  </div>

                  {/* RIGHT CONTENT */}
                  <div className="flex-1 ml-4">

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">{new Date(trip.date).toLocaleDateString()}</p>

                      <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full">
                        {trip.status}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold mt-1">
                      {trip.tripType} Trip
                    </h2>

                    <div className="flex gap-3 mt-3 text-xs">

                      <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-gray-600">
                        <Users size={14} />
                        {trip.students} students
                      </div>

                      <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-gray-600">
                        <Clock size={14} />
                        {trip.duration}
                      </div>

                      <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full text-yellow-700 font-semibold">
                        ₹{trip.amount}
                      </div>

                    </div>

                  </div>

                </div>
              </div>
            ))}
          </div>

          {/* ===== BOTTOM NAV ===== */}
          <div className="absolute bottom-0 left-0 w-full bg-white py-3 flex justify-around border-t">

            {[
              { icon: Home, label: "Home", path: "/dashboard" },
              { icon: Users, label: "Students", path: "/students" },
              { icon: Map, label: "Trips", path: "/trips" },
              { icon: User, label: "Profile", path: "/profile" },
            ].map((item, index) => {
              const Icon = item.icon;
              const active = item.label === "Trips";

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

  export default Trips;
