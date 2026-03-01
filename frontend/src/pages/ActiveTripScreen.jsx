import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { MapPin } from "lucide-react";
import { CheckCircle } from "lucide-react";
import axios from "axios";

function ActiveTripScreen() {
  const navigate = useNavigate();
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [students, setStudents] = useState([]);
  useEffect(() => {
  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        "https://asan-driverapp.onrender.com/api/students/active",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStudents(res.data);

    } catch (err) {
      console.error(err);
    }
  };

  fetchStudents();
}, []);
  const waiting = students.filter(s => s.status === "waiting").length;
  const onboard = students.filter(s => s.status === "onboard").length;
  const dropped = students.filter(s => s.status === "dropped").length;
    const total = students.length;
const progress = total === 0 ? 0 : (dropped / total) * 100;
  const handlePickup = async (id) => {
  try {
    const token = localStorage.getItem("token");

    await axios.put(
      `https://asan-driverapp.onrender.com/api/students/${id}/pickup`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setStudents(prev =>
      prev.map(s =>
        s._id === id ? { ...s, status: "onboard" } : s
      )
    );

  } catch (err) {
    console.error(err);
  }
};

  const handleDrop = async (id) => {
  try {
    const token = localStorage.getItem("token");

    await axios.put(
      `https://asan-driverapp.onrender.com/api/students/${id}/drop`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setStudents(prev =>
      prev.map(s =>
        s._id === id ? { ...s, status: "dropped" } : s
      )
    );

  } catch (err) {
    console.error(err);
  }
};
  return (
  <div className="h-screen w-full max-w-sm mx-auto bg-gray-50 flex flex-col">

    {/* ================= MAP ================= */}
    <div className="relative h-56 w-full">

      {/* Map Background */}
      <div className="absolute inset-0 bg-gray-300" />

      {/* Light Overlay */}
      <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px]" />

      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 font-medium">
  <MapPin size={28} className="mb-2 text-gray-600" />
  Map View
</div>

      {/* LIVE Badge */}
      <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
        LIVE
      </div>
    </div>


    {/* ================= CONTENT PANEL ================= */}
    <div className="flex-1 bg-gray-50 px-4 pt-6 pb-4 flex flex-col justify-between">

      {/* Top Section */}
      <div className="space-y-4">

        {/* STATUS */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl shadow-md px-6 py-4 flex justify-between text-sm font-semibold"
        >
          <span className="text-green-600">{dropped} Dropped</span>
          <span className="text-blue-600">{onboard} On Board</span>
          <span className="text-yellow-500">{waiting} Waiting</span>
        </motion.div>


        {/* PROGRESS */}
        <div className="bg-white rounded-2xl shadow-md p-4">
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-gray-600">Trip Progress</span>
            <span className="text-gray-800">{Math.round(progress)}%</span>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-green-400 to-green-600"
            />
          </div>
        </div>


        {/* STUDENTS */}
        <div className="space-y-3">
          {students.map(student => (
            <motion.div
              key={student._id}
              layout
              className="bg-white rounded-2xl shadow-md px-4 py-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-800">
                  {student.name}
                </p>

                <span className="text-xs text-gray-500">
                  {student.status === "waiting" && "Waiting for Pickup"}
                  {student.status === "onboard" && "On Board"}
                  {student.status === "dropped" && "Dropped"}
                </span>
              </div>

              {student.status === "waiting" && (
                <button
                  onClick={() => handlePickup(student._id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm shadow"
                >
                  Pickup
                </button>
              )}

              {student.status === "onboard" && (
                <button
                  onClick={() => handleDrop(student._id)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-full text-sm shadow"
                >
                  Drop
                </button>
              )}

              {student.status === "dropped" && (
                <div className="w-9 h-9 flex items-center justify-center">
  <CheckCircle size={22} className="text-green-600" />
</div>  
              )}
            </motion.div>
          ))}
        </div>

      </div>


      {/* ================= BOTTOM BUTTON ================= */}
      
<button
  className="text-red-600"
  onClick={() => setShowEndPopup(true)}
>
  END TRIP
</button>
{/* ===== POPUP ===== */}
    {showEndPopup && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white w-80 rounded-xl shadow-xl p-6">

         <button
  className="text-red-600"
  onClick={async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.post(
        "http://localhost:5000/api/trip/end",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      navigate("/trip-success", { state: res.data });

    } catch (err) {
      console.error(err);
    }
  }}
>
  END TRIP
</button>

          <p className="text-gray-600 text-sm">
            Are you sure you want to end this trip?
          </p>

          <div className="flex justify-end gap-6 mt-6 text-sm font-medium">
            <button
              className="text-gray-500"
              onClick={() => setShowEndPopup(false)}
            >
              CANCEL
            </button>

            <button
              className="text-red-600"
              onClick={async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.post(
  "http://localhost:5000/api/trip/end",
  {},
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

navigate("/trip-success", { state: res.data });

  } catch (err) {
    console.error(err);
  }
}}
            >
              END TRIP
            </button>
          </div>

        </div>
      </div>
    )}
    </div>

  </div>
);
}

export default ActiveTripScreen;
