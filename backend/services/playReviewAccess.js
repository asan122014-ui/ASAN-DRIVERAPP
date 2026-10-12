import crypto from "node:crypto";

const normalize = (value) => String(value || "").trim().toLowerCase();

// All three settings and an explicitly marked account are required. Never
// enable a reusable code for a regular driver's personal account.
export function isPlayReviewAccount(driver, env = process.env) {
  return env.PLAY_REVIEW_ENABLED === "true" &&
    /^[a-f0-9]{64}$/i.test(env.PLAY_REVIEW_CODE_SHA256 || "") &&
    Boolean(env.PLAY_REVIEW_DRIVER_ID) &&
    driver?.isPlayReviewAccount === true && driver.status === "approved" &&
    String(driver._id) === env.PLAY_REVIEW_DRIVER_ID &&
    normalize(driver.email) === normalize(env.PLAY_REVIEW_EMAIL) &&
    Boolean(normalize(env.PLAY_REVIEW_EMAIL));
}

export function verifyPlayReviewCode(driver, code, env = process.env) {
  if (!isPlayReviewAccount(driver, env) || !/^\d{6}$/.test(String(code))) return false;
  const supplied = crypto.createHash("sha256").update(String(code)).digest();
  return crypto.timingSafeEqual(supplied, Buffer.from(env.PLAY_REVIEW_CODE_SHA256, "hex"));
}
