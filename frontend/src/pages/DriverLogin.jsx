  import { useState } from "react";
  import autoIcon from "../assets/auto.jpg";
  import { useNavigate } from "react-router-dom";
  import { useRef } from "react";
  import axios from "axios";
  import toast from "react-hot-toast";
  function DriverLogin() {
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
const [showSignupOtp, setShowSignupOtp] = useState(false);
const [signupOtp, setSignupOtp] = useState(["", "", "", ""]);
    const [loading, setLoading] = useState(false);
const [timer, setTimer] = useState(0);
  const licenseRef = useRef(null);
const rcRef = useRef(null);
const insuranceRef = useRef(null);
const idRef = useRef(null);
// Login states
const [phone, setPhone] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [showOTP, setShowOTP] = useState(false);
const [showPassword, setShowPassword] = useState(false);
const [otp, setOtp] = useState(["", "", "", ""]);

// Signup states
const [vehicleNumber, setVehicleNumber] = useState("");
const [vehicleType, setVehicleType] = useState("");
const [licenseNumber, setLicenseNumber] = useState("");
const [signupStep, setSignupStep] = useState(1);
const [name, setName] = useState("");
const [address, setAddress] = useState("");
const [selectedId, setSelectedId] = useState(null);

// Files
const [licenseFile, setLicenseFile] = useState(null);
const [rcFile, setRcFile] = useState(null);
const [insuranceFile, setInsuranceFile] = useState(null);
const [idImage, setIdImage] = useState(null);

// Tab
const [activeTab, setActiveTab] = useState("login");
const isValidPhone = /^[0-9]{10}$/.test(phone);
const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isStep1Valid =
  name &&
  isPhoneVerified &&
  isValidEmail &&
  address &&
  password.length >= 6;
const isStep2Valid =
  licenseFile &&
  rcFile &&
  insuranceFile &&
  vehicleNumber &&
  vehicleType &&
  licenseNumber;

const isStep3Valid =
  selectedId && idImage;

const isOtpComplete = otp.every((digit) => digit.trim() !== "");
const navigate = useNavigate();
const handleOtpChange = (e, index) => {
  const value = e.target.value;
  if (!/^[0-9]?$/.test(value)) return;

  const newOtp = [...otp];
  newOtp[index] = value;
  setOtp(newOtp);

  if (value && index < otp.length - 1) {
    document.getElementById(`otp-${index + 1}`).focus();
  }
};

const handleOtpKeyDown = (e, index) => {
  if (e.key === "Backspace" && !otp[index] && index > 0) {
    document.getElementById(`otp-${index - 1}`).focus();
  }
};
const sendOtp = async () => {
  try {
    setLoading(true);

    await axios.post("https://asan-driverapp.onrender.com/api/otp/send-otp", {
  phone,
  type: "login"
});

    toast.success("OTP Sent");
    setShowOTP(true);
    startTimer();

  } catch (err) {
  const message =
    err.response?.data?.message || "Failed to send OTP";

  toast.error(message);

  if (message.includes("Please sign up")) {
    setActiveTab("signup");
  }
} finally {
    setLoading(false);
  }
};
const startTimer = () => {
  setTimer(30);

  let interval = setInterval(() => {
    setTimer((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
};
const verifyOtp = async () => {
  if (loading) return; // extra safety

  try {
    setLoading(true);

    const enteredOtp = otp.join("");

    const res = await axios.post(
      "https://asan-driverapp.onrender.com/api/otp/verify-otp",
      {
        phone,
        otp: enteredOtp,
        type: "login"
      }
    );

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("driver", JSON.stringify(res.data.driver));

    navigate("/dashboard");

  } catch (error) {
    toast.error(error.response?.data?.message || "Invalid OTP");
  } finally {
    setLoading(false);
  }
};
const sendSignupOtp = async () => {
  try {
    setLoading(true);

    await axios.post("https://asan-driverapp.onrender.com/api/otp/send-otp", {
  phone,
  type: "signup"
});

    toast.success("OTP Sent");
    setShowSignupOtp(true);
    startTimer();

  } catch (err) {
    toast.error("Failed to send OTP");
  } finally {
    setLoading(false);
  }
};

const verifySignupOtp = async () => {
  try {
    setLoading(true);

    const enteredOtp = signupOtp.join("");

    await axios.post("https://asan-driverapp.onrender.com/api/otp/verify-otp", {
  phone,
  otp: enteredOtp,
  type: "signup"   // ✅ ADD THIS
});

    toast.success("Phone Verified ✅");
    setIsPhoneVerified(true);
    setShowSignupOtp(false);

  } catch (error) {
    toast.error("Invalid OTP");
  } finally {
    setLoading(false);
  }
};
const handleSignupOtpChange = (e, index) => {
  const value = e.target.value;

  // Allow only numbers
  if (!/^[0-9]?$/.test(value)) return;

  const newOtp = [...signupOtp];
  newOtp[index] = value;
  setSignupOtp(newOtp);

  // Move forward
  if (value && index < signupOtp.length - 1) {
    document.getElementById(`signup-otp-${index + 1}`).focus();
  }
};
const handleSignupOtpKeyDown = (e, index) => {
  if (e.key === "Backspace" && !signupOtp[index] && index > 0) {
    document.getElementById(`signup-otp-${index - 1}`).focus();
  }
};

const handleLogin = async () => {
  try {
    const res = await axios.post("/api/otp/verify-otp", {
  phone,
  otp: enteredOtp,
});

localStorage.setItem("token", res.data.token);
localStorage.setItem("driver", JSON.stringify(res.data.driver));

navigate("/dashboard");

  } catch (error) {
    toast.error(error.response?.data?.message || "Login Failed");
  }
};

const handleSignup = async () => {
  try {
    setLoading(true);

    const formData = new FormData();

    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("address", address);

    formData.append("license", licenseFile);
    formData.append("rc", rcFile);
    formData.append("insurance", insuranceFile);
    formData.append("idImage", idImage);
    formData.append("vehicleNumber", vehicleNumber);
    formData.append("vehicleType", vehicleType);
    formData.append("licenseNumber", licenseNumber);

    const res = await axios.post(
      "https://asan-driverapp.onrender.com/api/auth/signup",
      formData
    );

    // ✅ STORE TOKEN
    localStorage.setItem("token", res.data.token);

    // ✅ STORE DRIVER
    localStorage.setItem("driver", JSON.stringify(res.data.driver));

    toast.success("Signup successful");
    navigate("/dashboard");

  } catch (error) {
    toast.error("Signup Failed");
  } finally {
    setLoading(false);
  }
};

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white w-[420px] rounded-3xl shadow-xl p-8 text-center">

          {/* Header */}
          <div className="text-center mb-6">

    <div className="flex items-center justify-center gap-2">
      <img src={autoIcon} alt="Auto" className="w-8 h-8" />
      <h1 className="text-2xl font-bold text-yellow-600">
        ASAN CAPTAIN
      </h1>
    </div>

  <p className="text-xs font-bold mt-3 px-6 text-slate-800">
    WHERE RESPONSIBLE DRIVERS BECOME{" "}
    <span className="text-yellow-600">SAFETY CAPTAINS.</span>
  </p>

    <p className="text-gray-400 text-sm mt-2">
      ASAN DRIVER LOGIN
    </p>

  </div>
          {/* Toggle */}
          <div className="flex bg-gray-100 rounded-full p-1 mb-6">
            <button
              onClick={() => setActiveTab("login")}
              className={`w-1/2 py-2 rounded-full transition ${
                activeTab === "login"
                  ? "bg-yellow-500 text-white shadow-md"
                  : "text-gray-600"
              }`}
            >
              LOG IN
            </button>

            <button
              onClick={() => setActiveTab("signup")}
              className={`w-1/2 py-2 rounded-full transition ${
                activeTab === "signup"
                  ? "bg-yellow-500 text-white shadow-md"
                  : "text-gray-600"
              }`}
            >
              SIGN UP
            </button>
          </div>

          {/* ================= LOGIN VIEW ================= */}
          {activeTab === "login" && (
    <>
      {/* ================= STEP 1 ================= */}
      {!showOTP && !showPassword && (
        <>
          {/* PHONE INPUT */}
          <input
            type="text"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setEmail("");
            }}
            className="w-full border rounded-xl p-3 mb-3 focus:ring-2 focus:ring-yellow-400 outline-none"
          />

          {/* OR Divider */}
          <div className="flex items-center my-3">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="px-3 text-gray-400 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* EMAIL INPUT */}
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPhone("");
            }}
            className="w-full border rounded-xl p-3 mb-4 focus:ring-2 focus:ring-yellow-400 outline-none"
          />

          {/* Phone Flow Button */}
          {isValidPhone && (
  <button
    disabled={loading}
    onClick={sendOtp}
    className="w-full bg-yellow-500 text-white p-3 rounded-xl"
  >
    {loading ? "Sending..." : "Get OTP"}
  </button>
)}

          {/* Email Flow Button */}
          {isValidEmail && (
    <button
      onClick={() => setShowPassword(true)}
      className="w-full border p-3 rounded-xl"
    >
      Continue with Password
    </button>
  )}
        </>
      )}

      {/* ================= OTP STEP ================= */}
      {showOTP && (
  <>
    <p className="text-sm text-gray-600 mb-3">
      OTP sent to {phone}
    </p>

    <div className="flex gap-3 justify-center mb-4">
      {otp.map((digit, index) => (
        <input
  id={`otp-${index}`}
  key={index}
  maxLength={1}
  value={digit}
  onChange={(e) => handleOtpChange(e, index)}
  onKeyDown={(e) => handleOtpKeyDown(e, index)}
  className="w-12 h-12 text-center border rounded-xl"
/>
      ))}
    </div>
    <button
  disabled={!isOtpComplete || loading}
  onClick={verifyOtp}
  className={`w-full p-3 rounded-xl font-semibold transition ${
    isOtpComplete
      ? "bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer"
      : "bg-gray-300 text-gray-500 cursor-not-allowed"
  }`}
>
  Verify OTP
</button>

    {timer > 0 ? (
      <p className="text-sm text-gray-400 mt-3 text-center">
        Resend OTP in {timer}s
      </p>
    ) : (
      <button
        onClick={sendOtp}
        className="text-yellow-600 text-sm mt-3"
      >
        Resend OTP
      </button>
    )}

    <button
      onClick={() => {
        setShowOTP(false);
        setOtp(["", "", "", ""]);
      }}
      className="text-sm text-gray-400 mt-3 block w-full"
    >
      ← Change phone number
    </button>
  </>
)}

      {/* ================= PASSWORD STEP ================= */}
      {showPassword && (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Login with {email}
          </p>

          <input
    type="password"
    placeholder="Enter password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="w-full border rounded-xl p-3 mb-3"
  />

         <button
  disabled={!password}
  onClick={handleLogin}
  className={`w-full p-3 rounded-xl ${
    password
      ? "bg-green-500 text-white"
      : "bg-gray-300 text-gray-500 cursor-not-allowed"
  }`}
>
  Login
</button>

          <button
            onClick={() => {
              setShowPassword(false);
              setPassword("");
            }}
            className="text-sm text-gray-400 mt-3 hover:text-gray-600"
          >
            ← Change email
          </button>
        </>
      )}
    </>
  )}

          {/* ================= SIGNUP VIEW ================= */}
          {activeTab === "signup" && (
    <>
      {/* ===== STEP INDICATOR ===== */}
      <div className="mb-4 text-left">
        <p className="text-sm text-gray-500">
          Step {signupStep} of 4
        </p>

        <div className="flex gap-2 mt-2">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={`h-1 flex-1 rounded-full ${
                signupStep >= num
                  ? "bg-yellow-500"
                  : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ================= STEP 1 ================= */}
      {signupStep === 1 && (
  <>
    <h2 className="text-2xl font-bold mb-1">
      Personal Details
    </h2>

    <p className="text-gray-500 mb-6">
      Tell us about yourself to get started
    </p>

    <input
      type="text"
      placeholder="Full Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      className="w-full p-3 border rounded-xl mb-4"
    />

    {/* PHONE FIELD */}
    <div className="relative mb-3">
      <input
        type="text"
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setIsPhoneVerified(false);
        }}
        className="w-full p-3 border rounded-xl pr-10"
      />

      {isPhoneVerified && (
        <span className="absolute right-3 top-3 text-green-600 font-bold">
          ✔
        </span>
      )}
    </div>

    {/* VERIFY BUTTON */}
    {!isPhoneVerified && /^[0-9]{10}$/.test(phone) && (
      <button
        type="button"
        onClick={sendSignupOtp}
        className="w-full bg-blue-500 text-white p-2 rounded-xl mb-3"
      >
        Verify Number
      </button>
    )}

    {/* SIGNUP OTP UI */}
    {showSignupOtp && (
      <>
        <div className="flex gap-3 justify-center mb-3">
  {signupOtp.map((digit, index) => (
    <input
      id={`signup-otp-${index}`}
      key={index}
      maxLength={1}
      value={digit}
      onChange={(e) => handleSignupOtpChange(e, index)}
      onKeyDown={(e) => handleSignupOtpKeyDown(e, index)}
      className="w-12 h-12 text-center border rounded-xl text-lg font-bold"
    />
  ))}
</div>

        <button
          onClick={verifySignupOtp}
          className="w-full bg-green-500 text-white p-2 rounded-xl mb-4"
        >
          Verify OTP
        </button>
      </>
    )}

    <input
      type="email"
      placeholder="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="w-full p-3 border rounded-xl mb-4"
    />

    <input
      type="password"
      placeholder="Create Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full p-3 border rounded-xl mb-6"
    />

    <input
      type="text"
      placeholder="Residential Address"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      className="w-full p-3 border rounded-xl mb-4"
    />

    <button
      disabled={!isStep1Valid}
      onClick={() => setSignupStep(2)}
      className={`w-full py-3 rounded-xl ${
        isStep1Valid
          ? "bg-yellow-500 text-white"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }`}
    >
      Continue →
    </button>
  </>
)}
     {/* ================= STEP 2 ================= */}
{signupStep === 2 && (
  <>
    <h2 className="text-2xl font-bold mb-1">
      Vehicle & License Details
    </h2>

    <p className="text-gray-500 mb-6">
      Upload your documents and enter vehicle details
    </p>

    {/* ================= DRIVING LICENSE ================= */}
    <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
      <h3 className="font-semibold text-gray-800 mb-3">
        Driving License
      </h3>

      <input
        type="file"
        accept="image/*"
        hidden
        ref={licenseRef}
        onChange={(e) => setLicenseFile(e.target.files[0])}
      />

      <div
        onClick={() => licenseRef.current.click()}
        className="border-2 border-dashed border-yellow-400 rounded-xl p-4 text-center cursor-pointer hover:bg-yellow-50 transition"
      >
        {licenseFile ? (
          <img
            src={URL.createObjectURL(licenseFile)}
            alt="License"
            className="w-20 h-20 mx-auto rounded"
          />
        ) : (
          <p className="text-gray-500">Tap to upload license</p>
        )}
      </div>

      <input
        type="text"
        placeholder="Enter License Number"
        value={licenseNumber}
        onChange={(e) => setLicenseNumber(e.target.value)}
        className="w-full mt-4 p-3 border rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none"
      />
    </div>

    {/* ================= VEHICLE RC ================= */}
    <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
      <h3 className="font-semibold text-gray-800 mb-3">
        Registration Certificate (RC)
      </h3>

      <input
        type="file"
        accept="image/*"
        hidden
        ref={rcRef}
        onChange={(e) => setRcFile(e.target.files[0])}
      />

      <div
        onClick={() => rcRef.current.click()}
        className="border-2 border-dashed border-yellow-400 rounded-xl p-4 text-center cursor-pointer hover:bg-yellow-50 transition"
      >
        {rcFile ? (
          <img
            src={URL.createObjectURL(rcFile)}
            alt="RC"
            className="w-20 h-20 mx-auto rounded"
          />
        ) : (
          <p className="text-gray-500">Tap to upload RC</p>
        )}
      </div>

      <input
        type="text"
        placeholder="Enter Vehicle Number"
        value={vehicleNumber}
        onChange={(e) => setVehicleNumber(e.target.value)}
        className="w-full mt-4 p-3 border rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none"
      />
    </div>

    {/* ================= INSURANCE ================= */}
    <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
      <h3 className="font-semibold text-gray-800 mb-3">
        Insurance Certificate
      </h3>

      <input
        type="file"
        accept="image/*"
        hidden
        ref={insuranceRef}
        onChange={(e) => setInsuranceFile(e.target.files[0])}
      />

      <div
        onClick={() => insuranceRef.current.click()}
        className="border-2 border-dashed border-yellow-400 rounded-xl p-4 text-center cursor-pointer hover:bg-yellow-50 transition"
      >
        {insuranceFile ? (
          <img
            src={URL.createObjectURL(insuranceFile)}
            alt="Insurance"
            className="w-20 h-20 mx-auto rounded"
          />
        ) : (
          <p className="text-gray-500">Tap to upload Insurance</p>
        )}
      </div>

      <input
        type="text"
        placeholder="Enter Vehicle Type (Auto, Cab, etc.)"
        value={vehicleType}
        onChange={(e) => setVehicleType(e.target.value)}
        className="w-full mt-4 p-3 border rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none"
      />
    </div>

    {/* Continue Button */}
    <button
      disabled={!isStep2Valid}
      onClick={() => setSignupStep(3)}
      className={`w-full py-3 rounded-xl font-semibold transition ${
        isStep2Valid
          ? "bg-yellow-500 text-black hover:bg-yellow-600"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }`}
    >
      Continue →
    </button>
  </>
)}
  {/* ================= STEP 3 ================= */}
  {signupStep === 3 && (
  <>
    <h2 className="text-2xl font-bold mb-1">
      Identity Verification
    </h2>

    <p className="text-gray-500 mb-6">
      Upload a valid government ID for verification
    </p>

    {/* ================= ID CARD ================= */}
    <div className="bg-white rounded-2xl shadow-md p-5 mb-5">

      {/* ID Selection */}
      <h3 className="font-semibold text-gray-800 mb-3">
        Select ID Type
      </h3>

      <div className="flex gap-3 flex-wrap mb-5">
        {["Aadhaar", "Voter", "Passport"].map((id) => (
          <div
            key={id}
            onClick={() => setSelectedId(id)}
            className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition ${
              selectedId === id
                ? "bg-yellow-500 text-black"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            }`}
          >
            {id}
          </div>
        ))}
      </div>

      {/* Upload Section */}
      <h3 className="font-semibold text-gray-800 mb-3">
        Upload {selectedId || "Government ID"}
      </h3>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        ref={idRef}
        onChange={(e) => setIdImage(e.target.files[0])}
      />

      <div
        onClick={() => idRef.current.click()}
        className="border-2 border-dashed border-yellow-400 rounded-xl p-6 text-center cursor-pointer hover:bg-yellow-50 transition"
      >
        {idImage ? (
          <img
            src={URL.createObjectURL(idImage)}
            alt="ID Preview"
            className="w-24 h-24 mx-auto rounded"
          />
        ) : (
          <p className="text-gray-500">
            Tap to upload ID image
          </p>
        )}
      </div>

      {/* Security Message */}
      <div className="bg-yellow-100 text-yellow-800 p-4 rounded-xl text-sm mt-5 flex items-center gap-2">
        🔒 Your identity is encrypted and securely stored
      </div>
    </div>

    {/* Continue Button */}
    <button
      disabled={!isStep3Valid}
      onClick={() => setSignupStep(4)}
      className={`w-full py-3 rounded-xl font-semibold transition ${
        isStep3Valid
          ? "bg-yellow-500 text-black hover:bg-yellow-600"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }`}
    >
      Continue →
    </button>
  </>
)}

      {/* ================= STEP 4 ================= */}
  {signupStep === 4 && (
    <>
      <h2 className="text-2xl font-bold mb-1">
        Review & Submit
      </h2>

      <p className="text-gray-500 mb-6">
        Confirm your information before submitting
      </p>

      {/* ===== Personal Details Card ===== */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 text-left">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-800">
            Personal Details
          </h3>
          <button
            onClick={() => setSignupStep(1)}
            className="text-yellow-600 text-sm font-medium"
          >
            Edit
          </button>
        </div>

        <div className="text-sm text-gray-600 space-y-2">
          <div className="flex justify-between">
            <span>Full Name</span>
            <span className="font-medium">{name}</span>
          </div>
          <div className="flex justify-between">
            <span>Phone</span>
            <span className="font-medium">{phone}</span>
          </div>
          <div className="flex justify-between">
            <span>Email</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex justify-between">
            <span>Address</span>
            <span className="font-medium">{address}</span>
          </div>
        </div>
      </div>

      {/* ===== Vehicle Documents ===== */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 text-left">
  <h3 className="font-semibold text-gray-800 mb-3">
    Vehicle Documents
  </h3>

  {[
    { name: "Driving License", file: licenseFile },
    { name: "RC Certificate", file: rcFile },
    { name: "Insurance", file: insuranceFile },
  ].map((doc, i) => (
    <div key={i} className="flex justify-between mb-2 text-sm">
      <span>{doc.name}</span>
      <span className={doc.file ? "text-green-600" : "text-red-500"}>
        {doc.file ? "✔ Uploaded" : "Not Uploaded"}
      </span>
    </div>
  ))}
</div>

      {/* ===== Identity Document ===== */}
<div className="bg-white rounded-2xl shadow p-4 mb-4 text-left">
  <h3 className="font-semibold text-gray-800 mb-3">
    Identity Document
  </h3>

  <div className="flex justify-between text-sm">
    <span>{selectedId}</span>
    <span className={idImage ? "text-green-600" : "text-red-500"}>
      {idImage ? "✔ Uploaded" : "Not Uploaded"}
    </span>
  </div>
</div>

      {/* Confirmation Message */}
      <div className="bg-green-100 text-green-800 p-4 rounded-xl text-sm mb-6">
        ✔ By submitting, you confirm that all information provided is accurate and authentic.
      </div>

      {/* Submit Button */}
      <button
  disabled={!isStep1Valid || !isStep2Valid || !isStep3Valid}
  onClick={handleSignup}
  className={`w-full py-3 rounded-xl ${
    isStep1Valid && isStep2Valid && isStep3Valid
      ? "bg-yellow-500 text-black"
      : "bg-gray-300 text-gray-500 cursor-not-allowed"
  }`}
>
  Submit for Verification →
</button>
    </>
  )}
    </>
  )}
        </div>
      </div>
    );
  }

  export default DriverLogin;
