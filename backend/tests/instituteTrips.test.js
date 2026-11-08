import test from 'node:test';
import assert from 'node:assert/strict';
import {tripRows,instituteTripRows} from '../institute/appTrips.js';
import Institute from '../institute/models/Institute.js';
import Child from '../models/Child.js';
import Driver from '../models/Driver.js';
import Trips from '../models/Trips.js';
const sample={_id:'one',child:'child1',childName:'First',driverId:'driver1',tripType:'morning',startTime:new Date('2026-11-08T02:00:00Z'),status:'in_transit',pickupStatus:true,dropStatus:false,instituteRouteName:'Original route',instituteVehicleNumber:'Original van'};
test('one journey groups child rows, counts milestones and displays India time',()=>{
 const rows=tripRows([sample,{...sample,_id:'two',child:'child2',childName:'Second',pickupStatus:false}]);
 assert.equal(rows.length,1);assert.equal(rows[0].data['Pickup status'],'1 / 2 picked up');
 assert.equal(rows[0].data['Start time'],'2026-11-08T07:30');assert.equal(rows[0].readOnly,true);
 assert.equal(rows[0].data['Trip status'],'On route');assert.match(rows[0].data.Students,/Second/);
});
test('history retains snapshot after reassignment, separates return trips and shows completion',()=>{
 const completed={...sample,status:'completed',dropStatus:true,endTime:new Date('2026-11-08T02:30:00Z')};
 const rows=tripRows([completed,{...sample,_id:'return',tripType:'afternoon'}],[{_id:'child1',assignedRouteName:'New route'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].data.Route,'Original route');
 const done=rows.find(row=>row.data['Trip status']==='Completed');assert.equal(done.data['Trip duration'],'30 mins');assert.equal(done.data['Drop status'],'1 / 1 dropped off');
 assert.equal(tripRows([{...sample,status:'cancelled'}])[0].data['Trip status'],'Cancelled');
});
test('database feed restricts new and legacy trips to authenticated institute membership',async t=>{
 const q=value=>({select:()=>q(value),sort:()=>q(value),lean:async()=>value});
 t.mock.method(Institute,'findOne',filter=>{assert.equal(filter.name,'School A');return q({_id:'institute-a'});});
 t.mock.method(Child,'find',filter=>{assert.equal(filter.instituteId,'institute-a');return q([{_id:'child1'}]);});
 t.mock.method(Driver,'find',filter=>{assert.equal(filter.instituteId,'institute-a');return q([{driverId:'driver1'}]);});
 t.mock.method(Trips,'find',filter=>{assert.deepEqual(filter,{$or:[{instituteId:'institute-a'},{instituteId:null,child:{$in:['child1']},driverId:{$in:['driver1']}}]});return q([sample]);});
 assert.equal((await instituteTripRows('School A')).length,1);
});
