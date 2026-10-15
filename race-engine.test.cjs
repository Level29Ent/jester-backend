'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RaceEngine } = require('./race-engine.cjs');
const user = id => ({id,name:id,equipped:{outfit:'outfit-0',hat:'hat-0',shoes:'shoes-0',pack:'pack-0'}});
test('private rooms enforce host and minimum players, and do not expose inputs',()=>{
 const e=new RaceEngine(); const a=e.enter(user('a'),{mode:'create',course:'sky'});
 assert.throws(()=>e.start(a.token),/Two players/);
 const b=e.enter(user('b'),{mode:'join',code:a.room.code});
 assert.throws(()=>e.start(b.token),/Only host/);
 assert.equal(e.start(a.token).phase,'countdown');
 assert.equal('input' in e.sync(b.token).players[0],false);
 assert.throws(()=>e.enter(user('c'),{mode:'join',code:a.room.code}),/unavailable/);
});
test('practice adds labeled bots and clamps untrusted movement',()=>{
 const e=new RaceEngine(); const a=e.enter(user('a'),{mode:'quick',course:'sky'});
 assert.equal(a.room.players.length,6); assert.equal(a.room.humanCount,1);
 assert.equal(a.room.players.filter(p=>p.bot).length,5);
 const view=e.sync(a.token,{x:Infinity,z:999,y:999,rank:1});
 assert.equal(view.players[0].rank,0);
 for(let n=0;n<120;n++) {e.sync(a.token,{z:999});e.tick(1/30);}
 const p=e.sync(a.token).players[0]; assert.ok(Number.isFinite(p.x)); assert.ok(p.z<10);
});
test('rooms are isolated and leaving expires credentials',()=>{
 const e=new RaceEngine(); const a=e.enter(user('a'),{mode:'create',course:'sky'});
 const b=e.enter(user('b'),{mode:'create',course:'sky'});
 assert.notEqual(a.room.code,b.room.code); assert.equal(b.room.players.length,1);
 e.leave(a.token); assert.throws(()=>e.sync(a.token),/expired/); assert.equal(e.rooms.size,1);
});
test('public matchmaking does not insert bots and waits for a second player',()=>{
 const e=new RaceEngine(); const a=e.enter(user('a'),{mode:'public',course:'sky'});e.tick();
 assert.equal(e.sync(a.token).phase,'waiting');
 const b=e.enter(user('b'),{mode:'public',course:'sky'});e.tick();
 assert.equal(e.sync(b.token).phase,'countdown');assert.equal(e.sync(a.token).players.some(p=>p.bot),false);
});
test('practice bots can finish and client cannot award cash',()=>{
 const e=new RaceEngine();const a=e.enter(user('a'),{mode:'quick',course:'sky'});
 for(let n=0;n<1800;n++){e.sync(a.token,{raceCash:99999,rank:1});e.tick(1/30);}
 const room=e.sync(a.token);assert.ok(room.players.some(p=>p.bot && p.rank>0));assert.equal(room.players[0].raceCash,0);
});
