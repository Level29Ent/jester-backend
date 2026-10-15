'use strict';
const {randomUUID}=require('node:crypto');
const {RaceEngine:Base}=require('./race-engine.cjs');
const {COURSES,coinPositions}=require('./tracks.cjs');
class RewardQueue {
 constructor(sender){this.sender=sender;this.jobs=new Map();this.busy=false;}
 enqueue(room,p){
  if(p.bot || p.rewardStatus) return;
  p.reward=p.rank ? [0,100,75,50][p.rank]||25 : 0;
  if(!this.sender){p.rewardStatus='disabled';return;}
  if(this.jobs.size>=1000){p.rewardStatus='failed';return;}
  p.rewardStatus='pending';
  const payload={p_race_id:room.raceId,p_player_id:p.id,p_mode:room.kind==='public'?'public':room.fillBots?'practice':'private',p_coin_count:p.coinIds.length,p_finish_rank:p.rank||0,p_finish_seconds:p.rank?p.finishTime:null};
  this.jobs.set(room.raceId+':'+p.id,{payload,p,next:0,attempts:0});
 }
 async flush(now=Date.now()){
  if(this.busy || !this.sender)return;
  const item=[...this.jobs.entries()].find(([,j])=>j.next<=now);if(!item)return;
  const [key,job]=item;this.busy=true;
  try{
   const result=await this.sender(job.payload);
   if(!Number.isInteger(result.cash)||result.cash<0||typeof result.applied!=='boolean')throw Error('Invalid settlement response');
   job.p.rewardStatus='saved';job.p.walletCash=result.cash;this.jobs.delete(key);
  }catch{job.attempts++;job.next=now+Math.min(60000,1000*2**Math.min(job.attempts,6));job.p.rewardStatus='pending';}
  finally{this.busy=false;}
 }
}
function databaseSender(){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)return null;
 return async payload=>{
  const headers={apikey:key,'Content-Type':'application/json'};
  if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
  const r=await fetch('https://rubtdmmdxjvforydjjcn.supabase.co/rest/v1/rpc/settle_race_reward',{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw Error('Settlement failed');return r.json();
 };
}
class EnhancedRaceEngine extends Base {
 constructor(options={}){super();this.meta=new WeakMap();this.rewards=new RewardQueue(options.sender===undefined?databaseSender():options.sender);}
 state(p){if(!this.meta.has(p))this.meta.set(p,{coyote:0,buffer:0,lastJump:false,immune:0});return this.meta.get(p);}
 prepare(room){room.raceId ||= randomUUID();return COURSES[room.course];}
 view(room){this.prepare(room);return super.view(room);}
 leave(token){const {room,player}=this.session(token);if(room.phase==='racing'||room.phase==='results')this.rewards.enqueue(room,player);return super.leave(token);}
 hit(p,meta){if(meta.immune>0)return;p.stun=.45;meta.immune=1;p.z-=1.2;p.vy=Math.max(3,p.vy);p.event++;}
 tick(dt=1/30){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('Invalid timestep');
  for(const [token,s]of this.sessions){s.idle+=dt;if(s.idle>30)this.leave(token);}
  for(const room of this.rooms.values()){
   const c=this.prepare(room);
   if(room.phase==='waiting'){if(room.kind==='public'&&room.players.filter(p=>!p.bot).length>=2){room.phase='countdown';room.count=3;}continue;}
   if(room.phase==='countdown'){room.count=Math.max(0,room.count-dt);if(!room.count)room.phase='racing';continue;}
   if(room.phase!=='racing')continue;
   room.time=Math.min(90,room.time+dt);
   for(const p of room.players){
    if(p.rank)continue;const m=this.state(p);
    const floorAt=(x,z)=>Math.abs(x)<=c.width&&c.segments.some(([a,b])=>z>=a&&z<=b);
    const grounded=p.y===0&&floorAt(p.x,p.z);
    const gap=c.segments.slice(0,-1).some(([,b])=>p.z>b-1.7&&p.z<b);
    const input=p.bot?{x:Math.max(-1,Math.min(1,-p.x)),z:1,jump:gap}:p.input;
    m.coyote=grounded?.1:Math.max(0,m.coyote-dt);m.buffer=Math.max(0,m.buffer-dt);m.immune=Math.max(0,m.immune-dt);
    if(input.jump&&!m.lastJump)m.buffer=.12;m.lastJump=!!input.jump;
    p.stun=Math.max(0,p.stun-dt);p.boost=Math.max(0,p.boost-dt);p.cd=Math.max(0,p.cd-dt);p.dashing=Math.max(0,p.dashing-dt);
    if(m.buffer>0&&m.coyote>0&&!p.stun){p.vy=9;m.buffer=0;m.coyote=0;p.y=Math.max(.001,p.y);}
    if(input.dash&&!p.cd&&!p.stun){p.dashing=.25;p.cd=2.8;}
    const len=Math.max(1,Math.hypot(input.x||0,input.z||0));
    const speed=(p.dashing?17:p.boost?10:7)*c.speed*(p.stun?.25:1);
    p.vx=(input.x||0)/len*speed;p.vz=(input.z||0)/len*speed;
    p.x+=p.vx*dt;p.z+=p.vz*dt;p.vy-=22*dt;p.y+=p.vy*dt;
    const floor=floorAt(p.x,p.z);
    if(floor&&p.y<=0&&p.y>-1&&p.vy<=0){p.y=0;p.vy=0;}
    if(floor&&p.y===0)p.cp=Math.max(p.cp,c.checkpoints.filter(z=>p.z>=z).length);
    if(p.y< -10){p.x=0;p.z=p.cp?c.checkpoints[p.cp-1]:0;p.y=0;p.vy=0;p.falls++;m.immune=1;}
    if(p.y<.6&&c.boosts.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<1.1))p.boost=.9;
    if(p.y<1.4){
     if(c.bumpers.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<1.2))this.hit(p,m);
     if(c.walls.some(w=>Math.abs(p.z-w.z)<.7&&Math.abs(p.x-Math.sin(room.time*w.rate)*w.range)<1.3))this.hit(p,m);
     for(const o of c.spinners){const a=room.time*o.rate*c.speed,dx=p.x,dz=p.z-o.z,t=Math.max(-c.width*.8,Math.min(c.width*.8,dx*Math.cos(a)+dz*Math.sin(a)));if(Math.hypot(dx-t*Math.cos(a),dz-t*Math.sin(a))<.65)this.hit(p,m);}
    }
    for(const coin of coinPositions(room.course))if(!p.coinIds.includes(coin.id)&&Math.hypot(p.x-coin.x,p.y+1-coin.y,p.z-coin.z)<1){p.coinIds.push(coin.id);p.raceCash=p.coinIds.length*5;p.event++;}
    if(floor&&p.z>=c.finish&&p.y>=0&&p.cp>=c.checkpoints.length){p.rank=room.players.filter(q=>q.rank).length+1;p.finishTime=room.time;this.rewards.enqueue(room,p);}
   }
   if(room.time>=90||room.players.every(p=>p.rank)){room.phase='results';for(const p of room.players)this.rewards.enqueue(room,p);}
  }
  void this.rewards.flush();
 }
}
module.exports={EnhancedRaceEngine,RewardQueue,databaseSender};
