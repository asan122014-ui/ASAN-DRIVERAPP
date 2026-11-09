import test from 'node:test';
import assert from 'node:assert/strict';
import {childTrackingAccess} from '../institute/parentTrackingAccess.js';
const child={_id:'student-a',driverId:'DEMO-DRV-1',assignedRouteName:'Route 1'};
const paid={childId:'student-a',status:'Paid',paymentStatus:'Success'};
const trip={_id:'trip-a',child:'student-a',driverId:'DEMO-DRV-1',status:'in_transit',startTime:new Date(),endTime:null};
test('an assignment alone never enables tracking',()=>{
 assert.equal(childTrackingAccess(child,[],[]).canTrack,false);
 assert.equal(childTrackingAccess(child,[],[trip]).reason,'payment_required');
});
test('paid students must wait until their own trip starts',()=>{
 assert.equal(childTrackingAccess(child,[paid],[]).reason,'trip_not_started');
 assert.equal(childTrackingAccess(child,[paid],[{...trip,child:'sibling'}]).canTrack,false);
 assert.equal(childTrackingAccess(child,[paid],[{...trip,driverId:'other-driver'}]).canTrack,false);
});
test('only confirmed payment and active matching child trip enable tracking',()=>{
 assert.equal(childTrackingAccess(child,[paid],[trip]).canTrack,true);
 for(const payment of [{...paid,paymentStatus:'Pending'},{...paid,status:'Pending'},{...paid,childId:'sibling'}]) assert.equal(childTrackingAccess(child,[payment],[trip]).canTrack,false);
 for(const ended of [{...trip,status:'completed'},{...trip,status:'cancelled'},{...trip,endTime:new Date()},{...trip,startTime:null}]) assert.equal(childTrackingAccess(child,[paid],[ended]).canTrack,false);
 assert.equal(childTrackingAccess({...child,assignedRouteName:''},[paid],[trip]).canTrack,false);
});
