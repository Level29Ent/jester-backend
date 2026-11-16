import {COMPETITIONS} from '../competition.js';
import {CUP_POINTS} from '../progression.js';
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';
import {createPracticeClient} from '../practice.js';
import {COURSES, COURSE_IDS, randomCourse, RACE_LIMIT} from '../course.js';
import {starterLoadout} from '../catalog.js';
import {NETWORK_PROTOCOL} from '../multiplayer-protocol.js';

export const PROTOCOL = NETWORK_PROTOCOL;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const input=value=>({x:Number.isFinite(value?.x)?Math.max(-1,Math.min(1,value.x)):0,z:Number.isFinite(value?.z)?Math.max(-1,Math.min(1,value.z)):0,jump:value?.jump===true,dash:value?.dash===true});
const opaque=()=>randomBytes(16).toString('hex');
const copy=value=>JSON.parse(JSON.stringify(value));

// One persistent process owns all rooms. Never instantiate per serverless request.
export class MultiplayerEngine {
  constructor({now=()=>performance.now(),random=Math.random}={}){this.now=now;this.random=random;this.rooms=new Map();this.sessions=new Map();}
  view(room){const state=room.state||{course:room.course,competition:room.competition,phase:'waiting',round:room.round,time:0,count:0,players:room.members.map((u,i)=>({...u,bot:false,loadout:{...starterLoadout},upgrades:{speed:0,jump:0,dash:0,magnet:0},coinIds:[],x:0,y:1,z:-i,rank:0}))};
    return copy({...state,protocol:PROTOCOL,network:true,partyCup:room.championship?{round:room.cupRound,total:3,complete:room.cupRound===3&&state.phase==='results',standings:Object.entries(room.points).map(([id,points])=>({id,points,name:room.names[id]})).sort((a,b)=>b.points-a.points),votes:Object.fromEntries(room.votes)}:null,code:room.code,kind:room.kind,host:room.host,humanCount:room.members.length,raceSize:room.raceSize||room.members.length,fillBots:false,autoStart:0,
      players:state.players.map(p=>({...p,rewardStatus:'disabled'})),results:state.players.filter(p=>p.rank).sort((a,b)=>a.rank-b.rank)});}
  session(token,user){const s=this.sessions.get(token);if(!s||s.user!==user.id)throw fail('Race session expired. Rejoin from the playground.',401);s.seen=this.now();return s;}
  async enter(user,data){
    if(!['public','create','join'].includes(data.mode))throw fail('Choose a multiplayer room mode.');
    const existing=[...this.sessions.entries()].find(([,s])=>s.user===user.id);
    if(existing){const [old,s]=existing,token=opaque();this.sessions.delete(old);s.seen=this.now();this.sessions.set(token,s);s.room.inputs.delete(user.id);return {id:user.id,token,room:this.view(s.room)};}
    if(this.sessions.size>=500)throw fail('Race server is full.',503);
    let room;
    if(data.mode==='join')room=this.rooms.get(String(data.code||'').trim().toUpperCase());
    else if(data.mode==='public')room=[...this.rooms.values()].find(r=>r.kind==='public'&&!r.state&&!r.starting&&r.members.length<12);
    if(data.mode==='join'&&(!room||room.state||room.starting||room.members.length>=12))throw fail('Room unavailable. Check the code or ask the host for a new room.');
    if(!room){
      if(this.rooms.size>=100)throw fail('Race server is full.',503);
      let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(this.rooms.has(code));
      room={code,kind:data.mode==='public'?'public':'private',course:randomCourse(null,this.random),round:1,members:[],host:user.id,inputs:new Map(),engine:null,state:null,clock:0,competition:data.mode==='create'&&COMPETITIONS.includes(data.competition)?data.competition:null,championship:data.mode==='create'&&!COMPETITIONS.includes(data.competition)&&data.championship===true,cupRound:1,points:{},names:{},votes:new Map(),scoredRound:0};this.rooms.set(code,room);
    }
    // Online uses neutral physics/cosmetics, not editable browser wallet claims.
    room.members.push({id:user.id,name:typeof data.name==='string'?data.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'Racer':'Racer',loadout:{...starterLoadout}});
    const token=opaque();this.sessions.set(token,{user:user.id,room,seen:this.now()});
    if(room.kind==='public'&&room.members.length>=2)await this.begin(room);
    return {id:user.id,token,room:this.view(room)};
  }
  async begin(room){
    if(room.members.length<2)throw fail('At least two real players are required.');
    if(room.starting)throw fail('Room is starting.');room.starting=true;
    if(room.competition==='survival')room.course='sky';
    room.raceSize=room.members.length;room.clock=0;room.inputs.clear();
    room.engine=createPracticeClient({now:()=>room.clock,storage:{getItem(){},setItem(){}},random:this.random,
      network:{players:room.members,input:id=>room.inputs.get(id)?.value||{}}});
    await room.engine.request('configure',{autoRotate:false,standardized:true,runMode:room.competition||'race'});
    const result=await room.engine.request('enter',{mode:'quick',course:room.course});room.state=result.room;room.state.round=room.round;room.starting=false;
  }
  async action(user,action,data={}){
    if(action==='enter')return this.enter(user,data);
    if(action==='rooms')return [...this.rooms.values()].filter(r=>r.kind==='public'&&!r.state&&!r.starting).map(r=>({code:r.code,course:r.course,players:r.members.length,capacity:12}));
    const s=this.session(data.token,user),r=s.room;
    if(action==='sync'){
      const value=input(data.input),previous=r.inputs.get(user.id);
      // Preserve short taps until a server tick consumes them, but do not replay
      // them every tick while a packet is delayed.
      r.inputs.set(user.id,{value:{...value,jump:(value.jump&&!previous?.heldJump)||previous?.value.jump||false,dash:(value.dash&&!previous?.heldDash)||previous?.value.dash||false},heldJump:value.jump,heldDash:value.dash,at:this.now()});
      return this.view(r);
    }
    if(action==='vote'){
      if(!r.championship||r.state&&r.state.phase!=='results'||r.cupRound>=3&&r.state?.phase==='results')throw fail('Voting is closed.');
      if(!Object.hasOwn(COURSES,data.course))throw fail('Choose a valid course.');
      r.votes.set(user.id,data.course);return this.view(r);
    }
    if(action==='leave'){await this.leave(data.token);return {ok:true};}
    if(r.host!==user.id)throw fail('Only the host can start or rematch.',403);
    if(action==='start'){if(r.state)throw fail('Race already started.');this.chooseCourse(r);await this.begin(r);return this.view(r);}
    if(action==='rematch'){
      if(r.state?.phase!=='results')throw fail('Wait for all racers or the race deadline before rematching.');
      if(r.members.length<2)throw fail('At least two real players are required.');
      if(r.championship&&r.cupRound>=3)throw fail('Championship complete. Create a new party for another cup.');
      this.score(r);this.chooseCourse(r);r.round++;if(r.championship)r.cupRound++;await this.begin(r);return this.view(r);
    }
    throw fail('Unknown multiplayer action.',404);
  }
  chooseCourse(r){
    if(!r.championship){r.course=randomCourse(r.course,this.random);return;}
    const counts=new Map();for(const course of r.votes.values())counts.set(course,(counts.get(course)||0)+1);
    r.course=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||randomCourse(r.course,this.random);r.votes.clear();
  }
  score(r){if(!r.championship||r.state?.phase!=='results'||r.scoredRound===r.round)return;
    for(const p of r.state.players){r.points[p.id]=(r.points[p.id]||0)+(p.rank?CUP_POINTS[p.rank-1]||0:0);r.names[p.id]=p.name;}r.scoredRound=r.round;
  }
  async leave(token){const s=this.sessions.get(token);if(!s)return;this.sessions.delete(token);const r=s.room;
    r.members=r.members.filter(p=>p.id!==s.user);r.inputs.delete(s.user);r.votes.delete(s.user);
    if(r.engine)r.state=await r.engine.request('network/remove',{id:s.user});
    if(r.host===s.user)r.host=r.members[0]?.id;
    if(!r.members.length)this.rooms.delete(r.code);
  }
  async tick(dt=1/30){
    for(const [token,s]of this.sessions)if(this.now()-s.seen>30000)await this.leave(token);
    for(const r of this.rooms.values()){
      if(!r.engine||!r.state||r.starting||r.state.phase==='results')continue;
      for(const item of r.inputs.values())if(this.now()-item.at>300){item.value={};item.heldJump=item.heldDash=false;}
      r.clock+=dt*1000;r.state=await r.engine.request('sync',{token:'local-practice'});r.state.round=r.round;this.score(r);
      // Input is held for axes only. Jump/dash are edge-triggered server events.
      for(const item of r.inputs.values()){item.value.jump=false;item.value.dash=false;}
    }
  }
}

