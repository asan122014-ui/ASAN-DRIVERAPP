import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { eligibleRegularChildren, trackingChildren, sendTrackingLocation } from '../services/parentTrackingAuthorization.js';
import { canWriteModule, canWritePath } from '../institute/permissions.js';
import { privateCloudinaryReference, parsePrivateCloudinary } from '../services/privateCloudinary.js';
import { resolveMediaReferences, combinedStorage } from '../services/r2Storage.js';
import Child from '../models/Child.js';
import Parent from '../models/Parent.js';
import Institute from '../institute/models/Institute.js';
import Driver from '../models/Driver.js';
import { linkRecord, refreshLinkedRecords } from '../institute/sharedRecords.js';
import mongoose from 'mongoose';
import { mayReadPrivateMedia } from '../services/mediaAuthorization.js';

const now = new Date('2026-11-24T10:00:00Z');
const child = {_id:'child-a',parentId:'parent-a',driverId:'DRIVER',activeBookingId:'booking-a'};
const trip = {parent:'parent-a',child:'child-a',driverId:'DRIVER',status:'in_transit',startTime:now,endTime:null};
const booking = {_id:'booking-a',parentId:'parent-a',assignedDriverId:'DRIVER',status:'active',paidAt:now,serviceStartsAt:'2026-11-01',serviceEndsAt:'2026-12-01',childIds:['child-a']};
test('saved IDs never replace a payment, own child and active trip authorization',()=>{
 assert.equal(eligibleRegularChildren([child],[],[],[trip],now).length,0);
 assert.equal(eligibleRegularChildren([child],[booking],[],[],now).length,0);
 assert.equal(eligibleRegularChildren([child],[booking],[],[trip],now).length,1);
 for(const update of [{status:'cancelled'},{serviceEndsAt:'2026-11-23'},{parentId:'parent-b'},{assignedDriverId:'OTHER'},{childIds:['child-b']},{paidAt:null}])
  assert.equal(eligibleRegularChildren([child],[{...booking,...update}],[],[trip],now).length,0);
 assert.equal(eligibleRegularChildren([child],[{...booking,paidAt:null,couponAppliedAt:now}],[],[trip],now).length,1);
 assert.equal(eligibleRegularChildren([child],[booking],[],[{...trip,parent:'parent-b'}],now).length,0);
 assert.equal(eligibleRegularChildren([child],[booking],[],[{...trip,endTime:now}],now).length,0);
});
test('a cancelled booking cannot fall back to an unrelated historical invoice',()=>{
 const invoice={parentId:'parent-a',childId:'child-a',driverId:'DRIVER',month:'2026-11',status:'Paid',paymentStatus:'Success'};
 assert.equal(eligibleRegularChildren([child],[{...booking,status:'cancelled'}],[invoice],[trip],now).length,0);
 assert.equal(eligibleRegularChildren([{...child,activeBookingId:null}],[],[invoice],[trip],now).length,1);
 assert.equal(eligibleRegularChildren([{...child,activeBookingId:null}],[],[{...invoice,month:'2026-10'}],[trip],now).length,0);
});
test('each role has a server action boundary, not just hidden buttons',()=>{
 assert.equal(canWriteModule('Accounts/Admin Staff','Routes'),false);
 assert.equal(canWriteModule('Accounts/Admin Staff','Drivers'),false);
 assert.equal(canWriteModule('Accounts/Admin Staff','Payments'),true);
 assert.equal(canWriteModule('Transport Manager','Routes'),true);
 assert.equal(canWriteModule('Transport Manager','Payments'),false);
 assert.equal(canWritePath('Accounts/Admin Staff','/routes/id/families'),false);
 assert.equal(canWritePath('Accounts/Admin Staff','/records/Routes/id'),false);
 assert.equal(canWritePath('Viewer','/records/Routes'),false);
 assert.equal(canWritePath('Viewer','/auth/sign-out'),true);
 assert.equal(canWritePath('Transport Manager','/enrollment/commit'),false);
 assert.equal(canWritePath('Institute Admin','/enrollment/commit'),true);
});
test('directory links enforce immutable school membership even when contact details match',async()=>{
 const old = Driver.find;
 try {
  Driver.find=filter=>{assert.equal(filter.instituteId,'school-a');assert.equal(filter.accountSource,'institute');return {select(){return this;},limit(){return this;},lean:async()=>[]};};
  assert.equal(await linkRecord('Drivers',{Email:'foreign@example.com','Phone number':'9876543210'},'School A',{_id:'school-a'}),null);
 } finally {Driver.find=old;}
});
test('old foreign links are not trusted and their profile enrichment is removed',async()=>{
 const before={institute:Institute.findOne,driver:Driver.find};
 try {
  Institute.findOne=()=>({select(){return this;},lean:async()=>({_id:'school-a'})});
  Driver.find=filter=>{assert.equal(filter.instituteId,'school-a');return {select(){return this;},lean:async()=>[]};};
  const rows=await refreshLinkedRecords('Drivers',[{coreLink:{model:'Driver',id:'foreign'},data:{'Driver name':'Known',Address:'PRIVATE HOME','ASAN ID':'PRIVATE'}}],'School A');
  assert.equal(rows[0].coreLink,null);assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);
 } finally {Institute.findOne=before.institute;Driver.find=before.driver;}
});
test('foreign child identifiers are rejected before querying the database',async()=>{
 let reads=0;const old=Child.find;
 try {Child.find=()=>{reads++;throw Error('unexpected');};assert.deepEqual(await trackingChildren({_id:'parent-a'},{driverId:'DRIVER',childId:'not-an-object-id'}),[]);assert.equal(reads,0);}finally{Child.find=old;}
});
test('socket delivery revalidates access and evicts parents whose child is no longer on a live trip',async()=>{
 const old={parent:Parent.findById,child:Child.find};let emitted=0,left=0,validated=0;
 try {
  Parent.findById=()=>({select(){return this;},lean:async()=>({_id:'parent-a',isActive:true})});
  Child.find=filter=>{assert.equal(filter.parentId,'parent-a');return {select(){return this;},lean:async()=>[]};};
  const socket={user:{role:'parent',parentId:'parent-a'},data:{sessionToken:'test'},emit(){emitted++;},leave(room){assert.equal(room,'tracking:DRIVER');left++;}};
  await sendTrackingLocation({in:room=>({fetchSockets:async()=>{assert.equal(room,'tracking:DRIVER');return [socket];}})},'DRIVER',{lat:17,lng:78},async()=>{validated++;});
  assert.equal(emitted,0);assert.equal(left,1);assert.equal(validated,1);
 } finally {Parent.findById=old.parent;Child.find=old.child;}
});
test('private Cloudinary links sign once and never expose permanent unsigned delivery URLs',async()=>{
 const ref=privateCloudinaryReference('asan/drivers/id','png');
 assert.deepEqual(parsePrivateCloudinary(ref),{publicId:'asan/drivers/id',format:'png'});
 let calls=0;
 const result=await resolveMediaReferences({licenseFront:ref,imageUrl:ref,publicId:ref},undefined,async()=>{calls++;return 'https://example.com/expiring';});
 assert.equal(calls,1);assert.equal(result.licenseFront,result.imageUrl);assert.equal(result.publicId,ref);
});
test('Cloudinary fallback documents store private references rather than public URLs',async()=>{
 const names=['R2_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];const previous=names.map(name=>process.env[name]);
 try {
  for(const name of names)delete process.env[name];
  const engine=combinedStorage({_handleFile(_req,_file,done){done(null,{filename:'asan/drivers/id',path:'https://public-url',format:'jpg'});}},'drivers',{profileOnCloudinary:true});
  const uploaded=await new Promise((resolve,reject)=>engine._handleFile({}, {fieldname:'licenseFront',stream:Readable.from([])},(error,result)=>error?reject(error):resolve(result)));
  assert.ok(parsePrivateCloudinary(uploaded.path));assert.equal(uploaded.path,uploaded.filename);
 }finally{names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});}
});

