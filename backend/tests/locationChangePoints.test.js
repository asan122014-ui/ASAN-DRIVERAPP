import test from "node:test";
import assert from "node:assert/strict";
import { locationChangePoints } from "../services/locationChangePoints.js";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const child = { location: { lat: 17, lng: 78 }, dropLocationCoords: { lat: 18, lng: 79 } };
const home = { address: "New home", lat: 17.1, lng: 78.1 };
const school = { address: "New school", lat: 17.2, lng: 78.2 };

test("both uses both new endpoints and rejects incomplete choices", () => {
  const points = locationChangePoints("both", { home, school }, child);
  assert.deepEqual(points.pickup, { lat: home.lat, lng: home.lng });
  assert.deepEqual(points.dropoff, { lat: school.lat, lng: school.lng });
  assert.equal(points.proposedSchoolAddress, school.address);
  assert.throws(() => locationChangePoints("both", { home }, child));
  assert.throws(() => locationChangePoints("both", { home, school: { ...school, lat: null } }, child));
});

test("single changes retain the other current endpoint", () => {
  assert.deepEqual(locationChangePoints("home", home, child).dropoff, child.dropLocationCoords);
  assert.deepEqual(locationChangePoints("school", school, child).pickup, child.location);
});

test("one completed both request persists home and school on child and booking", async () => {
  const source = readFileSync(new URL("../routes/childLocationChangeRoutes.js", import.meta.url), "utf8");
  const start = source.indexOf("async function applyLocation(");
  const end = source.indexOf("// Parent: see requests", start);
  let saveCount = 0;
  const value = { async save() { saveCount++; } };
  const booking = { route: {}, async save() { saveCount++; } };
  const request = { locationType: "both", ...locationChangePoints("both", { home, school }, child), newDistanceKm: 12, proposedDurationMinutes: 20, newMonthlyPrice: 100, oldMonthlyPrice: 100, async save() { saveCount++; } };
  const context = { Date };
  vm.runInNewContext(source.slice(start, end), context);
  await context.applyLocation(request, value, booking);
  assert.equal(value.pickupLocation, home.address);
  assert.equal(value.dropoffLocation, school.address);
  assert.equal(booking.route.pickup, home.address);
  assert.equal(booking.route.dropoff, school.address);
  assert.equal(request.status, "completed");
  assert.equal(saveCount, 3);
});
