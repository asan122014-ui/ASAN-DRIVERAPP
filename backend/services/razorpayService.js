import Razorpay from "razorpay";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !/^rzp_(test|live)_/.test(keyId)) {
    const error = new Error("Payments are not configured yet. Please try again later.");
    error.status = 503;
    throw error;
  }
  return { keyId, keySecret, mode: keyId.startsWith("rzp_test_") ? "sandbox" : "production" };
}

export function razorpayClient() {
  const { keyId, keySecret } = razorpayConfig();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}
