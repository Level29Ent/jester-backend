import {test} from 'node:test';
import assert from 'node:assert/strict';
import {competitionSetup,competitionTick,eliminate,teamScores,arenaRadius,arenaInside,levelFor,awardCareer,normalizedCareer,THEMES} from './competition.js';
import {createPracticeClient} from './practice.js';
import {MultiplayerEngine} from './server/multiplayer.js';
const store=()=>{const map=new Map();return {map,getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
function harness(storage=store(),callbacks={}){let clock=0;const c=createPracticeClient({storage,now:()=>clock,...callbacks});return{request:c.request,storage,async step(input={},dt=.05){clock+=dt*1000;return c.request('sync',{token:'local-practice',input});}};}
test('elimination bell removes only the last unfinished racer and never assigns a fake finish',()=>{
 const room={time:0,players:Array.from({length:4},(_,i)=>({id:String(i),z:10*i,rank:0}))};competitionSetup(room,'elimination');room.time=15;competitionTick(room);assert.equal(room.players[0].eliminated,true);assert.equal(room.players[0].rank,0);assert.equal(room.nextElimination,25);
 competitionTick(room);assert.equal(room.players.filter(p=>p.eliminated).length,1);room.time=25;competitionTick(room);assert.equal(room.players[1].eliminated,true);room.time=35;competitionTick(room);assert.equal(room.phase,'results');assert.equal(room.players[3].rank,1);
});
test('survival circle shrinks to a visible four-metre minimum and last survivors tie',()=>{
 assert.equal(arenaRadius(0),8);assert.equal(arenaRadius(60),4);assert.equal(arenaInside({x:0,z:16},50),true);assert.equal(arenaInside({x:8,z:16},0),false);
 const room={time:0,players:[{id:'a',rank:0},{id:'b',rank:0}]};competitionSetup(room,'survival');room.time=6;eliminate(room,room.players[1],'fall');competitionTick(room);assert.equal(room.phase,'results');assert.equal(room.players[0].rank,1);assert.equal(room.players[1].survivalTime,6);
 const tied={time:0,players:[{id:'a',rank:0},{id:'b',rank:0}]};competitionSetup(tied,'survival');tied.time=60;competitionTick(tied);assert.ok(tied.players.every(p=>p.rank===1));
});
test('team slots are balanced and scores count only finished ranks',()=>{
 const room={players:Array.from({length:5},(_,i)=>({id:String(i),rank:i===4?0:i+1}))};competitionSetup(room,'teams');assert.deepEqual(room.players.map(p=>p.team),[0,1,0,1,0]);assert.deepEqual(room.players.slice(0,2).map(p=>p.teamName),['GOLD','VIOLET']);assert.deepEqual(teamScores(room.players).map(t=>t.points),[22,20]);
});
test('local competition runs use neutral rules and earn XP without coins or public replay',async()=>{
 for(const mode of ['elimination','survival','teams']){let callbacks=0;const h=harness(store(),{onRaceStart(){callbacks++},onRaceEnd(){callbacks++}});await h.request('configure',{runMode:mode,standardized:false,difficulty:'expert'});let {room}=await h.request('enter',{mode:'quick',course:'sky'});
 assert.equal(room.competition,mode);assert.equal(room.standardized,true);assert.ok(room.players.every(p=>p.upgrades.speed===0));
 for(let i=0;i<1270&&room.phase!=='results';i++)room=await h.step();assert.equal(room.phase,'results');assert.ok(room.time<=60);assert.deepEqual(room.results.map(p=>p.id),room.players.filter(p=>p.rank).sort((a,b)=>a.rank-b.rank).map(p=>p.id));assert.equal((await h.request('profile/open')).profile.cash,0);assert.ok((await h.request('career')).xp>=25);assert.equal(room.nextCourse,undefined);assert.equal(callbacks,0);
 await h.request('leave');assert.equal((await h.request('profile/open')).profile.cash,0);}
});
test('career validation, title gates and themed item unlocks persist without charges',async()=>{
 assert.equal(levelFor(0),1);assert.equal(levelFor(250),2);assert.equal(levelFor(750),4);assert.equal(levelFor(1e8),50);
 assert.deepEqual(normalizedCareer({xp:-9,completed:['sky','sky',false]}).completed,['sky']);
 const s=store(),h=harness(s);await assert.rejects(h.request('career/title',{title:'Jester Legend'}),/locked/);await assert.rejects(h.request('career/theme',{theme:'royal'}),/locked/);
 s.setItem('jester-career',JSON.stringify({xp:750,completed:['sky'],title:'Rookie'}));const unlocked=harness(s);await unlocked.request('career/title',{title:'Course Conqueror'});const before=(await unlocked.request('profile/open')).profile.cash;const result=await unlocked.request('career/theme',{theme:'royal'});assert.equal(result.profile.cash,before);assert.equal(result.profile.equipped.hat,THEMES.royal.hat);assert.ok(result.profile.owned.includes(THEMES.royal.hat));
 assert.equal((await harness(s).request('career')).title,'Course Conqueror');
 const original={xp:0,completed:[],title:'Rookie'},p={rank:1};assert.equal(awardCareer(original,{network:true},p),original);assert.equal(awardCareer(original,{practiceOnly:true},p),original);assert.equal(awardCareer(original,{training:true},p),original);
 assert.equal(awardCareer(original,{course:'sky'},p).xp,150);assert.deepEqual(awardCareer(original,{course:'sky'},p).completed,['sky']);
});
test('two authenticated room members can run private survival, elimination and teams and rematch',async()=>{
 for(const competition of ['survival','elimination','teams']){
  let clock=0;const e=new MultiplayerEngine({now:()=>clock,random:()=>0}),a={id:'a'},b={id:'b'};
  const one=await e.action(a,'enter',{mode:'create',competition,championship:true}),two=await e.action(b,'enter',{mode:'join',code:one.room.code});
  let room=await e.action(a,'start',{token:one.token});assert.equal(room.competition,competition);assert.equal(room.partyCup,null);
  for(let i=0;i<1270&&room.phase!=='results';i++){await e.action(a,'sync',{token:one.token});await e.action(b,'sync',{token:two.token});clock+=50;await e.tick(.05);room=await e.action(a,'sync',{token:one.token});}
  assert.equal(room.phase,'results');assert.ok(room.time<=60);assert.ok(room.players.every(p=>p.rewardStatus==='disabled'));
  const again=await e.action(a,'rematch',{token:one.token});assert.equal(again.competition,competition);assert.equal(again.round,2);assert.ok(again.players.every(p=>!p.eliminated));
 }
});


test('leaving unfinished modes cannot bank coins or farm XP, and repeated result reads never duplicate XP',async()=>{
 const h=harness();await h.request('configure',{runMode:'survival'});let {room}=await h.request('enter',{mode:'quick'});
 for(let i=0;i<65;i++)room=await h.step();await h.request('leave');assert.equal((await h.request('career')).xp,0);assert.equal((await h.request('profile/open')).profile.cash,0);
 await h.request('configure',{runMode:'elimination'});({room}=await h.request('enter',{mode:'quick',course:'sky'}));
 for(let i=0;i<1270&&room.phase!=='results';i++)room=await h.step();const xp=(await h.request('career')).xp;
 for(let i=0;i<20;i++)await h.step();await h.request('leave');assert.equal((await h.request('career')).xp,xp);
});
test('leaving the survival circle in the actual engine eliminates, not checkpoint-respawns',async()=>{
 const h=harness();await h.request('configure',{runMode:'survival'});let {room}=await h.request('enter',{mode:'quick'});
 for(let i=0;i<260&&!room.players[0].eliminated&&room.phase!=='results';i++)room=await h.step({x:1});
 assert.equal(room.players[0].eliminated,true);assert.equal(room.players[0].falls,0);assert.equal(room.players[0].rank,0);
});

test('HTTP private-room rules come from the creator and cannot be changed by guest joins or sync packets',async()=>{
 const {createMultiplayerServer,PROTOCOL}=await import('./server/multiplayer.js');
 const {server}=createMultiplayerServer({autoTick:false,allowedOrigins:['https://game.test'],authenticate:async req=>{
  if(!['Bearer first','Bearer second'].includes(req.headers.authorization))throw Object.assign(Error('Sign in required'),{status:401});return{id:req.headers.authorization.slice(7)};
 }});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const post=async(user,action,data)=>{const r=await fetch(base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.test',Authorization:'Bearer '+user},body:JSON.stringify({...data,protocol:PROTOCOL})});return{status:r.status,body:await r.json()};};
 try{
  const one=(await post('first','enter',{mode:'create',competition:'teams'})).body,two=(await post('second','enter',{mode:'join',code:one.room.code,competition:'survival'})).body;
  assert.equal((await post('second','start',{token:two.token})).status,403);
  const started=await post('first','start',{token:one.token});assert.equal(started.status,200);assert.equal(started.body.competition,'teams');assert.deepEqual(started.body.players.map(p=>p.team),[0,1]);
  const sync=await post('second','sync',{token:two.token,competition:'survival',team:0,input:{team:0,rank:1}});assert.equal(sync.body.competition,'teams');assert.equal(sync.body.players[1].team,1);assert.equal(sync.body.players[1].rank,0);
  assert.equal((await post('second','sync',{token:one.token})).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
