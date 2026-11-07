import test from 'node:test';
import assert from 'node:assert/strict';
import { effectivePickupMode, normalizeStops, selectedStop, stopTime } from '../institute/pickupPolicy.js';
test('legacy schools remain door-to-door and routes can override either institute default', () => {
  assert.equal(effectivePickupMode({}, {}), 'door_to_door');
  assert.equal(effectivePickupMode({ pickupMode:'route_stops' }, {data:{'Pickup mode':'inherit'}}),'route_stops');
  assert.equal(effectivePickupMode({ pickupMode:'route_stops' }, {data:{'Pickup mode':'door_to_door'}}),'door_to_door');
  assert.equal(effectivePickupMode({ pickupMode:'door_to_door' }, {data:{'Pickup mode':'route_stops'}}),'route_stops');
  assert.throws(()=>effectivePickupMode({}, {data:{'Pickup mode':'invalid'}}));
});
test('stops require unique IDs, real numeric map points and valid pickup times', () => {
  const stop={id:'one',name:'Library',address:'Library entrance',coordinates:{lat:17.4,lng:78.4},expectedTime:'07:30 AM'};
  const rows=normalizeStops([stop]); assert.equal(rows[0].expectedTime,'07:30');
  assert.equal(selectedStop({stops:rows},'one').name,'Library');
  assert.throws(()=>selectedStop({stops:rows},'foreign'));
  assert.throws(()=>normalizeStops([stop,stop]));
  assert.throws(()=>normalizeStops([{...stop,coordinates:{lat:'17',lng:'78'}}]));
  assert.throws(()=>normalizeStops([{...stop,expectedTime:'27:30'}]));
  assert.equal(stopTime('12:00 AM'),'00:00'); assert.equal(stopTime('12:00 PM'),'12:00');
  assert.equal(stopTime('8:40'),'08:40');
});
