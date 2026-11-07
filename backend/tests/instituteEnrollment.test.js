import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBatch, normalizeEnrollment, documentFields } from '../institute/enrollmentPolicy.js';
import { requireIndividualParent } from '../institute/workflowPolicy.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
const home = { lat: 17.38, lng: 78.48 };
const parent = { kind: 'parent', name: 'Test Parent', email: 'PARENT@example.com', phone: '+91 9876543210', address: 'Hyderabad', home };
test('Institute import normalizes contact identity and rejects fake or incomplete map coordinates', () => {
  assert.equal(normalizeEnrollment(parent).email, 'parent@example.com');
  assert.equal(normalizeEnrollment(parent).phone, '9876543210');
  for (const location of [undefined, { lat: '17', lng: '78' }, { lat: 17 }, { lat: 100, lng: 78 }, { lat: NaN, lng: 78 }]) assert.throws(() => normalizeEnrollment({ ...parent, home: location }));
});
test('Institute import rejects duplicate identities, missing driver documents and invalid child references', () => {
  assert.throws(() => normalizeBatch([parent, { ...parent, email: 'parent@example.com' }]), /Duplicate/);
  assert.throws(() => normalizeBatch(new Array(101).fill(parent)), /100/);
  assert.throws(() => normalizeEnrollment({ ...parent, kind: 'driver', vehicleNumber: 'TS09AB1234', vehicleType: 'Van', licenseNumber: 'TS0920200012345' }), /licenseFront/);
  assert.throws(() => normalizeEnrollment({ kind: 'child', name: 'Test Child' }), /email/);
  const student = { kind: 'child', name: 'Test Student', parentEmail: 'parent@example.com', pickupAddress: 'Hyderabad', pickup: home, pickupTime: '07:50', dropoffTime: '15:10' };
  assert.equal(normalizeEnrollment(student).reference, '');
  assert.throws(() => normalizeBatch([student, { ...student, name: 'test   student' }]), /Duplicate/);
  const row = normalizeEnrollment({ ...parent, kind: 'driver', vehicleNumber: 'TS09AB1234', vehicleType: 'Van', licenseNumber: 'TS0920200012345', documents: Object.fromEntries(documentFields.map(field => [field, '507f1f77bcf86cd799439011'])) });
  assert.equal(Object.keys(row.documents).length, 7);
});
test('individual signup models do not default to Institute approval or membership', () => {
  assert.equal(new Driver().accountSource, 'individual');
  assert.equal(new Driver().status, 'pending');
  assert.equal(new Parent().instituteId, null);
});

test('only parents supply map coordinates; student and driver location inputs are ignored', () => {
  const student = normalizeEnrollment({ kind: 'child', name: 'Test Student', parentEmail: parent.email, pickupTime: '07:50', dropoffTime: '15:10', pickup: {lat:999,lng:999}, pickupAddress:'Do not use' });
  assert.equal(student.pickup, undefined); assert.equal(student.pickupAddress, undefined);
  const driver = normalizeEnrollment({ ...parent, kind:'driver', home:undefined, vehicleNumber:'TS09AB1234', vehicleType:'Van', licenseNumber:'TS0920200012345', documents:Object.fromEntries(documentFields.map(field=>[field,'507f1f77bcf86cd799439011'])) });
  assert.equal(driver.home, undefined); assert.equal(driver.address,'Hyderabad');
});
test('Institute parents cannot enter the self-managed booking workflow', () => {
  let status, body, called = false;
  const response = { status(value) { status = value; return this; }, json(value) { body = value; } };
  requireIndividualParent({ parent: { accountSource: 'institute' } }, response, () => { called = true; });
  assert.equal(status, 403); assert.match(body.message, /Institute/); assert.equal(called, false);
  requireIndividualParent({ parent: { accountSource: 'individual' } }, response, () => { called = true; });
  assert.equal(called, true);
});
