export const COMPETITIONS=['elimination','survival','teams'];
export const EMOTES=['wave','cheer','bow'];
export const THEMES={classic:{name:'Classic jester',outfit:'outfit-0',hat:'hat-0',shoes:'shoes-0',pack:'pack-0',level:1},ocean:{name:'Ocean explorer',outfit:'outfit-4',hat:'hat-2',shoes:'shoes-2',pack:'pack-4',level:2},royal:{name:'Royal champion',outfit:'outfit-12',hat:'hat-4',shoes:'shoes-8',pack:'pack-5',level:4}};
export const TITLES=[{name:'Rookie',level:1},{name:'Troublemaker',level:2},{name:'Course Conqueror',level:4},{name:'Crown Chaser',level:7},{name:'Jester Legend',level:10}];
export function levelFor(xp){return Math.min(50,1+Math.floor(Math.max(0,Number(xp)||0)/250));}
export function arenaRadius(time){return Math.max(4,8-time/15);}
export function arenaInside(p,time){return Math.hypot(p.x,p.z-16)<arenaRadius(time);}
export function arenaSweep(time){return time*(1.1+time/80);}
export function competitionSetup(room,mode){
 room.competition=mode;room.nextElimination=15;
 room.players.forEach((p,i)=>{p.eliminated=false;p.team=i%2;p.teamName=mode==='teams'?(p.team?'VIOLET':'GOLD'):null;p.survivalTime=0;if(mode==='survival'){p.x=Math.cos(i*2.399)*3;p.z=16+Math.sin(i*2.399)*3;}});
}
export function eliminate(room,p,reason){if(p.eliminated||p.rank)return;p.eliminated=true;p.eliminationReason=reason;p.survivalTime=room.time;p.vx=p.vy=p.vz=0;}
export function teamScores(players){return [0,1].map(team=>({team,name:team?'Violet':'Gold',points:players.filter(p=>p.team===team&&p.rank).reduce((n,p)=>n+Math.max(1,13-p.rank),0)}));}
export function competitionTick(room){
 const mode=room.competition;if(!mode)return;
 if(mode==='elimination'&&room.time>=room.nextElimination){
  const active=room.players.filter(p=>!p.eliminated&&!p.rank);
  if(active.length>1){const last=[...active].sort((a,b)=>a.z-b.z||a.id.localeCompare(b.id))[0];eliminate(room,last,'Last place at the elimination bell');}
  room.nextElimination+=10;
 }
 if(mode==='survival'){
  const alive=room.players.filter(p=>!p.eliminated);const done=room.time>=60||(room.time>=5&&alive.length<=1);
  if(done){alive.forEach(p=>{p.rank=1;p.finishTime=room.time;p.survivalTime=room.time;});room.phase='results';}
 }else if(mode==='elimination'){
  const active=room.players.filter(p=>!p.eliminated&&!p.rank),finished=room.players.filter(p=>p.rank);
  if(!active.length||active.length===1&&!finished.length&&room.time>=15){if(active.length){active[0].rank=1;active[0].finishTime=room.time;}room.phase='results';}
 }else room.teamScores=teamScores(room.players);
}
export function normalizedCareer(data){const xp=Number.isSafeInteger(data?.xp)&&data.xp>=0?Math.min(data.xp,1000000):0;return {xp:Number.isSafeInteger(data?.xp)&&data.xp>=0?Math.min(data.xp,1000000):0,completed:Array.isArray(data?.completed)?[...new Set(data.completed.filter(id=>typeof id==='string'))].slice(0,100):[],title:TITLES.some(t=>t.name===data?.title&&t.level<=levelFor(xp))?data.title:'Rookie'};}
export function awardCareer(career,room,p){if(room.network||room.training||room.practiceOnly)return career;
 const completed=p.rank>0,playedCompetition=COMPETITIONS.includes(room.competition);
 if(!completed&&!playedCompetition)return career;
 return {...career,xp:Math.min(1000000,career.xp+(completed?100:25)+(p.rank===1?50:0)),completed:completed&&!playedCompetition?[...new Set([...career.completed,room.course])]:career.completed};
}
// Renderer uses a finite bar of half-length radius-.3, not an infinite line.
export function arenaSweepHit(p,time){
 if(p.y<.5||p.y>=2)return false;
 const a=arenaSweep(time),dx=p.x,dz=p.z-16;
 const along=dx*Math.cos(a)+dz*Math.sin(a),across=-dx*Math.sin(a)+dz*Math.cos(a);
 return Math.abs(along)<=arenaRadius(time)-.3&&Math.abs(across)<.45;
}
