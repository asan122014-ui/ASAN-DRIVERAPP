import axios from "axios";

export function cashfreeConfig() {
  const mode = process.env.CASHFREE_ENV || "sandbox";
  if (!["sandbox", "production"].includes(mode) || !process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY || !process.env.PARENT_APP_URL || !process.env.PUBLIC_API_URL) {
    const error = new Error("Payments are not configured yet. Please try again later.");
    error.status = 503;
    throw error;
  }
  return { mode, parentUrl: process.env.PARENT_APP_URL.replace(/\/$/, ""), apiUrl: process.env.PUBLIC_API_URL.replace(/\/$/, "") };
}

export async function cashfreeRequest(method, path, data, idempotencyKey) {
  const config = cashfreeConfig();
  const response = await axios({
    method,
    url: `${config.mode === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com"}/pg${path}`,
    data,
    timeout: 15000,
    headers: {
      "x-client-id": process.env.CASHFREE_APP_ID,
      "x-client-secret": process.env.CASHFREE_SECRET_KEY,
      "x-api-version": "2025-01-01",
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
  });
  return response.data;
}
