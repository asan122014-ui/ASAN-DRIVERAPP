import { useNavigate } from "react-router-dom";

function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">

      {/* MOBILE CONTAINER */}
      <div className="w-full max-w-sm bg-gradient-to-b from-[#3f4f67] to-[#2f3e55] 
                      rounded-3xl shadow-xl overflow-hidden flex flex-col">

        {/* ===== HEADER ===== */}
        <div className="pt-12 pb-20 px-6 text-center text-white">

          <img
            src="/asan-logo.png"
            alt="ASAN Logo"
            className="w-16 mx-auto mb-4"
          />

          <h1 className="text-xl font-semibold tracking-wide">
            ASAN Privacy Policy
          </h1>

          <p className="text-xs text-gray-300 mt-2">
            Effective Date: March 2026
          </p>
        </div>

        {/* ===== CONTENT CARD ===== */}
        <div className="bg-white text-gray-700 rounded-t-3xl px-6 py-8 flex-1 space-y-6">

         <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              1. Information We Collect
            </h2>
            <p>
              ASAN collects personal information including name, phone number,
              vehicle details, and trip data to operate and improve our services.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              2. How We Use Your Information
            </h2>
            <p>
              Your information is used to manage trips, ensure safety, process
              payments, and enhance service performance.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              3. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect
              your personal data from unauthorized access or misuse.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              4. Data Sharing
            </h2>
            <p>
              ASAN does not sell personal data. Information is shared only when
              required for legal compliance or operational necessity.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              5. Your Rights
            </h2>
            <p>
              You may request updates or deletion of your data by contacting
              ASAN support.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">
              6. Updates to Policy
            </h2>
            <p>
              ASAN may update this policy periodically. Continued use of the
              service indicates acceptance of updated terms.
            </p>
          </section>
          <button
            onClick={() => navigate(-1)}
            className="w-full mt-6 bg-yellow-400 hover:bg-yellow-300 
                       text-black font-semibold py-3 rounded-xl shadow-md transition"
          >
            Back to Profile
          </button>

        </div>

      </div>
    </div>
  );
}

export default PrivacyPolicy;