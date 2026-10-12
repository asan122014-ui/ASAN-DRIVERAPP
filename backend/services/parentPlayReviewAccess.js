import crypto from "node:crypto";

const normalize = (value) => String(value || "").trim().toLowerCase();

export function isParentPlayReviewAccount(parent, env = process.env) {
  return env.PLAY_REVIEW_PARENT_ENABLED === "true" &&
    /^[a-f0-9]{64}$/i.test(env.PLAY_REVIEW_PARENT_CODE_SHA256 || "") &&
    Boolean(env.PLAY_REVIEW_PARENT_ID) &&
    parent?.isPlayReviewAccount === true && parent.isActive === true &&
    String(parent._id) === env.PLAY_REVIEW_PARENT_ID &&
    normalize(parent.email) === normalize(env.PLAY_REVIEW_PARENT_EMAIL) &&
    Boolean(normalize(env.PLAY_REVIEW_PARENT_EMAIL));
}

export function verifyParentPlayReviewCode(parent, code, env = process.env) {
  if (!isParentPlayReviewAccount(parent, env) || !/^\d{6}$/.test(String(code))) return false;
  const supplied = crypto.createHash("sha256").update(String(code)).digest();
  return crypto.timingSafeEqual(supplied, Buffer.from(env.PLAY_REVIEW_PARENT_CODE_SHA256, "hex"));
}
