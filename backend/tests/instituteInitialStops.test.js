import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRouteStops} from '../institute/pickupPolicy.js';
const stop=(id,name,time)=>({id,name,expectedTime:time,address:name+' entrance',coordinates:{lat:17.4,lng:78.4},students:['untrusted']});
test('new route stores ordered middle stops with normalized times and derived summaries',()=>{
 const data={'Pickup mode':'route_stops'};
 const stops=initialRouteStops({},data,[stop('two','Library','8:40'),stop('one','Park','08:50 AM')]);
 assert.deepEqual(stops.map(item=>[item.id,item.order,item.expectedTime]),[['two',1,'08:40'],['one',2,'08:50']]);
 assert.equal(stops[0].students,undefined);assert.equal(data['Pickup stops'],'Library → Park');assert.equal(data['Drop stops'],'Park → Library');
});
test('invalid middle stop rejects the whole creation payload',()=>{
 for(const invalid of [{...stop('bad','Invalid','09:00'),coordinates:null},stop('bad','Bad','27:00')])assert.throws(()=>initialRouteStops({pickupMode:'route_stops'},{},[stop('ok','Good','08:00'),invalid]));
 assert.throws(()=>initialRouteStops({}, {'Pickup mode':'route_stops'},[stop('same','One','08:00'),stop('same','Two','08:30')]));
});
test('door to door ignores hidden drafts and old clients can omit stops',()=>{
 const data={'Pickup mode':'door_to_door'};assert.deepEqual(initialRouteStops({},data,[{invalid:true}]),[]);assert.equal(data['Pickup stops'],'');
 assert.deepEqual(initialRouteStops({pickupMode:'route_stops'},{},undefined),[]);
});

test('route creation endpoint inserts all stops together and rejects invalid requests before insert',async()=>{
 process.env.INSTITUTE_SESSION_SECRET='initial-stops-local-test';
 const {default:express}=await import('express');const {default:mongoose}=await import('mongoose');const {default:crypto}=await import('node:crypto');
 const {default:router}=await import('../institute/router.js');const {default:User}=await import('../institute/models/User.js');const {default:Institute}=await import('../institute/models/Institute.js');const {default:Record}=await import('../institute/models/Record.js');
 const descriptor=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState');Object.defineProperty(mongoose.connection,'readyState',{value:1,configurable:true});
 const original={user:User.findById,institute:Institute.findOne,exists:Record.exists,create:Record.create};let writes=[];
 User.findById=()=>({lean:async()=>({_id:'507f1f77bcf86cd799439011',role:'Institute Admin',instituteName:'Test School'})});
 Institute.findOne=async()=>({name:'Test School',pickupMode:'route_stops',location:{lat:17.3,lng:78.3,address:'Test campus'}});
 Record.exists=async()=>false;Record.create=async value=>{writes.push(value);return {toObject:()=>value};};
 const payload=Buffer.from(JSON.stringify({sub:'507f1f77bcf86cd799439011',exp:Date.now()+60000})).toString('base64url');const token=payload+'.'+crypto.createHmac('sha256',process.env.INSTITUTE_SESSION_SECRET).update('institute:'+payload).digest('base64url');
 const app=express();app.use(router);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const call=stops=>fetch(`http://127.0.0.1:${server.address().port}/records/Routes`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({data:{'Route name':'One request',Destination:'Main Campus'},stops})});
 try{let response=await call([stop('first','Library','07:30'),stop('second','Park','07:40')]);assert.equal(response.status,201);const saved=await response.json();assert.equal(saved.stops.length,2);assert.equal(saved.instituteName,'Test School');assert.equal(saved.data.Destination,'Test campus');assert.equal(writes.length,1);
 response=await call([{...stop('bad','Invalid','08:00'),coordinates:null}]);assert.equal(response.status,400);assert.equal(writes.length,1,'invalid request must not insert a route');}
 finally{User.findById=original.user;Institute.findOne=original.institute;Record.exists=original.exists;Record.create=original.create;if(descriptor)Object.defineProperty(mongoose.connection,'readyState',descriptor);else delete mongoose.connection.readyState;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
