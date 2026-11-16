import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {MultiplayerEngine,createMultiplayerServer,createAuthenticator,PROTOCOL} from './server/multiplayer.js';
import {createMultiplayerClient,NETWORK_PROTOCOL} from './multiplayer-client.js';
import {publicMultiplayerConfig} from './api/multiplayer-config.js';
import {COURSES,gaps} from './course.js';
const a={id:'user-a'},b={id:'user-b'};
const options={mode:'create',name:'Host'};
function harness(){let now=0;const engine=new MultiplayerEngine({now:()=>now,random:()=>0});return {engine,async tick(seconds=1/30){now+=seconds*1000;await engine.tick(seconds);}};}
async function two(h,mode='create'){
  const one=await h.engine.action(a,'enter',{...options,mode});const other=await h.engine.action(b,'enter',{mode:'join',code:one.room.code,name:'Guest'});
  if(mode==='create')await h.engine.action(a,'start',{token:one.token});return [one,other];
}
test('private rooms require two humans, authorize host and isolate room sessions',async()=>{
  const h=harness();const first=await h.engine.action(a,'enter',options);
  await assert.rejects(h.engine.action(a,'start',{token:first.token}),/two real/);
  const second=await h.engine.action(b,'enter',{mode:'join',code:first.room.code.toLowerCase(),name:'Guest'});
  await assert.rejects(h.engine.action(b,'start',{token:second.token}),/Only the host/);
  await assert.rejects(h.engine.action(b,'sync',{token:first.token,input:{z:1}}),/session expired/);
  const room=await h.engine.action(a,'start',{token:first.token});assert.equal(room.humanCount,2);assert.equal(room.players.some(p=>p.bot),false);
  assert.equal(room.protocol,NETWORK_PROTOCOL);assert.ok(room.players.every(p=>p.y===1));
  for(let i=0;i<95;i++)await h.tick();
  await h.engine.action(a,'sync',{token:first.token,input:{z:1,x:0,cash:99999}});await h.tick();
  const view=await h.engine.action(b,'sync',{token:second.token});assert.ok(view.players[0].z>0);assert.equal(view.players[1].z,0);
  assert.equal(view.network,true);assert.ok(!JSON.stringify(view).includes(first.token));
  for(let i=0;i<12;i++)await h.tick();const stopped=await h.engine.action(a,'sync',{token:first.token});assert.equal(stopped.players[0].vz,0);
});
test('public matchmaking ignores independently random client course picks and auto starts',async()=>{
  const h=harness(),one=await h.engine.action(a,'enter',{mode:'public',course:'sky'});
  assert.equal(one.room.phase,'waiting');assert.equal((await h.engine.action(b,'rooms')).length,1);
  const second=await h.engine.action(b,'enter',{mode:'public',course:'moon'});assert.equal(second.room.code,one.room.code);assert.equal(second.room.phase,'countdown');
  assert.equal((await h.engine.action(a,'rooms')).length,0);
});
test('rejoining rotates sessions, leaving transfers host, and idle cleanup removes rooms',async()=>{
  const h=harness(),[one,twoPlayers]=await two(h);
  const resumed=await h.engine.action(a,'enter',{mode:'public'});assert.equal(resumed.room.code,one.room.code);assert.notEqual(resumed.token,one.token);
  await assert.rejects(h.engine.action(a,'sync',{token:one.token}),/expired/);
  await h.engine.action(a,'leave',{token:resumed.token});const view=await h.engine.action(b,'sync',{token:twoPlayers.token});assert.equal(view.host,b.id);assert.equal(view.players.length,1);
  await h.tick(31);assert.equal(h.engine.rooms.size,0);assert.equal(h.engine.sessions.size,0);
});
test('complete a shared race, keep both clients in sync, wait for deadline then rematch',async()=>{
  const h=harness(),[one,twoPlayers]=await two(h);let room=one.room,release=false;
  for(let i=0;i<3700;i++){
    room=await h.engine.action(a,'sync',{token:one.token});
    const p=room.players[0],c=COURSES[room.course];
    const edge=gaps(room.course).some(([a,b])=>p.z>a-3.5&&p.z<b),obstacle=c.spinners.some(o=>Math.abs(o.z-p.z)<4)||c.walls.some(o=>Math.abs(o.z-p.z)<4)||c.bumpers.some(o=>Math.abs(o.z-p.z)<3&&Math.abs(o.x-p.x)<1.8);
    const jump=!release&&p.y<1.05&&(edge||obstacle);release=jump;
    await h.engine.action(a,'sync',{token:one.token,input:{x:Math.max(-1,Math.min(1,-p.x)),z:1,jump,dash:edge&&p.cd===0}});
    await h.engine.action(b,'sync',{token:twoPlayers.token,input:{}});await h.tick();
    if(p.rank){assert.equal(room.phase,'racing');await assert.rejects(h.engine.action(a,'rematch',{token:one.token}),/Wait for all/);break;}
  }
  assert.ok(room.players[0].rank,'host must finish using shared course physics');
  for(let i=0;i<3700&&room.phase!=='results';i++){
    await h.engine.action(a,'sync',{token:one.token});await h.engine.action(b,'sync',{token:twoPlayers.token});await h.tick();room=await h.engine.action(a,'sync',{token:one.token});
  }
  assert.equal(room.phase,'results');const other=await h.engine.action(b,'sync',{token:twoPlayers.token});assert.deepEqual(other,room);
  assert.equal(room.players[0].rewardStatus,'disabled');
  const rematch=await h.engine.action(a,'rematch',{token:one.token});assert.equal(rematch.round,2);assert.equal(rematch.phase,'countdown');assert.notEqual(rematch.course,room.course);
  assert.equal(rematch.players[0].rank,0);assert.equal(rematch.players[0].cp,0);
});
test('HTTP authentication, exact CORS, version checks and two independent clients',async()=>{
  const h=harness(),{server}=createMultiplayerServer({engine:h.engine,allowedOrigins:['https://game.test'],autoTick:false,authenticate:async req=>{
    const token=req.headers.authorization;if(!['Bearer player-a','Bearer player-b'].includes(token))throw Object.assign(Error('Sign in required'),{status:401});return token.endsWith('-a')?a:b;}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const fetcher=async(url,init={})=>{
      if(url==='/api/multiplayer-config')return Response.json({enabled:true,url:'https://race.test'});
      return fetch(String(url).replace('https://race.test',base),{...init,headers:{...init.headers,Origin:'https://game.test'}});
    };
    const client=token=>createMultiplayerClient({fetcher,auth:{getSession:async()=>({data:{session:{access_token:token}}})}});
    const one=await client('player-a'),twoPlayers=await client('player-b');const first=await one.request('enter',options),second=await twoPlayers.request('enter',{mode:'join',code:first.room.code});
    await one.request('start',{token:first.token});await h.tick();assert.equal((await twoPlayers.request('sync',{token:second.token})).players.length,2);
    assert.equal((await fetch(base+'/api/health',{headers:{Origin:'https://evil.test'}})).status,403);
    const post=body=>fetch(base+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.test'},body:JSON.stringify(body)});
    assert.equal((await post({protocol:'old'})).status,409);assert.equal((await post({protocol:PROTOCOL})).status,401);
    const anon=await client('');await assert.rejects(anon.request('enter',options),/Sign in/);
    await twoPlayers.request('leave',{token:second.token});await one.request('leave',{token:first.token});assert.equal(h.engine.rooms.size,0);
  }finally{server.close();await once(server,'close');}
});
test('configuration and incompatible backend fail closed; auth verifies identity not profile rows',async()=>{
  assert.deepEqual(publicMultiplayerConfig({}),{enabled:false});
  for(const url of ['http://race.test','https://user:pass@race.test','https://race.test/x','https://race.test/?key=x'])assert.deepEqual(publicMultiplayerConfig({JESTER_RACE_SERVER_URL:url}),{enabled:false});
  assert.deepEqual(publicMultiplayerConfig({JESTER_RACE_SERVER_URL:'https://race.test'}),{enabled:true,url:'https://race.test'});
  let calls=0;const verify=createAuthenticator({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},async(url)=>{calls++;assert.match(String(url),/auth\/v1\/user/);return Response.json({id:'verified-user'});});
  const req={headers:{authorization:'Bearer fake-test-token'}};assert.deepEqual(await verify(req),{id:'verified-user'});await verify(req);assert.equal(calls,1);
  await assert.rejects(verify({headers:{}}),/Sign in/);
  let n=0;await assert.rejects(createMultiplayerClient({fetcher:async()=>Response.json(n++?{protocol:'old'}:{enabled:true,url:'https://race.test'})}),/needs an update/);
});

test('static-host fallback reads only the public config and never sends bearer tokens to config/health',async()=>{
  const {loadPublicConfig}=await import('./public-config.js');
  const calls=[];const fetcher=async(url,init={})=>{
    calls.push([String(url),init]);
    if(String(url).startsWith('/api/'))return new Response('<html>not a function</html>',{status:200});
    if(url==='/online-config.json')return Response.json({auth:{enabled:false},multiplayer:{enabled:true,url:'https://race.test'}});
    if(String(url).endsWith('/api/health'))return Response.json({protocol:PROTOCOL,courses:Object.keys(COURSES),raceLimit:60});
    return Response.json({ok:true});
  };
  assert.deepEqual(await loadPublicConfig('auth',{fetcher}),{enabled:false});
  const client=await createMultiplayerClient({fetcher,auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}});
  for(const [url,init]of calls)assert.equal(init.headers?.Authorization,undefined,url);
  await client.request('rooms');assert.equal(calls.at(-1)[1].headers.Authorization,'Bearer test-session');
  assert.equal(calls.at(-1)[1].credentials,'omit');assert.ok(!calls.some(([url])=>url.includes('test-session')));
});
test('online controls enable only after compatible configuration; failure leaves solo untouched',async()=>{
  const {mountMultiplayer}=await import('./multiplayer-client.js');
  const nodes=new Map(),doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{disabled:true,textContent:'',checked:true});return nodes.get(id);}};
  const scope={};await mountMultiplayer({}, {doc,scope,fetcher:async()=>Response.json({enabled:false})});
  assert.equal(scope.jesterOnline,undefined);assert.equal(doc.getElementById('online-btn').disabled,true);
  let n=0;await mountMultiplayer({},{doc,scope,fetcher:async()=>Response.json(n++?{protocol:PROTOCOL,courses:Object.keys(COURSES),raceLimit:60}:{enabled:true,url:'https://race.test'})});
  assert.ok(scope.jesterOnline);assert.equal(doc.getElementById('online-btn').disabled,false);assert.equal(doc.getElementById('fill-bots').checked,false);assert.equal(doc.getElementById('fill-bots').disabled,true);
});


test('held buttons do not auto-repeat and quick taps survive until simulation consumes them',async()=>{
  const h=harness(),[one]=await two(h);const s=h.engine.sessions.get(one.token),inputs=s.room.inputs;
  await h.engine.action(a,'sync',{token:one.token,input:{jump:true,dash:true}});
  await h.engine.action(a,'sync',{token:one.token,input:{jump:false,dash:false}});
  assert.equal(inputs.get(a.id).value.jump,true);await h.tick();assert.equal(inputs.get(a.id).value.jump,false);
  await h.engine.action(a,'sync',{token:one.token,input:{jump:true,dash:true}});await h.tick();
  await h.engine.action(a,'sync',{token:one.token,input:{jump:true,dash:true}});assert.equal(inputs.get(a.id).value.jump,false);assert.equal(inputs.get(a.id).value.dash,false);
  await h.engine.action(a,'sync',{token:one.token,input:{jump:false}});
  await h.engine.action(a,'sync',{token:one.token,input:{jump:true}});assert.equal(inputs.get(a.id).value.jump,true);
});
