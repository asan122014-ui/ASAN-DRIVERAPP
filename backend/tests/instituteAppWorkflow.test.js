import express from 'express';
import jwt from 'jsonwebtoken';
import appRoutes from '../institute/appRoutes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { buildStopPickupPlan } from '../institute/appPickupPlan.js';
import { markInvoicePaid } from '../controllers/invoicePaymentController.js';
import Invoice from '../models/Invoice.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import { deleteInstituteRecord } from '../institute/deleteEnrollment.js';
import Institute from '../institute/models/Institute.js';
import Record from '../institute/models/Record.js';
import Child from '../models/Child.js';
import Trips from '../models/Trips.js';
import Otp from '../models/Otp.js';
const q = value => ({session: () => q(value), select: () => q(value), lean: async () => value, then: (ok, fail) => Promise.resolve(value).then(ok, fail)});

test('pickup-point plan preserves management order and only includes assigned students', () => {
 const stops = ['east','west','empty'].map((id,index)=>({id,name:id,address:id+' entrance',coordinates:{lat:17+index/100,lng:78},expectedTime:'07:30'}));
 const route = {id:'route-a',data:{'Route name':'A'},stops};
 const children = [{_id:'1',name:'First',pickupMode:'route_stops',assignedRouteId:'route-a',pickupStopId:'west',eveningPickup:'16:00'},
 {_id:'2',name:'Second',pickupMode:'route_stops',assignedRouteId:'route-a',pickupStopId:'east',eveningPickup:'16:10'},
 {_id:'3',name:'Different route',pickupMode:'route_stops',assignedRouteId:'route-b',assignedRouteName:'A',pickupStopId:'east'},
 {_id:'4',name:'Home student',pickupMode:'door_to_door',assignedRouteId:'route-a',pickupStopId:'east'}];
 const plan = buildStopPickupPlan({location:{lat:17,lng:78}},route,children);
 assert.deepEqual(plan.pickupStops.map(stop=>stop.id),['east','west']);
 assert.deepEqual(plan.dropStops.map(stop=>stop.id),['west','east']);
 assert.deepEqual(plan.pickupStops.flatMap(stop=>stop.students.map(child=>child.id)),['2','1']);
 assert.equal(plan.dropStops[0].dropTime,'16:00');
 assert.equal(plan.pickupStops[0].pickupTime,'07:30');
 assert.equal(route.stops.length,3);
 assert.throws(()=>buildStopPickupPlan({}, {...route,stops:[{...stops[0],coordinates:{lat:999,lng:78}}]},children));
});

test('verified institute payment and both notification queues commit together; repeats do not send again', async t => {
 const session={withTransaction:async fn=>fn(),endSession:async()=>{}};
 t.mock.method(mongoose,'startSession',async()=>session);
 const invoice={_id:'invoice',parentId:'parent',driverId:'TEST-DRV-1',instituteId:'institute',childId:'student',billingSource:'institute_fixed',totalAmount:2500,month:'2026-11',routeName:'East',status:'Paid',paymentStatus:'Success',razorpayPaymentId:'pay-1'};
 let first=true;
 t.mock.method(Invoice,'updateOne',async (filter,update,options)=>{assert.equal(options.session,session);assert.equal(filter.razorpayOrderId,'order-1');assert.equal(update.$set.status,'Paid');return {matchedCount:first?1:0};});
 t.mock.method(Invoice,'findById',()=>q(invoice));
 t.mock.method(Parent,'findOne',filter=>{assert.equal(filter.instituteId,'institute');return q({_id:'parent',instituteId:'institute',fcmTokens:['p','p']});});
 t.mock.method(Driver,'findOne',()=>q({driverId:'TEST-DRV-1',instituteId:'institute',fcmTokens:['d']}));
 const notices=t.mock.method(Notification,'create',async rows=>rows.map((row,i)=>({...row,_id:'notice-'+i})));
 const pushes=t.mock.method(PushDelivery,'create',async rows=>rows);
 assert.equal((await markInvoicePaid(invoice,'order-1',{id:'pay-1'})).status,'Paid');
 assert.equal(notices.mock.calls.length,2);assert.equal(pushes.mock.calls.length,2);
 assert.deepEqual(pushes.mock.calls[0].arguments[0][0].tokens,['p']);
 assert.equal(pushes.mock.calls[0].arguments[1].session,session);
 first=false;
 await markInvoicePaid(invoice,'order-1',{id:'pay-1'});
 assert.equal(notices.mock.calls.length,2);
 await assert.rejects(markInvoicePaid(invoice,'order-1',{id:'different'}),{status:409});
});

