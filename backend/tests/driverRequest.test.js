import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import DriverRequest from "../models/DriverRequest.js";

test("direct requests retain the normalized ASAN ID across storage", async () => {
  const request = new DriverRequest({
    parentId: new mongoose.Types.ObjectId(),
    requestType: "existing_driver",
    requestedDriverId: " asan-71c027 ",
    matchingStatus: "Searching",
  });
  await request.validate();
  const restored = DriverRequest.hydrate(request.toObject());
  assert.equal(restored.requestedDriverId, "ASAN-71C027");
});

test("pending requests preserve an exhausted delivery failure reason", async () => {
  const request = new DriverRequest({
    parentId: new mongoose.Types.ObjectId(),
    status: "Pending",
    matchingStatus: "Exhausted",
    rejectionReason: "The selected driver is no longer available.",
  });
  await request.validate();
  assert.equal(request.rejectionReason, "The selected driver is no longer available.");
});
