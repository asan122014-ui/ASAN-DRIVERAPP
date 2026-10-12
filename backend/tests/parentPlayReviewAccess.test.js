import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { isParentPlayReviewAccount, verifyParentPlayReviewCode } from "../services/parentPlayReviewAccess.js";

const parent = { _id: "parent-review-id", email: "review@example.com", isActive: true, isPlayReviewAccount: true };
const env = { PLAY_REVIEW_PARENT_ENABLED: "true", PLAY_REVIEW_PARENT_EMAIL: parent.email,
  PLAY_REVIEW_PARENT_ID: parent._id,
  PLAY_REVIEW_PARENT_CODE_SHA256: crypto.createHash("sha256").update("481729").digest("hex") };

test("parent review code is reusable only for the active marked parent", () => {
  assert.equal(verifyParentPlayReviewCode(parent, "481729", env), true);
  assert.equal(verifyParentPlayReviewCode(parent, "481729", env), true);
  for (const patch of [{ _id: "other" }, { email: "other@example.com" },
    { isActive: false }, { isPlayReviewAccount: false }]) {
    assert.equal(verifyParentPlayReviewCode({ ...parent, ...patch }, "481729", env), false);
  }
});
test("missing configuration and wrong codes fail closed, including driver-only settings", () => {
  for (const code of ["000000", "48172", "4817290", undefined, "abcdef"]) {
    assert.equal(verifyParentPlayReviewCode(parent, code, env), false);
  }
  for (const patch of [{ PLAY_REVIEW_PARENT_ENABLED: "false" }, { PLAY_REVIEW_PARENT_EMAIL: "" },
    { PLAY_REVIEW_PARENT_ID: "" }, { PLAY_REVIEW_PARENT_CODE_SHA256: "bad" }]) {
    assert.equal(isParentPlayReviewAccount(parent, { ...env, ...patch }), false);
  }
  assert.equal(isParentPlayReviewAccount(parent, { PLAY_REVIEW_ENABLED: "true" }), false);
});
