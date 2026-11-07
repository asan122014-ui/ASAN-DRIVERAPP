import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Record from '../institute/models/Record.js';
import Institute from '../institute/models/Institute.js';
import Parent from '../models/Parent.js';
import { deleteInstituteRecord } from '../institute/deleteEnrollment.js';

const user = { role: 'Institute Admin', instituteName: 'Test College' };
const id = new mongoose.Types.ObjectId();
const query = value => ({ session: async () => value });
function setup(t, row) {
  let ended = false;
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async callback => callback(), endSession: async () => { ended = true; } }));
  const find = t.mock.method(Record, 'findOne', () => query(row));
  const remove = t.mock.method(Record, 'deleteOne', async () => ({ deletedCount: 1 }));
  return { find, remove, ended: () => ended };
}
test('ordinary record deletion stays scoped to the signed-in Institute', async t => {
  const state = setup(t, { _id: id, module: 'Vehicles', data: {} });
  await deleteInstituteRecord(user, 'Vehicles', 'vehicle-one');
  assert.deepEqual(state.find.mock.calls[0].arguments[0], { id: 'vehicle-one', module: 'Vehicles', instituteName: 'Test College' });
  assert.deepEqual(state.remove.mock.calls[0].arguments[0], { _id: id });
  assert.equal(state.ended(), true);
});
test('linked deletion requires an Institute Admin and explicit account confirmation', async t => {
  const state = setup(t, { _id: id, coreLink: { model: 'Parent', id }, data: {} });
  await assert.rejects(deleteInstituteRecord({ ...user, role: 'Transport Manager' }, 'Parents', 'parent-one', true), { status: 403 });
  await assert.rejects(deleteInstituteRecord(user, 'Parents', 'parent-one'), { status: 409 });
  assert.equal(state.remove.mock.calls.length, 0);
});
test('a directory card cannot delete an account owned outside its Institute', async t => {
  const state = setup(t, { _id: id, coreLink: { model: 'Parent', id }, data: {} });
  t.mock.method(Institute, 'findOne', () => query({ _id: new mongoose.Types.ObjectId() }));
  t.mock.method(Parent, 'findOne', () => query(null));
  t.mock.method(Parent, 'exists', () => query({ _id: id }));
  await assert.rejects(deleteInstituteRecord(user, 'Parents', 'parent-one', true), /not managed by your Institute/);
  assert.equal(state.remove.mock.calls.length, 0);
  assert.equal(state.ended(), true);
});
