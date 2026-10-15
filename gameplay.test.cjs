'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EnhancedRaceEngine,RewardQueue}=require('./gameplay.cjs');
const {coinPositions}=require('./tracks.cjs');
function scene(sender=null){
 const e=new EnhancedRaceEngine({sender});
 const p={id:'player',name:'Player',bot:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,cp:0,falls:0,cd:0,boost:0,stun:0,dashing:0,event:0,rank:0,finishTime:0,raceCash:0,reward:0,coinIds:[],input:{},loadout:{},upgrades:{}};
 const room={code:'ABCDEF12',course:'sky',kind:'private',fillBots:true,phase:'racing',time:0,round:1,players:[p]};e.rooms.set(room.code,room);e.prepare(room);return {e,p,room};
}
test('coins award once and survive falls',()=>{const {e,p}=scene();const c=coinPositions('sky')[0];p.x=c.x;p.z=c.z;e.tick();assert.deepEqual(p.coinIds,[c.id]);assert.equal(p.raceCash,5);e.tick();assert.equal(p.raceCash,5);p.y=-11;e.tick();assert.equal(p.falls,1);assert.equal(p.raceCash,5);});
test('jump uses a short off-edge grace period',()=>{const {e,p}=scene();p.z=33.99;e.tick();p.z=34.01;p.input={jump:true,z:1};e.tick();assert.ok(p.vy>0);});
test('boost pads accelerate and obstacles cause stun',()=>{const {e,p}=scene();p.z=8;e.tick();assert.ok(p.boost>0);p.input={z:1};e.tick();assert.ok(p.vz>7);p.boost=0;p.x=-4;p.z=13;e.tick();assert.ok(p.stun>0);});
test('no secret means no claimed database payout',()=>{const {e,p,room}=scene();p.z=104;e.tick();assert.equal(p.rewardStatus,'disabled');assert.equal(room.phase,'results');assert.equal(e.rewards.jobs.size,0);});
test('settlement retries same snapshot and acknowledges only success',async()=>{let calls=0;let payload;const q=new RewardQueue(async body=>{calls++;if(!payload)payload=body;else assert.deepEqual(body,payload);if(calls===1)throw Error('offline');return {applied:false,cash:105};});const room={raceId:'race',kind:'public'},p={id:'player',bot:false,rank:1,finishTime:20,coinIds:[0]};q.enqueue(room,p);q.enqueue(room,p);assert.equal(q.jobs.size,1);await q.flush(100);assert.equal(p.rewardStatus,'pending');await q.flush(10000);assert.equal(p.rewardStatus,'saved');assert.equal(p.walletCash,105);assert.equal(q.jobs.size,0);});
test('bots cannot receive wallet payouts',()=>{const q=new RewardQueue(async()=>({applied:true,cash:100}));q.enqueue({raceId:'race'},{bot:true});assert.equal(q.jobs.size,0);});
