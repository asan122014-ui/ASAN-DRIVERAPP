import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../routes/driver.js",import.meta.url),'utf8');
const start=source.lastIndexOf('router.get(',source.indexOf('  "/tracking",'));
const end=source.indexOf('\n);',start)+4;
const query=value=>({select(){return this;},sort(){return this;},async lean(){return value;}});
test('tracking response never exposes another family even if a trip has a shared manifest',async()=>{
 let handler,status,payload;
 const own={_id:'own-child',parentId:'parent-a',status:'onboard',location:{lat:17,lng:78}};
 const foreign={_id:'foreign-child',parentId:'parent-b',location:{lat:18,lng:79}};
 vm.runInNewContext(source.slice(start,end),{
  router:{get(_path,...handlers){handler=handlers.at(-1);}},verifyParent(){},requireLinkedDriver(){},console,
  trackingChildren:async()=>[own],hasValidLiveLocation:()=>true,
  Driver:{findOne:()=>query({driverId:'DRIVER',lastLocation:{lat:17,lng:78}})},
  Trips:{find(filter){assert.equal(filter.parent,'parent-a');return query([{tripType:'morning',students:['own-child','foreign-child']}]);}},
  Child:{find(filter){assert.equal(filter.parentId,'parent-a');assert.equal(filter._id.$in.length,1);return query([own,foreign]);}},
 });
 await handler({parent:{_id:'parent-a'},linkedDriverId:'DRIVER'},{status(code){status=code;return this;},json(body){payload=body;}});
 assert.equal(status,200);assert.equal(payload.data.routeStops.length,1);assert.equal(payload.data.routeStops[0].childId,'own-child');
 assert.equal(JSON.stringify(payload).includes('parent-b'),false);assert.equal(JSON.stringify(payload).includes('foreign-child'),false);
});
test('both regular and Institute parents are denied before reading location when no authorized trip exists',async()=>{
 for(const accountSource of ['individual','institute']){
  let handler,status,reads=0;
  vm.runInNewContext(source.slice(start,end),{router:{get(_path,...handlers){handler=handlers.at(-1);}},verifyParent(){},requireLinkedDriver(){},console,
   trackingChildren:async()=>[],Driver:{findOne(){reads++;return query({});}}});
  await handler({parent:{_id:'parent-a',accountSource},linkedDriverId:'DRIVER'},{status(code){status=code;return this;},json(){}});
  assert.equal(status,403);assert.equal(reads,0);
 }
});
