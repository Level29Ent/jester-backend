import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerEngine} from './server/multiplayer.js';
import {COURSES,gaps} from './course.js';
test('three actual shared races accumulate championship points and end on a podium',async()=>{
 let time=0;const e=new MultiplayerEngine({now:()=>time,random:()=>0}),a={id:'first'},b={id:'second'};
 const first=await e.action(a,'enter',{mode:'create',name:'First',championship:true});const second=await e.action(b,'enter',{mode:'join',code:first.room.code,name:'Second'});
 await assert.rejects(e.action(b,'vote',{token:first.token,course:'sky'}),/expired/);
 await assert.rejects(e.action(b,'vote',{token:second.token,course:'not-a-course'}),/valid/);
 let room;
 for(let round=1;round<=3;round++){
  await e.action(a,'vote',{token:first.token,course:['sky','mint','carnival'][round-1]});
  room=await e.action(a,round===1?'start':'rematch',{token:first.token});assert.equal(room.partyCup.round,round);
  const release=new Map();
  for(let step=0;step<1270&&room.phase!=='results';step++){
   for(const [user,session]of [[a,first],[b,second]]){
    const p=room.players.find(p=>p.id===user.id),c=COURSES[room.course];
    const edge=gaps(room.course).some(([a,b])=>p.z>a-3.5&&p.z<b),hazard=c.spinners.some(o=>Math.abs(o.z-p.z)<4)||c.walls.some(o=>Math.abs(o.z-p.z)<4)||c.bumpers.some(o=>Math.abs(o.z-p.z)<3&&Math.abs(o.x-p.x)<1.8);
    const jump=!release.get(user.id)&&p.y<1.05&&(edge||hazard);release.set(user.id,jump);
    await e.action(user,'sync',{token:session.token,input:{x:Math.max(-1,Math.min(1,-p.x)),z:1,jump,dash:edge&&p.cd===0}});
   }
   time+=50;await e.tick(.05);room=await e.action(a,'sync',{token:first.token});
  }
  assert.equal(room.phase,'results');assert.ok(room.players.some(p=>p.rank));assert.equal(room.partyCup.standings.length,2);
  const points=room.partyCup.standings.reduce((sum,p)=>sum+p.points,0);assert.ok(points>=(round*15));
  const duplicate=await e.action(b,'sync',{token:second.token});assert.deepEqual(duplicate.partyCup.standings,room.partyCup.standings);
 }
 assert.equal(room.partyCup.complete,true);await assert.rejects(e.action(a,'rematch',{token:first.token}),/complete/);
});
test('departing member vote is removed and host control transfers without granting guest authority',async()=>{
 const e=new MultiplayerEngine(),a={id:'a'},b={id:'b'};
 const one=await e.action(a,'enter',{mode:'create',championship:true});const two=await e.action(b,'enter',{mode:'join',code:one.room.code});
 await e.action(a,'vote',{token:one.token,course:'moon'});await e.action(b,'vote',{token:two.token,course:'sky'});
 await assert.rejects(e.action(b,'start',{token:two.token}),/Only the host/);
 await e.action(a,'leave',{token:one.token});const room=await e.action(b,'sync',{token:two.token});assert.equal(room.host,b.id);assert.equal(room.partyCup.votes.a,undefined);assert.equal(room.partyCup.votes.b,'sky');
});

test('signature-course championship runs moving platforms, collapse tiles and tower physics for two clients',async()=>{
 let now=0;const e=new MultiplayerEngine({now:()=>now,random:()=>0}),a={id:'sig-a'},b={id:'sig-b'};
 const one=await e.action(a,'enter',{mode:'create',championship:true}),two=await e.action(b,'enter',{mode:'join',code:one.room.code});
 for(const [round,course]of ['ferry','crumble','tower'].entries()){
  await e.action(a,'vote',{token:one.token,course});let room=await e.action(a,round?'rematch':'start',{token:one.token}),release=new Map();assert.equal(room.course,course);
  for(let i=0;i<1270&&room.phase!=='results';i++){
   for(const [user,session]of [[a,one],[b,two]]){
    const p=room.players.find(p=>p.id===user.id),c=COURSES[course],edge=gaps(course).some(([a,b])=>p.z>a-3.5&&p.z<b),hazard=c.spinners.some(o=>Math.abs(o.z-p.z)<4);
    const jump=!release.get(user.id)&&p.y<1.05&&(edge||hazard);release.set(user.id,jump);
    await e.action(user,'sync',{token:session.token,input:{x:Math.max(-1,Math.min(1,-p.x)),z:1,jump,dash:edge&&p.cd===0}});
   }
   now+=50;await e.tick(.05);room=await e.action(a,'sync',{token:one.token});
  }
  assert.equal(room.phase,'results');assert.ok(room.players.every(p=>p.rank),course+' must be finishable by both clients');assert.ok(room.time<=60);
  if(course==='crumble')assert.ok(Object.keys(room.players[0].tileContacts).length>0);
 }
});
