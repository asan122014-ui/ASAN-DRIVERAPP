import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import Announcement from '../models/Announcement.js';
import AnnouncementDelivery from '../models/AnnouncementDelivery.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import router from '../routes/announcementRoutes.js';
import { validateAudience, validateAnnouncement, audienceHash, hashValue, pushDeliveryState } from '../services/announcementPolicy.js';
import { commitAnnouncementPushOutcome } from '../services/announcementPushOutcome.js';

const adminId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const parentId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const requestId = '11111111-1111-4111-8111-111111111111';
const input = { recipientType:'parent',scope:'selected',recipientIds:[parentId],title:'Transport update',message:'Please check your pickup time.',requestId,audienceHash:audienceHash('parent',[parentId]) };
const chain = data => { const query={}; for(const method of ['select','sort','limit','skip','session'])query[method]=()=>query;query.lean=async()=>data;return query; };

test('audience validation rejects empty selection, mixed all selection and injection values',()=>{
  for(const patch of [{recipientType:'admin'},{scope:'unknown'},{recipientIds:[]},{recipientIds:[{$ne:null}]},{scope:'all'}])assert.throws(()=>validateAudience({...input,...patch}));
  assert.deepEqual(validateAudience({...input,recipientIds:[parentId,parentId.toUpperCase()]}).recipientIds,[parentId]);
  assert.equal(audienceHash('parent',[parentId,adminId]),audienceHash('parent',[adminId,parentId]));
});
test('message validation enforces review, nonempty content and Firebase byte budget',()=>{
  assert.equal(validateAnnouncement(input).title,'Transport update');
  for(const patch of [{title:' '},{message:' '},{message:'x'.repeat(2001)},{message:'😀'.repeat(900)},{audienceHash:'bad'},{requestId:'bad'}])assert.throws(()=>validateAnnouncement({...input,...patch}));
});
test('delivery reporting distinguishes Firebase acceptance, absent devices and expired attempts',()=>{
  const row={tokenCount:2,acceptedCount:0,failedCount:0,expiresAt:new Date(Date.now()+60000)};
  assert.equal(pushDeliveryState({...row,tokenCount:0}),'no_device');
  assert.equal(pushDeliveryState(row),'pending');
  assert.equal(pushDeliveryState({...row,acceptedCount:2}),'accepted');
  assert.equal(pushDeliveryState({...row,acceptedCount:1,failedCount:1}),'partial');
  assert.equal(pushDeliveryState({...row,failedCount:2}),'failed');
  assert.equal(pushDeliveryState({...row,expiresAt:new Date(0)}),'expired');
});

