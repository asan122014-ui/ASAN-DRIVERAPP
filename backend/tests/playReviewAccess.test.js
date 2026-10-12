import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { isPlayReviewAccount, verifyPlayReviewCode } from "../services/playReviewAccess.js";

const driver = { _id: "review-id", email: "review@example.com", status: "approved", isPlayReviewAccount: true };
const env = { PLAY_REVIEW_ENABLED: "true", PLAY_REVIEW_EMAIL: driver.email,
  PLAY_REVIEW_DRIVER_ID: driver._id,
  PLAY_REVIEW_CODE_SHA256: crypto.createHash("sha256").update("481729").digest("hex") };

test("review code is reusable for only the approved, marked account", () => {
  assert.equal(verifyPlayReviewCode(driver, "481729", env), true);
  assert.equal(verifyPlayReviewCode(driver, "481729", env), true);
  for (const patch of [{ _id: "other-id" }, { email: "other@example.com" },
    { status: "pending" }, { isPlayReviewAccount: false }]) {
    assert.equal(verifyPlayReviewCode({ ...driver, ...patch }, "481729", env), false);
  }
});
test("wrong, malformed and missing codes fail closed", () => {
  for (const code of ["000000", "48172", "4817290", undefined, "abcdef"]) {
    assert.equal(verifyPlayReviewCode(driver, code, env), false);
  }
  for (const patch of [{ PLAY_REVIEW_ENABLED: "false" }, { PLAY_REVIEW_EMAIL: "" },
    { PLAY_REVIEW_DRIVER_ID: "" }, { PLAY_REVIEW_CODE_SHA256: "bad" }]) {
    assert.equal(isPlayReviewAccount(driver, { ...env, ...patch }), false);
  }
});
