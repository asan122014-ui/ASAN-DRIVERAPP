import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";

function HelpSupport() {
  const navigate = useNavigate();

  const [openFAQ, setOpenFAQ] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "support", text: "Hi 👋 How can we help you today?" }
  ]);
  const [input, setInput] = useState("");

  const faqs = [
    {
      question: "How do I start a trip?",
      answer: "Go to Dashboard and slide the 'Start Trip' button."
    },
    {
      question: "How do I end a trip?",
      answer: "Click 'End Trip' after dropping all students."
    },
    {
      question: "When will I receive payments?",
      answer: "Payments are processed within 24 hours."
    }
  ];

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages([...messages, { sender: "user", text: input }]);
    setInput("");

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { sender: "support", text: "Our team will review your issue shortly." }
      ]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#3f4f67] to-[#2f3e55] rounded-3xl shadow-xl overflow-hidden flex flex-col">

        {/* ===== HEADER ===== */}
        <div className="pt-12 pb-16 px-6 text-center text-white">
          <h1 className="text-xl font-semibold">Help & Support</h1>
          <p className="text-xs text-gray-300 mt-2">
            We're here for you 24/7
          </p>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="bg-white rounded-t-3xl px-6 py-6 flex-1 overflow-y-auto space-y-6">

          {/* ===== FAQ SECTION ===== */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>

            {faqs.map((faq, index) => (
              <div key={index} className="border-b py-3">
                <button
                  className="flex justify-between w-full text-left font-medium"
                  onClick={() =>
                    setOpenFAQ(openFAQ === index ? null : index)
                  }
                >
                  {faq.question}
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${
                      openFAQ === index ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openFAQ === index && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-sm text-gray-600 mt-2 overflow-hidden"
                    >
                      {faq.answer}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* ===== SUPPORT TICKET FORM ===== */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">
              Raise a Support Ticket
            </h2>

            <input
              type="text"
              placeholder="Subject"
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
            />

            <textarea
              placeholder="Describe your issue..."
              rows="3"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />

            <button className="w-full mt-4 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg shadow">
              Submit Ticket
            </button>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="w-full bg-gray-200 text-gray-800 font-medium py-2 rounded-lg"
          >
            Back to Profile
          </button>
        </div>

        {/* ===== FLOATING CHAT BUTTON ===== */}
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-6 right-6 bg-yellow-400 p-3 rounded-full shadow-lg"
        >
          <MessageCircle size={22} />
        </button>

        {/* ===== CHAT PANEL ===== */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-xl p-4 flex flex-col h-[70%]"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Live Support</h3>
                <button onClick={() => setShowChat(false)}>✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 text-sm">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg max-w-[80%] ${
                      msg.sender === "user"
                        ? "bg-yellow-200 ml-auto"
                        : "bg-gray-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  className="bg-yellow-400 px-3 rounded-lg"
                >
                  Send
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default HelpSupport;