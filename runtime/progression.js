import {COURSES, COURSE_IDS} from './course.js';
import {CATALOG, UPGRADES, starterLoadout} from './catalog.js';
import {normalizeAppearance} from './appearance.js';
import {normalizeSabotage} from './sabotage.js';

// Bump whenever layout or movement changes invalidate personal/global times.
export const TRACK_VERSION = 'smooth-v2';
export const ZERO_UPGRADES = Object.freeze({speed:0,jump:0,dash:0,magnet:0});
export const CUP_POINTS = [15,12,10,8,7,6,5,4,3,2,1,0];
export function validateProfile(p) {
  if (!p || typeof p.name !== 'string' || p.name.length > 18 || !p.name.trim() ||
      !Number.isSafeInteger(p.cash) || p.cash < 0 || !Array.isArray(p.owned) || p.owned.length > CATALOG.length ||
      p.owned.some(id=>!CATALOG.some(item=>item.id===id)) || !p.equipped || !p.upgrades || !p.stats ||
      !Object.keys(starterLoadout).every(slot=>CATALOG.some(i=>i.id===p.equipped[slot]&&i.slot===slot)&&p.owned.includes(p.equipped[slot])) ||
      !Object.entries(UPGRADES).every(([key,u])=>Number.isInteger(p.upgrades[key])&&p.upgrades[key]>=0&&p.upgrades[key]<=u.max) ||
      !['races','wins'].every(key=>Number.isSafeInteger(p.stats[key])&&p.stats[key]>=0) || p.stats.wins>p.stats.races) throw Error('Invalid racer backup. Your current save was not changed.');
  return {name:p.name.trim(),cash:p.cash,owned:[...new Set(p.owned)],equipped:Object.fromEntries(Object.keys(starterLoadout).map(k=>[k,p.equipped[k]])),
    upgrades:Object.fromEntries(Object.keys(UPGRADES).map(k=>[k,p.upgrades[k]])),stats:{races:p.stats.races,wins:p.stats.wins},
    appearance:normalizeAppearance(p.appearance),sabotage:normalizeSabotage(p.sabotage)};
}
export function exportBackup(profile) {return JSON.stringify({game:'jester-rush',version:1,profile:validateProfile(profile)},null,2);}
export function importBackup(text) {
  if(typeof text!=='string'||text.length>100000)throw Error('Choose a Jester Rush backup smaller than 100 KB.');
  let data;try{data=JSON.parse(text);}catch{throw Error('This is not a valid JSON backup.');}
  if(!data||typeof data!=='object'||data.game!=='jester-rush'||data.version!==1)throw Error('Unsupported racer backup.');
  return validateProfile(data.profile);
}
export function dailyChallenge(date = new Date()) {
  const day=date.toISOString().slice(0,10), n=Math.floor(Date.parse(day)/86400000);
  const goals=['clean','coins','win']; const goal=goals[((n%3)+3)%3];
  return {day,course:COURSE_IDS[((n%COURSE_IDS.length)+COURSE_IDS.length)%COURSE_IDS.length],goal,
    label:{clean:'Finish without falling',coins:'Finish with 20 pickups',win:'Win without race items'}[goal]};
}
export function dailyComplete(challenge,p) {return !!p.rank && (challenge.goal==='clean'?p.falls===0:challenge.goal==='coins'?p.coinIds.length>=20:p.rank===1);}
export function medalFor(course,time) {
  if(!COURSES[course]||!Number.isFinite(time)||time<=0)return null;
  // Fixed, published targets: identical zero-upgrade/no-item rules for everyone.
  return time<=95?'Gold':time<=110?'Silver':time<=120?'Bronze':null;
}
export function recordKey(room,p) {return `${TRACK_VERSION}:${room.course}:${room.difficulty}:${Object.keys(ZERO_UPGRADES).map(k=>p.upgrades[k]).join('.')}`;}
export function ghostAt(points,time) {
  if(!points?.length||time<points[0][0]||time>points.at(-1)[0])return null;
  let lo=0,hi=points.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(points[mid][0]<=time)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi],f=(time-a[0])/Math.max(.001,b[0]-a[0]);
  return {x:a[1]+(b[1]-a[1])*f,y:a[2]+(b[2]-a[2])*f,z:a[3]+(b[3]-a[3])*f};
}
export function cupStandings(scores,names) {return Object.entries(scores).map(([id,points])=>({id,name:names[id],points})).sort((a,b)=>b.points-a.points||a.id.localeCompare(b.id));}
