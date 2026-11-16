import {COURSE_IDS} from './course.js';
export const PERSONALITIES=['Cautious','Aggressive','Shortcut specialist'];
export function weeklyChallenge(date=new Date()){
 const days=Math.floor(date.getTime()/86400000),monday=days-((days+3)%7+7)%7;
 return {week:new Date(monday*86400000).toISOString().slice(0,10),course:COURSE_IDS[((Math.floor(monday/7)%COURSE_IDS.length)+COURSE_IDS.length)%COURSE_IDS.length]};
}
export function raceHighlights(room,p){
 if(!p)return [];
 const messages=[];
 if(p.rank)messages.push(`Finished #${p.rank} in ${p.finishTime.toFixed(2)}s`);
 if(p.bestPosition>p.rank&&p.rank)messages.push(`Comeback: gained ${p.bestPosition-p.rank} places from your lowest position`);
 const finishes=room.players.filter(q=>q.id!==p.id&&q.rank).map(q=>Math.abs(q.finishTime-p.finishTime));
 if(p.rank&&finishes.length)messages.push(`Closest finish: ${Math.min(...finishes).toFixed(2)}s apart`);
 if(Number.isFinite(room.bestSplitDelta)&&room.bestSplitDelta<0)messages.push(`Best checkpoint improvement: ${(-room.bestSplitDelta).toFixed(2)}s`);
 if(p.routesTaken?.length)messages.push(`Risk routes cleared: ${p.routesTaken.length}`);
 if(!p.rank)messages.push('Try the safe lane or practice a checkpoint before your next race.');
 return messages;
}
export const REWARD_STYLES={none:{name:'Default',requires:null},halo:{name:'Clean-run halo',requires:'clean'},trail:{name:'Champion gold trail',requires:'winner'},pose:{name:'Sprinter victory pose',requires:'sprinter'}};
export function canEquipReward(style,unlocked){return Object.hasOwn(REWARD_STYLES,style)&&(!REWARD_STYLES[style].requires||unlocked.includes(REWARD_STYLES[style].requires));}
