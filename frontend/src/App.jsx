import { Routes, Route, Navigate } from "react-router-dom";
import DriverLogin from "./pages/DriverLogin";
import DriverDashboard from "./pages/DriverDashboard";
import Profile from "./pages/Profile";
import Students from "./pages/Students";
import Trips from "./pages/Trips";
import  ActiveTripScreen from "./pages/ActiveTripScreen";
import TripSuccess from "./pages/TripSuccess";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "react-hot-toast";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import HelpSupport from "./pages/HelpSupport";
import Notifications from "./pages/Notifications";
function App() {
  return (
    <>
      <Toaster position="top-center" />

      <Routes>
        <Route path="/" element={<Navigate to="/DriverLogin" />} />

        <Route path="/DriverLogin" element={<DriverLogin />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route path="/students" element={<Students />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/activetrip" element={<ActiveTripScreen />} />
        <Route path="/trip-success" element={<TripSuccess />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/help-support" element={<HelpSupport />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </>
  );
}

export default App;