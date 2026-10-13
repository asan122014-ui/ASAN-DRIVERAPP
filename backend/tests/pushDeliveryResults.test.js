import test from "node:test";
import assert from "node:assert/strict";
import { classifyPushResults } from "../services/pushDeliveryResults.js";

test("mixed delivery retries failures without repeating successful pushes", () => {
  assert.deepEqual(classifyPushResults(["delivered", "expired", "temporary"], [
    { success: true },
    { success: false, error: { code: "messaging/registration-token-not-registered" } },
    { success: false, error: { code: "messaging/server-unavailable" } },
  ]), { invalid: ["expired"], retry: ["temporary"] });
});
test("all delivered tokens finish without retry", () => {
  assert.deepEqual(classifyPushResults(["a", "b"], [{ success: true }, { success: true }]), { invalid: [], retry: [] });
});
test("unknown delivery errors remain retryable", () => {
  assert.deepEqual(classifyPushResults(["a"], [{ success: false }]), { invalid: [], retry: ["a"] });
});
