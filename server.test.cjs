'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRaceServer}=require('./server.js');
class FixtureEngine {
 constructor(){this.rooms=new Map();this.sessions=new Map();}
 enter(user,body){const token='a'.repeat(32);const room={phase:'countdown',players:[{id:user.id,name:user.name,rank:0,raceCash:0}],kind:'private',code:'ABCDEF12',course:body.course};this.sessions.set(token,{room});return {token,id:user.id,room};}
 session(token){const s=this.sessions.get(token);if(!s)throw Error('expired');return s;}
 sync(token){return this.session(token).room;}
 leave(token){this.sessions.delete(token);}
 tick(){}
}
test('HTTP API rejects bad origins and auth and uses verified profile identity',async()=>{
 const {server}=createRaceServer({engine:new FixtureEngine(),allowedOrigins:['https://game.example'],authenticate:async req=>{
  if(req.headers.authorization!=='Bearer good') throw Error('bad');
  return {id:'verified-user',name:'Saved name',equipped:{outfit:'outfit-0',hat:'hat-0',shoes:'shoes-0',pack:'pack-0'}};
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/health',{headers:{Origin:'https://evil.example'}})).status,403);
  const preflight=await fetch(base+'/api/enter',{method:'OPTIONS',headers:{Origin:'https://game.example'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://game.example');
  assert.equal((await post('/api/enter',{mode:'quick',course:'sky'})).status,401);
  const entered=await post('/api/enter',{mode:'quick',course:'sky',name:'Forged',id:'forged'},{Authorization:'Bearer good'});
  assert.equal(entered.status,200);const race=await entered.json();assert.equal(race.id,'verified-user');assert.equal(race.room.players[0].name,'Saved name');
  assert.equal((await post('/api/sync',{token:'forged'})).status,401);
  assert.equal((await post('/api/sync',{token:race.token,input:null})).status,400);
  const state=await (await post('/api/sync',{token:race.token,input:{z:999,rank:1,raceCash:999}})).json();assert.equal(state.players[0].rank,0);assert.equal(state.players[0].raceCash,0);
  assert.equal((await post('/api/rematch',{token:race.token})).status,501);
  assert.equal((await post('/api/leave',{token:race.token})).status,200);
  assert.equal((await post('/api/sync',{token:race.token})).status,401);
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
