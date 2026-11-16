import {COURSES} from './course.js';

export const SABOTAGE = Object.freeze({
  turbo:{name:'Rocket Rush',price:60,self:true,description:'50% faster running for 4 seconds. Steering and gaps still matter.'},
  shield:{name:'Jester Shield',price:60,self:true,description:'Ignore sweepers, gates and bumpers for 5 seconds. Does not prevent falls.'},
  magnet:{name:'Coin Vortex',price:40,self:true,description:'Collect coins from 3 units farther away for 8 seconds.'},
  recharge:{name:'Second Wind',price:40,self:true,description:'Clear slow, jump-jinx and dash-jam effects and recharge dash immediately.'},
  banana:{name:'Banana Drop',price:40,description:'Drop a peel behind you: 0.7-second spinout.'},
  slime:{name:'Slime Shot',price:60,description:'Nearest bot ahead within 18 units: half speed for 2 seconds.'},
  jammer:{name:'Dash Jammer',price:60,description:'Nearest bot ahead within 18 units: no dash for 3 seconds.'},
  jinx:{name:'Jump Jinx',price:50,description:'Nearest bot ahead within 18 units: reduced jump for 2 seconds.'},
  bump:{name:'Jester Bump',price:50,description:'Nearest bot within 6 units: short sideways knockback.'},
  decoy:{name:'Coin Decoy',price:40,description:'Drop a pink fake coin behind you: 0.5-second stun.'}
});
export function normalizeSabotage(value) {
  return Object.fromEntries(Object.keys(SABOTAGE).map(key=>[key,Math.max(0,Math.min(99,Math.trunc(Number(value?.[key])||0)))]));
}
export function useSabotage(room, key) {
  const player=room.players[0], item=SABOTAGE[key];
  if(!item || room.phase!=='racing' || player.rank || player.y<.9) throw Error('Use race items while racing on the track.');
  if(player.usedSabotage.includes(key)) throw Error('Already used this perk this race.');
  let target;
  if(!item.self&&!['banana','decoy'].includes(key)) {
    target=room.players.filter(p=>p.bot&&!p.rank&&p.y>=.9&&Math.abs(p.x-player.x)<6&&
      (key==='bump'?Math.abs(p.z-player.z)<=6:p.z>=player.z&&p.z-player.z<=18))
      .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
    if(!target)throw Error('No bot in range. Your item was not spent.');
  }
  if(item.self) {
    if(key==='turbo') player.turbo=4;
    if(key==='shield') player.shield=5;
    if(key==='magnet') player.magnetTime=8;
    if(key==='recharge') { player.cd=0; player.slow=0; player.jammed=0; player.jinxed=0; }
    player.event++;
  }
  if(['banana','decoy'].includes(key)&&room.course){
    const c=COURSES[room.course];
    if(player.y>1.05||Math.abs(player.x)>=c.width||!c.segments.some(([a,b])=>player.z-2>=a&&player.z<=b))throw Error('Drop traps on solid track, not in a jump or gap.');
  }
  if(key==='banana'||key==='decoy')room.traps.push({key,x:player.x,z:player.z-2,expires:room.time+12});
  if(target){
    if(key==='slime')target.slow=2;
    if(key==='jammer'){target.jammed=3;target.dashing=0;}
    if(key==='jinx')target.jinxed=2;
    if(key==='bump'){target.stun=.35;target.vx=(target.x>=player.x?1:-1)*5;target.vz=0;target.vy=2;}
    target.event++;
  }
  player.usedSabotage.push(key);
  room.sabotaged=true;
  room.perkNotice=`${item.name}: ${item.self?'activated':target?target.name:'trap dropped'} · one charge used. Item races are local-only.`;
}
export function tickTraps(room,p) {
  if(!p.bot||p.rank)return;
  const trap=room.traps.find(t=>t.expires>room.time&&p.y<=1.5&&Math.hypot(p.x-t.x,p.z-t.z)<1.2);
  if(!trap)return;
  p.stun=trap.key==='banana'?.7:.5;p.vx=p.vz=0;p.vy=2;p.event++;
  room.traps.splice(room.traps.indexOf(trap),1);
}
export function mountSabotage({request,doc=document,enabled=true}) {
  const shops=[doc.getElementById('sabotage-shop'),doc.getElementById('lobby-item-shop')].filter(Boolean),bar=doc.getElementById('sabotage-actions');
  const statuses=[doc.getElementById('sabotage-status'),doc.getElementById('lobby-item-status')].filter(Boolean);
  const notice=text=>statuses.forEach(status=>{status.textContent=text;});
  let profile=null,room=null,busy=false;
  const buys={},uses={};
  function render(){for(const [key,item]of Object.entries(SABOTAGE)){
    const count=profile?.sabotage?.[key]||0;
    for(const buy of buys[key]) { buy.textContent=`Buy 1 · ${item.price} coins · Owned ${count}`;
    buy.disabled=!enabled||busy||!profile||profile.cash<item.price||count>=99; }
    uses[key].textContent=`${item.name} (${count})`;
    uses[key].disabled=!enabled||room?.network||room?.standardized||room?.training||busy||room?.phase!=='racing'||room?.players[0]?.rank||!count||room?.players[0]?.usedSabotage?.includes(key);
  }}
  for(const [key,item]of Object.entries(SABOTAGE)){
    const use=doc.createElement('button');bar.append(use);uses[key]=use;buys[key]=[];
    for(const shop of shops) {
      const card=doc.createElement('article'),title=doc.createElement('h3'),text=doc.createElement('p'),buy=doc.createElement('button');
      title.textContent=(item.self?'HELP · ':'SABOTAGE · ')+item.name;text.textContent=item.description;card.append(title,text,buy);shop.append(card);buys[key].push(buy);
      buy.addEventListener('click',async()=>{if(busy)return;busy=true;render();try{const result=await request('profile/sabotage-buy',{perk:key});profile=result.profile;notice(`Bought ${item.name}. One purchase = one use.`);}catch(e){notice(e.message);}finally{busy=false;render();}});
    }
    use.addEventListener('click',async()=>{if(busy)return;busy=true;render();try{const result=await request('sabotage/use',{perk:key});room=result.room;profile=result.profile;doc.getElementById('sabotage-race-status').textContent=room.perkNotice;}catch(e){doc.getElementById('sabotage-race-status').textContent=e.message;}finally{busy=false;render();}});
  }
  render();return {updateProfile(p){profile=p;render();},updateRoom(r){room=r;const p=r.players[0], active=[p.turbo?`Rocket ${p.turbo.toFixed(1)}s`:'',p.shield?`Shield ${p.shield.toFixed(1)}s`:'',p.magnetTime?`Magnet ${p.magnetTime.toFixed(1)}s`:''].filter(Boolean).join(' · ');doc.getElementById('sabotage-race-status').textContent=active||r.perkNotice||'';render();}};
}