async function harness(t,role='superadmin') {
  const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='isolated-announcement-unit-test-signing-secret';
  t.after(()=>{if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
  t.mock.method(Admin,'findById',()=>({select:async()=>({_id:adminId,role,isActive:true})}));
  const app=express();app.use(express.json());app.use('/api/admin/announcements',router);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const token=jwt.sign({id:adminId,tokenType:'admin',role},process.env.JWT_SECRET);
  return async(path,body,withAuth=true)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/admin/announcements${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(withAuth?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
}
test('announcement APIs reject anonymous and reviewer accounts before accessing recipients',async t=>{
  const api=await harness(t,'reviewer');
  const query=t.mock.method(Parent,'find',()=>{throw new Error('Must not query recipients');});
  assert.equal((await api('/preview',input,false)).status,401);
  assert.equal((await api('/preview',input)).status,403);
  assert.equal(query.mock.callCount(),0);
});
test('preview exposes recipient names/count, never FCM tokens',async t=>{
  const api=await harness(t);
  t.mock.method(Parent,'find',()=>chain([{_id:parentId,name:'Test parent',email:'parent@example.invalid',fcmTokens:['private-token']}]));
  const result=await api('/preview',input);
  assert.equal(result.status,200);assert.equal(result.body.count,1);
  assert.equal(result.body.audienceHash,input.audienceHash);
  assert.equal(JSON.stringify(result.body).includes('private-token'),false);
});
test('same request is replayed safely without creating notifications again',async t=>{
  const api=await harness(t);
  t.mock.method(Announcement,'findOne',()=>chain({_id:adminId,payloadHash:hashValue(validateAnnouncement(input)),recipientCount:1}));
  const insert=t.mock.method(Notification,'insertMany',async()=>{throw new Error('Duplicate write');});
  const result=await api('',input);assert.equal(result.status,200);assert.equal(result.body.alreadySent,true);assert.equal(insert.mock.callCount(),0);
  assert.equal((await api('',{...input,message:'Changed payload'})).status,409);
});
test('sending creates private inbox copies and correctly targeted queued pushes in one transaction',async t=>{
  const api=await harness(t);let transactions=0;
  t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>{transactions++;await fn();},endSession:async()=>{}}));
  t.mock.method(Announcement,'findOne',()=>chain(null));t.mock.method(Announcement,'init',async()=>{});t.mock.method(AnnouncementDelivery,'init',async()=>{});
  t.mock.method(Announcement,'create',async values=>[{_id:adminId,...values[0]}]);
  t.mock.method(Parent,'find',()=>chain([{_id:parentId,name:'Test parent',fcmTokens:['same-token','same-token','']} ]));
  const notices=t.mock.method(Notification,'insertMany',async()=>[]);
  const delivery=t.mock.method(AnnouncementDelivery,'insertMany',async()=>[]);
  const pushes=t.mock.method(PushDelivery,'insertMany',async()=>[]);
  const result=await api('',input);assert.equal(result.status,201);assert.equal(transactions,1);
  const notice=notices.mock.calls[0].arguments[0][0];assert.equal(notice.parent,parentId);assert.equal(notice.driver,undefined);assert.equal(notice.notificationKey,'ADMIN_ANNOUNCEMENT');
  assert.equal(delivery.mock.calls[0].arguments[0][0].tokenCount,1);
  const push=pushes.mock.calls[0].arguments[0][0];assert.equal(push.recipientType,'parent');assert.deepEqual(push.tokens,['same-token']);assert.equal(push.data.notificationId,String(notice._id));
});
test('changed all-recipient audience is rejected before writing anything',async t=>{
  const api=await harness(t);
  t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}}));
  t.mock.method(Announcement,'findOne',()=>chain(null));t.mock.method(Announcement,'init',async()=>{});t.mock.method(AnnouncementDelivery,'init',async()=>{});
  t.mock.method(Driver,'find',()=>chain([{_id:parentId,driverId:'ASAN-TEST',fcmTokens:[]}]));
  const create=t.mock.method(Announcement,'create',async()=>{throw new Error('Should not create');});
  const result=await api('',{...input,recipientType:'driver',scope:'all',recipientIds:[]});assert.equal(result.status,409);assert.equal(create.mock.callCount(),0);
});
test('a duplicate push-result commit does not increment delivery reporting',async t=>{
  t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}}));
  t.mock.method(PushDelivery,'deleteOne',async()=>({deletedCount:0}));
  const update=t.mock.method(AnnouncementDelivery,'updateOne',async()=>({}));
  await commitAnnouncementPushOutcome({_id:adminId,attempts:1,tokens:['test'],announcementDeliveryId:parentId},{invalid:[],retry:[]},1);
  assert.equal(update.mock.callCount(),0);
});
test('all drivers without FCM tokens still get inbox messages without creating push jobs',async t=>{
  const api=await harness(t);
  const data={...input,recipientType:'driver',scope:'all',recipientIds:[],audienceHash:audienceHash('driver',[parentId])};
  t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}}));
  t.mock.method(Announcement,'findOne',()=>chain(null));t.mock.method(Announcement,'init',async()=>{});t.mock.method(AnnouncementDelivery,'init',async()=>{});
  t.mock.method(Announcement,'create',async values=>[{_id:adminId,...values[0]}]);
  const query=t.mock.method(Driver,'find',()=>chain([{_id:parentId,name:'Test driver',driverId:'ASAN-TEST',fcmTokens:[]}]));
  const notices=t.mock.method(Notification,'insertMany',async()=>[]);t.mock.method(AnnouncementDelivery,'insertMany',async()=>[]);
  const pushes=t.mock.method(PushDelivery,'insertMany',async()=>[]);
  assert.equal((await api('',data)).status,201);
  assert.equal(query.mock.calls[0].arguments[0].status,'approved');
  const notice=notices.mock.calls[0].arguments[0][0];assert.equal(notice.driver,'ASAN-TEST');assert.equal(notice.parent,undefined);assert.equal(pushes.mock.callCount(),0);
});
test('partial Firebase results preserve only retry tokens and account for successful devices',async t=>{
  const session={withTransaction:async fn=>fn(),endSession:async()=>{}};t.mock.method(mongoose,'startSession',async()=>session);
  const queue=t.mock.method(PushDelivery,'updateOne',async()=>({modifiedCount:1}));
  const deliveries=t.mock.method(AnnouncementDelivery,'updateOne',async()=>({modifiedCount:1}));
  await commitAnnouncementPushOutcome({_id:adminId,attempts:1,tokens:['accepted','bad','retry'],announcementDeliveryId:parentId},{invalid:['bad'],retry:['retry']},1);
  assert.deepEqual(queue.mock.calls[0].arguments[1].$set.tokens,['retry']);
  assert.deepEqual(deliveries.mock.calls[0].arguments[1].$inc,{acceptedCount:1,failedCount:1});
  assert.equal(deliveries.mock.calls[0].arguments[2].session,session);
});