export function createAuthenticator(env=process.env,fetcher=fetch){
  const cache=new Map();
  return async req=>{
    const authorization=req.headers.authorization||'';
    if(!/^Bearer [^\s]{1,8000}$/.test(authorization))throw fail('Sign in before joining online races.',401);
    let url;try{url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password)throw Error();}catch{throw fail('Race authentication is not configured.',503);}
    if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY||''))throw fail('Race authentication is not configured.',503);
    const key=createHash('sha256').update(authorization).digest('hex'),now=Date.now();
    for(const [k,c]of cache)if(c.expires<=now)cache.delete(k);
    const cached=cache.get(key);if(cached)return cached.user;
    const response=await fetcher(new URL('/auth/v1/user',url),{headers:{Authorization:authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw fail('Your sign-in expired. Sign in again.',401);
    const user=await response.json();if(typeof user.id!=='string'||!user.id)throw fail('Invalid signed-in player.',401);
    const verified={id:user.id};let expires=now+15000;
    // The provider verified this token. Its expiry can only shorten our cache.
    try{const payload=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString());if(Number.isFinite(payload.exp))expires=Math.min(expires,payload.exp*1000);}catch{}
    if(cache.size<500&&expires>now)cache.set(key,{user:verified,expires});return verified;
  };
}
export function createMultiplayerServer({engine=new MultiplayerEngine(),authenticate=createAuthenticator(),allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),autoTick=true}={}){
  const origins=new Set(allowedOrigins),rates=new Map();
  const server=createServer(async(req,res)=>{
    const send=(status,data)=>{if(!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    const origin=req.headers.origin;
    if(origin&&!origins.has(origin))return send(403,{error:'This game origin is not allowed by the race server.'});
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    const at=Date.now(),ip=req.socket.remoteAddress||'unknown';
    for(const [key,r]of rates)if(at-r.at>60000)rates.delete(key);
    if(!rates.has(ip)&&rates.size>=2000)return send(503,{error:'Server busy.'});
    let rate=rates.get(ip);if(!rate||at-rate.at>=1000){rate={at,count:0};rates.set(ip,rate);}if(++rate.count>300)return send(429,{error:'Too many requests.'});
    const route=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&['/','/health','/api/health'].includes(route))return send(200,{ok:true,protocol:PROTOCOL,courses:COURSE_IDS,raceLimit:RACE_LIMIT,persistence:false,rewards:false});
    if(req.method!=='POST'||!/^\/api\/(enter|sync|start|leave|rematch|rooms|vote)$/.test(route))return send(404,{error:'Endpoint not found.'});
    if(!(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Send JSON.'});
    try{
      let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw fail('Request too large.',413);chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw fail('Invalid JSON.');}
      if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Invalid request.');
      if(body.protocol!==PROTOCOL)throw fail('Game and race server versions differ. Reload the game or update the server.',409);
      const user=await authenticate(req);return send(200,await engine.action(user,route.slice(5),body));
    }catch(error){return send(error.status||503,{error:error.status?error.message:'Race service unavailable. Try again.'});}
  });
  let ticking=false,last=performance.now(),timer;
  if(autoTick){timer=setInterval(async()=>{if(ticking)return;ticking=true;try{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;await engine.tick(dt);}catch{for(const token of [...engine.sessions.keys()])await engine.leave(token);}finally{ticking=false;}},1000/30);timer.unref();}
  server.on('close',()=>clearInterval(timer));server.requestTimeout=10000;server.headersTimeout=10000;
  return {server,engine};
}