// Only banana and decoy drop traps; at most two trap meshes exist per race.
export function syncSabotageTraps(view,room) {
  view.sabotageMeshes ??= new Map();
  for(const [key,mesh] of view.sabotageMeshes)if(!room.traps?.some(t=>t.key===key)||mesh.parent!==view.courseGroup){mesh.removeFromParent();view.sabotageMeshes.delete(key);}
  for(const trap of room.traps||[])if(!view.sabotageMeshes.has(trap.key)){
    // Use the renderer's Group type: a transform anchor, not another obstacle.
    const mesh=new view.courseGroup.constructor();
    mesh.position.set(trap.x,.08,-trap.z);view.courseGroup.add(mesh);
    if(trap.key==='banana') {
      for(let i=0;i<3;i++) {
        const peel=view.mesh('round','#ffe24b',Math.cos(i*Math.PI*2/3)*.28,.18,Math.sin(i*Math.PI*2/3)*.28,.2,.16,.8,mesh);
        peel.rotation.y=-i*Math.PI*2/3;peel.rotation.x=.3;
      }
      view.mesh('cylinder','#7e6331',0,.42,0,.08,.4,.08,mesh);
    } else {
      const coin=view.mesh('cylinder','#ff57d4',0,.38,0,.45,.12,.45,mesh);
      coin.rotation.x=Math.PI/2;
      for(const side of [-1,1]) {
        const cross=view.mesh('box','#211c2c',0,.38,.14,.08,.5,.04,mesh);
        cross.rotation.z=side*Math.PI/4;
      }
      view.mesh('cylinder','#211c2c',0,.03,0,.6,.06,.6,mesh);
    }
    view.sabotageMeshes.set(trap.key,mesh);
  }
}
