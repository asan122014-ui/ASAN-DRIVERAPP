import test from "node:test";
import assert from "node:assert/strict";
import { overlappingBookingChildren } from "../services/bookingChildOverlap.js";

const child = (name, school = "Oasis School") => ({ name, school });
test("different children may request the same driver", () => {
  assert.deepEqual(overlappingBookingChildren([child("B")], [{ child: child("A") }]), []);
});
test("legacy single-child bookings block that child only", () => {
  assert.deepEqual(overlappingBookingChildren([child("A")], [{ child: child("A") }]), [child("A")]);
});
test("detects overlap anywhere in a grouped booking", () => {
  assert.deepEqual(overlappingBookingChildren([child("C"), child("B")], [{ children: [child("A"), child("B")] }]), [child("B")]);
});
test("ignores case, repeated whitespace and age changes", () => {
  assert.equal(overlappingBookingChildren([{ ...child(" a ", "OASIS  school"), age: 12 }], [{ child: { ...child("A"), age: 11 } }]).length, 1);
});
test("empty history allows a new booking", () => {
  assert.deepEqual(overlappingBookingChildren([child("A")], []), []);
});
