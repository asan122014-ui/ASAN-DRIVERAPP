import test from "node:test";
import assert from "node:assert/strict";
import { registrationErrors, normalizeCredential, uploadError, validOtp } from "../services/driverRegistrationValidation.js";
const valid = { name: "A. Sathvik", phone: "9876543210", email: "captain@example.com", licenseNumber: "TS09-2020-0012345", vehicleNumber: "TS09 AB 1234", vehicleType: "Auto", vehicleModel: "Bajaj RE 4S" };
test("registration accepts names with initials, Unicode and normal punctuation", () => {
  for (const name of ["A. Sathvik", "Mary-Jane", "O'Connor", "శివ కుమార్"]) assert.equal(registrationErrors({ ...valid, name }).name, undefined);
  assert.deepEqual(registrationErrors(valid), {});
});
test("registration rejects numbers in names, invalid phones and malformed emails", () => {
  for (const name of ["123", "Sachin7", ""]) assert.ok(registrationErrors({ ...valid, name }).name);
  for (const phone of ["98765", "98765432101", "98765abc10", "1234567890"]) assert.ok(registrationErrors({ ...valid, phone }).phone);
  assert.ok(registrationErrors({ ...valid, email: "captain@" }).email);
});
test("license must contain both letters and digits, vehicle format and allowed vehicle type are checked", () => {
  for (const licenseNumber of ["ABCDEFGH", "1234567890", "TS09@123456"]) assert.ok(registrationErrors({ ...valid, licenseNumber }).licenseNumber);
  assert.ok(registrationErrors({ ...valid, vehicleNumber: "ABCD1234" }).vehicleNumber);
  assert.ok(registrationErrors({ ...valid, vehicleType: "truck" }).vehicleType);
  assert.equal(registrationErrors({ ...valid, vehicleNumber: "22BH1234AA", vehicleType: "Van", vehicleModel: "" }).vehicleType, undefined);
  assert.equal(normalizeCredential("TS09-AB 1234"), "TS09AB1234");
});
test("uploads reject unsupported, empty and oversized files and accept the configured limit", () => {
  assert.ok(uploadError(null)); assert.ok(uploadError({ type: "application/pdf", size: 100 }));
  assert.ok(uploadError({ type: "image/png", size: 0 }));
  assert.ok(uploadError({ type: "image/png", size: 10 * 1024 * 1024 + 1 }));
  assert.equal(uploadError({ type: "image/jpeg", size: 10 * 1024 * 1024 }), "");
  assert.equal(validOtp("123456"), true); assert.equal(validOtp("12345a"), false);
});
