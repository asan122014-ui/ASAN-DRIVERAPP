import test from "node:test";
import assert from "node:assert/strict";
import { getHealthStatus } from "../services/healthStatus.js";

test("health check reports ready when MongoDB is connected", () => {
  const health = getHealthStatus(1);

  assert.equal(health.httpStatus, 200);
  assert.equal(health.body.success, true);
  assert.equal(health.body.status, "OK");
  assert.equal(health.body.database, "connected");
});

test("health check reports degraded when MongoDB is unavailable or connecting", () => {
  for (const readyState of [0, 2, 3]) {
    const health = getHealthStatus(readyState);

    assert.equal(health.httpStatus, 503);
    assert.equal(health.body.success, false);
    assert.equal(health.body.status, "DEGRADED");
    assert.equal(health.body.database, "disconnected");
  }
});
