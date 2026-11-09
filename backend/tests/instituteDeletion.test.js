import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Record from '../institute/models/Record.js';
import Institute from '../institute/models/Institute.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Driver from '../models/Driver.js';
import Invoice from '../models/Invoice.js';
import Trips from '../models/Trips.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import Otp from '../models/Otp.js';
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

test('an unpaid parent can be deleted with students; pending bills cancel while paid history is excluded', async t => {
  setup(t,{_id:id,coreLink:{model:'Parent',id},data:{}});
  const instituteId=new mongoose.Types.ObjectId(),childId=new mongoose.Types.ObjectId();
  t.mock.method(Institute,'findOne',()=>query({_id:instituteId,name:user.instituteName}));
  t.mock.method(Parent,'findOne',()=>query({_id:id,email:'test@example.com',fcmTokens:[]}));
  t.mock.method(Child,'find',()=>query([{_id:childId,parentId:id,driverId:'DEMO'}]));
  t.mock.method(Child,'exists',()=>query(null));
  t.mock.method(Trips,'exists',()=>query(null));
  t.mock.method(Invoice,'find',()=>({select(){return this;},session:async()=>[]}));
  const cancel=t.mock.method(Invoice,'updateMany',async()=>({modifiedCount:1}));
  const removeParent=t.mock.method(Parent,'deleteOne',async()=>({deletedCount:1}));
  const removeChildren=t.mock.method(Child,'deleteMany',async()=>({deletedCount:1}));
  t.mock.method(Trips,'updateMany',async()=>({}));
  t.mock.method(Record,'deleteMany',async()=>({}));
  t.mock.method(Notification,'find',()=>({select(){return this;},session(){return this;},lean:async()=>[]}));
  t.mock.method(Notification,'deleteMany',async()=>({}));
  t.mock.method(PushDelivery,'deleteMany',async()=>({}));
  t.mock.method(Otp,'deleteMany',async()=>({}));
  t.mock.method(Child,'countDocuments',()=>query(0));
  t.mock.method(Driver,'updateOne',async()=>({}));
  const result=await deleteInstituteRecord(user,'Parents','parent-one',true);
  assert.equal(result.deletedAccount,true);assert.equal(result.removedStudents,1);
  assert.equal(removeParent.mock.calls.length,1);assert.equal(removeChildren.mock.calls.length,1);
  const [filter,change]=cancel.mock.calls[0].arguments;
  assert.deepEqual(filter.status,{$nin:['Paid','Cancelled']});
  assert.deepEqual(filter.paymentStatus,{$ne:'Success'});
  assert.equal(change.$set.status,'Cancelled');
});
