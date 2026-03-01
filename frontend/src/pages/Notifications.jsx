import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";

function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get(
          "https://asan-driverapp.onrender.com/api/notifications",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setNotifications(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotifications();
  }, []);

  // ✅ MARK AS READ FUNCTION
  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem("token");

      await axios.put(
        `https://asan-driverapp.onrender.com/api/notifications/${id}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update frontend state
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Format time
  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 60000);

    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} mins ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#3f4f67] to-[#2f3e55]
                      rounded-3xl shadow-xl overflow-hidden flex flex-col">

        {/* HEADER */}
        <div className="pt-12 pb-10 px-6 text-white text-center">
          <h1 className="text-xl font-semibold">Notifications</h1>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-t-3xl flex-1 overflow-y-auto">

          {notifications.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No notifications yet
            </div>
          )}

          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => markAsRead(n._id)}
              className={`p-4 border-b cursor-pointer transition
                ${!n.read ? "bg-yellow-50" : "bg-white"}`}
            >
              <div className="flex justify-between items-start">
                <h3 className={`font-semibold ${!n.read ? "text-black" : "text-gray-700"}`}>
                  {n.title}
                </h3>

                <span className="text-xs text-gray-400">
                  {formatTime(n.createdAt)}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                {n.message}
              </p>

              {!n.read && (
                <div className="mt-2 w-2 h-2 bg-red-500 rounded-full"></div>
              )}
            </div>
          ))}

          <div className="p-4">
            <button
              onClick={() => navigate(-1)}
              className="w-full bg-yellow-400 py-2 rounded-xl font-semibold"
            >
              Back
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Notifications;
