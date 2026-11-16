import {COURSES,RACE_LIMIT} from './course.js';
import {TRACK_VERSION} from './progression.js';
export const RIVAL_CHALLENGES=[
 {id:'ferry-duel',course:'ferry',bot:1,reward:'ferry',name:'Clockwork Ferry duel'},
 {id:'crumble-duel',course:'crumble',bot:4,reward:'crumble',name:'Crumble Causeway duel'},
 {id:'tower-duel',course:'tower',bot:7,reward:'tower',name:'Triple Tower duel'}
];
export function rivalBeaten(room,challenge){const p=room.players[0],r=room.players[challenge.bot];return !!p?.rank&&!!r?.bot&&(!r.rank||p.rank<r.rank)&&room.course===challenge.course&&!room.sabotaged;}
export function podiumPlayers(room){if(room.competition)return [];return room.players.filter(p=>Number.isInteger(p.rank)&&p.rank>0&&p.rank<=3).sort((a,b)=>a.rank-b.rank);}
export function validateGhost(text){
 if(typeof text!=='string'||text.length>300000)throw Error('Choose a ghost JSON smaller than 300 KB.');
 let g;try{g=JSON.parse(text);}catch{throw Error('Invalid ghost JSON.');}
 if(!g||g.game!=='jester-rush-ghost'||g.version!==TRACK_VERSION||!Object.hasOwn(COURSES,g.course)||g.standardized!==true||!Number.isFinite(g.time)||g.time<=0||g.time>RACE_LIMIT||!Array.isArray(g.samples)||g.samples.length<2||g.samples.length>1000)throw Error('Unsupported ghost. Use this version’s standardized export.');
 const c=COURSES[g.course];let previous=-1;
 for(const p of g.samples){if(!Array.isArray(p)||p.length!==4||!p.every(Number.isFinite)||p[0]<=previous||p[0]<0||p[0]>g.time+.05||Math.abs(p[1])>c.width+25||p[2]<-9||p[2]>40||p[3]<-20||p[3]>c.finish+15)throw Error('Ghost contains invalid coordinates or timing.');previous=p[0];}
 if(Math.abs(g.samples.at(-1)[0]-g.time)>.25)throw Error('Ghost is missing its finish sample.');
 return {game:'jester-rush-ghost',version:TRACK_VERSION,course:g.course,standardized:true,time:g.time,samples:g.samples.map(p=>[...p])};
}
export function exportGhost(course,time,samples){return JSON.stringify(validateGhost(JSON.stringify({game:'jester-rush-ghost',version:TRACK_VERSION,course,standardized:true,time,samples})));}
export function bugReport({message,consent,state={},device={},date=new Date()}){
 const description=String(message||'').trim().slice(0,1800);if(description.length<8)throw Error('Describe what happened in at least eight characters. Do not include private details.');
 const report={game:'Jester Rush',version:TRACK_VERSION,description};
 if(consent){report.diagnostics={capturedAt:date.toISOString(),course:Object.hasOwn(COURSES,state.course)?state.course:null,mode:['menu','racing','results','party','garage','loading'].includes(state.mode)?state.mode:'unknown',network:state.network===true,
  viewport:{width:Math.max(0,Math.min(10000,Math.round(Number(device.width)||0))),height:Math.max(0,Math.min(10000,Math.round(Number(device.height)||0)))},touch:device.touch===true,browser:String(device.browser||'').slice(0,250)};}
 return report;
}
