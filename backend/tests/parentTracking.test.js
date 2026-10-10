import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../routes/driver.js", import.meta.url), "utf8");
const start = source.lastIndexOf("router.get(", source.indexOf('  "/tracking",'));
const end = source.indexOf("\n);", start) + 4;

const query = (value) => ({
  select() { return this; },
  sort() { return this; },
  async lean() { return value; },
});

test("parent tracking returns the active trip, ordered destinations and pickup status", async () => {
  let handler;
  const children = [
    { _id: "child-2", parentId: "parent-2", status: "waiting", location: { lat: 17.2, lng: 78.2 }, dropLocationCoords: { lat: 17.3, lng: 78.3 } },
    { _id: "child-1", parentId: "parent-1", status: "onboard", location: { lat: 17.1, lng: 78.1 }, dropLocationCoords: { lat: 17.3, lng: 78.3 } },
  ];
  vm.runInNewContext(source.slice(start, end), {
    router: { get(path, ...handlers) { handler = handlers.at(-1); } },
    verifyParent() {}, requireLinkedDriver() {}, console,
    hasValidLiveLocation: () => true,
    Driver: { findOne: () => query({ driverId: "ASAN-TEST", lastLocation: { lat: 17.1, lng: 78.1 } }) },
    Trips: { find(filter) {
      assert.equal(filter.status, "in_transit");
      assert.equal(filter.driverId, "ASAN-TEST");
      return query([{ tripType: "afternoon", students: ["child-1", "child-2"] }]);
    } },
    Child: { find: () => query(children) },
  });
  let status;
  let payload;
  await handler({ linkedDriverId: "ASAN-TEST" }, {
    status(code) { status = code; return this; },
    json(body) { payload = body; },
  });
  assert.equal(status, 200);
  assert.equal(payload.data.activeTripType, "afternoon");
  assert.equal(payload.data.routeStops[0].childId, "child-1");
  assert.equal(payload.data.routeStops[0].status, "onboard");
  assert.equal(payload.data.routeStops[1].stopOrder, 2);
  assert.equal(payload.data.routeStops[0].dropLocationCoords.lat, 17.3);
});