test('copying a private reference into an editable avatar cannot authorize a signature',async()=>{
 const previous=mongoose.connection.db;const calls=[];
 try {
  mongoose.connection.db={collection:name=>({findOne:async filter=>{calls.push({name,filter});return null;}})};
  const ref='clda://asan%2Fdrivers%2Fvictim/jpg';
  assert.equal(await mayReadPrivateMedia({driver:{_id:'attacker',driverId:'DRIVER'}},ref),false);
  const ownDriver=calls.find(call=>call.name==='drivers');
  assert.equal(ownDriver.filter._id,'attacker');
  assert.equal(ownDriver.filter.$or.some(item=>'avatar' in item || 'profilePhoto' in item),false);
  calls.length=0;
  assert.equal(await mayReadPrivateMedia({parent:{_id:'parent-a'}},ref),false);
  assert.equal(calls[0].filter.parent,'parent-a');
  assert.equal(await mayReadPrivateMedia({user:{id:'staff',role:'Viewer',instituteName:'School A'}},ref),false);
 } finally {mongoose.connection.db=previous;}
});

test('parents receive private trip photos only through their own authoritative trip records',async()=>{
 const previous=mongoose.connection.db;
 try {
  mongoose.connection.db={collection:name=>({findOne:async filter=>{assert.equal(name,'trips');return filter.parent==='parent-a' && filter.$or[0]['morningDrop.imageUrl']==='private-own-image'?{_id:'trip'}:null;}})};
  assert.equal(await mayReadPrivateMedia({parent:{_id:'parent-a'}},'private-own-image'),true);
  assert.equal(await mayReadPrivateMedia({parent:{_id:'parent-b'}},'private-own-image'),false);
 } finally {mongoose.connection.db=previous;}
});