test('deleting an institute driver clears stable route IDs and leaves other routes scoped out', async t => {
 const id = new mongoose.Types.ObjectId();
 t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}}));
 t.mock.method(Record,'findOne',()=>q({_id:id,coreLink:{model:'Driver',id},data:{}}));
 t.mock.method(Institute,'findOne',()=>q({_id:id,name:'Test'}));
 t.mock.method(Driver,'findOne',()=>q({_id:id,name:'Driver',driverId:'TEST-DRV-1',instituteId:id,fcmTokens:[],email:'test@example.com'}));
 t.mock.method(Driver,'exists',()=>q(null));
 t.mock.method(Child,'find',()=>q([]));t.mock.method(Child,'exists',()=>q(null));
 t.mock.method(Trips,'exists',()=>q(null));t.mock.method(Invoice,'exists',()=>q(null));
 const updates=t.mock.method(Record,'updateMany',async()=>({}));
 for(const [model,name] of [[Child,'updateMany'],[Invoice,'updateMany'],[Trips,'updateMany'],[Driver,'deleteOne'],[PushDelivery,'deleteMany'],[Notification,'deleteMany'],[Otp,'deleteMany'],[Record,'deleteMany'],[Record,'deleteOne']])t.mock.method(model,name,async()=>({}));
 t.mock.method(Notification,'find',()=>q([]));
 await deleteInstituteRecord({role:'Institute Admin',instituteName:'Test'},'Drivers','row',true);
 const call=updates.mock.calls.find(call=>call.arguments[0].module==='Routes'&&call.arguments[1].$unset);
 assert.equal(call.arguments[0].instituteName,'Test');
 assert.deepEqual(call.arguments[0].$or,[{routeDriverId:'TEST-DRV-1'},{'data.Assigned driver ID':'TEST-DRV-1'}]);
 assert.deepEqual(call.arguments[1].$unset,{routeDriverId:1});
 assert.equal(call.arguments[1].$set['data.Assigned driver ID'],'');
});


test('app endpoints use authenticated institute membership, reject removed accounts and do not trust supplied parent IDs', async t => {
 const previousSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='local-workflow-test-only';
 t.after(()=>{if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;});
 const parentId=new mongoose.Types.ObjectId(), instituteId=new mongoose.Types.ObjectId();
 let removed=false;
 t.mock.method(Parent,'findById',async()=>removed?null:{_id:parentId,instituteId,accountSource:'institute',instituteName:'Test',isActive:true});
 const childQuery=t.mock.method(Child,'find',filter=>{assert.equal(String(filter.parentId),String(parentId));assert.equal(String(filter.instituteId),String(instituteId));return {select:()=>({sort:()=>({lean:async()=>[]})})};});
 t.mock.method(Driver,'find',()=>q([]));
 const app=express();app.use('/api/institute-app',appRoutes);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try {
  const url=`http://127.0.0.1:${server.address().port}/api/institute-app/parent?parentId=someone-else`;
  assert.equal((await fetch(url)).status,401);
  const token=jwt.sign({id:String(parentId),tokenType:'parent'},process.env.JWT_SECRET,{algorithm:'HS256'});
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  assert.equal(response.status,200);assert.equal((await response.json()).managed,true);
  assert.equal(childQuery.mock.calls.length,1);
  removed=true;assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token}`}})).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
