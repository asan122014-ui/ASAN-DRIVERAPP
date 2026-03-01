import { useState } from "react";
import { Search, Users, Home, Clock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";

function Students() {
  const navigate = useNavigate();

  const [studentsData, setStudentsData] = useState([]);

useEffect(() => {
  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(
        "http://localhost:5000/api/students",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStudentsData(res.data);

    } catch (err) {
      console.error(err);
    }
  };

  fetchStudents();
}, []);

  const [search, setSearch] = useState("");

  const filteredStudents = studentsData.filter((student) =>
    student.name.toLowerCase().includes(search.toLowerCase())
  );

  const waiting = studentsData.filter(s => s.status === "Waiting").length;
  const onboard = studentsData.filter(s => s.status === "On Board").length;
  const dropped = studentsData.filter(s => s.status === "Dropped").length;

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-96 bg-white shadow-xl rounded-3xl overflow-hidden relative">

        {/* ===== HEADER ===== */}
        <div className="p-5 border-b">
          <h1 className="text-xl font-semibold">My Students</h1>
          <p className="text-sm text-gray-500">
            {studentsData.length} students assigned
          </p>
        </div>

        {/* ===== STATUS COUNTERS ===== */}
        <div className="px-5 mt-4 flex gap-3">
          <div className="flex-1 bg-yellow-100 text-center py-2 rounded-xl">
            <p className="font-bold text-yellow-600">{waiting}</p>
            <p className="text-xs text-gray-600">Waiting</p>
          </div>

          <div className="flex-1 bg-green-100 text-center py-2 rounded-xl">
            <p className="font-bold text-green-600">{onboard}</p>
            <p className="text-xs text-gray-600">On Board</p>
          </div>

          <div className="flex-1 bg-gray-200 text-center py-2 rounded-xl">
            <p className="font-bold text-gray-600">{dropped}</p>
            <p className="text-xs text-gray-600">Dropped</p>
          </div>
        </div>

        {/* ===== SEARCH BAR ===== */}
        <div className="px-5 mt-4">
          <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2">
            <Search size={16} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search by name or class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
        </div>

        {/* ===== STUDENTS LIST ===== */}
        <div className="px-5 mt-4 space-y-3 mb-20">
          {filteredStudents.map((student, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-xl shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 ${student.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}
                >
                  {student.initials}
                </div>

                <div>
                  <p className="font-medium text-sm">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.className}</p>
                </div>
              </div>

              <span className={`text-xs px-2 py-1 rounded-full ${
  student.status === "Waiting"
    ? "bg-yellow-100 text-yellow-600"
    : student.status === "On Board"
    ? "bg-green-100 text-green-600"
    : "bg-gray-200 text-gray-600"
}`}>
                {student.status}
              </span>
            </div>
          ))}
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
            const active = item.label === "Students";

            return (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center text-xs cursor-pointer ${
                  active ? "text-yellow-500" : "text-gray-600"
                }`}
              >
                <Icon
  size={20}
  strokeWidth={active ? 2.5 : 2}
/>
                <span className="mt-1">{item.label}</span>
              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}

export default Students;