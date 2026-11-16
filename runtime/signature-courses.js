// Independently authored sprint blueprints. Dynamic bridges and collapse tiles
// are deterministic functions of race time and per-racer contact history.
export function signatureCourses(){
 const make=(name,kind,sky,track,finish)=>{
  const segments=Array.from({length:6},(_,i)=>[i*54-8,i*54+43]);
  const challenge={title:{ferry:'Ferry timing',crumble:'Keep moving',tower:'Tower rhythm'}[kind],tip:{ferry:'Blue ferries slide across gaps. Jump or ride their center, then steer onto the landing.',crumble:'Striped tiles crack on contact, then drop after 0.9 seconds. Keep moving or jump.',tower:'Read the three rotating towers. Jump low sweepers and use the clear staging lanes.'}[kind],scenery:{ferry:'sail',crumble:'crystal',tower:'castle'}[kind]};
  return {name,signature:kind,sky,track,side:'#71449b',accent:'#ffd349',speed:1,width:8,finish,segments,checkpoints:segments.slice(1).map(([a])=>a+5),sections:3,
   spinners:segments.map(([a],i)=>({z:Math.max(kind==='crumble'?22:12,a+22),rate:(i%2?-1:1)*(kind==='tower'?1.25+i*.1:kind==='crumble'?.85:.7)})),walls:[],bumpers:[],boosts:segments.map(([a])=>({x:3,z:Math.max(6,a+6)})),challenge,
   elements:{title:challenge.title,tip:challenge.tip,zones:[]},
   ferries:kind==='ferry'?segments.slice(0,-1).map(([,b],i)=>({z:b+1.5,halfWidth:2,halfLength:2,amplitude:3,rate:.8,phase:i})):[],
   collapseTiles:kind==='crumble'?segments.map(([a],i)=>({id:i,z:Math.max(8,a+10),halfLength:2,delay:.9})):[]};
 };
 return {ferry:make('Clockwork Ferry','ferry','#cdeeff','#68cfe1',307),crumble:make('Crumble Causeway','crumble','#f5dfc9','#dcb37f',309),tower:make('Triple Tower Trials','tower','#e1d4f3','#b594e8',311)};
}
export function ferryX(platform,time){return Math.sin(time*platform.rate+platform.phase)*platform.amplitude;}
export function signatureGround(c,p,time){
 const onStatic=Math.abs(p.x)<c.width&&c.segments.some(([a,b])=>p.z>=a&&p.z<=b);
 const dropped=(c.collapseTiles||[]).some(tile=>Math.abs(p.z-tile.z)<tile.halfLength&&Number.isFinite(p.tileContacts?.[tile.id])&&time-p.tileContacts[tile.id]>=tile.delay);
 return onStatic&&!dropped||(c.ferries||[]).some(f=>Math.abs(p.x-ferryX(f,time))<f.halfWidth&&Math.abs(p.z-f.z)<f.halfLength);
}
export function tickSignature(c,p,time,dt){
 if(p.rank)return;
 if(p.y<=1.05&&p.y>=.9&&p.vy<=0){
  if(c.collapseTiles?.length){p.tileContacts??={};for(const tile of c.collapseTiles)if(Math.abs(p.x)<c.width&&Math.abs(p.z-tile.z)<tile.halfLength&&p.tileContacts[tile.id]===undefined)p.tileContacts[tile.id]=time;}
  const ferry=c.ferries?.find(f=>Math.abs(p.x-ferryX(f,time))<f.halfWidth&&Math.abs(p.z-f.z)<f.halfLength&&!c.segments.some(([a,b])=>p.z>=a&&p.z<=b));
  if(ferry)p.x+=ferryX(ferry,time)-ferryX(ferry,time-dt);
 }
}
export function buildSignature(view,c){
 view.signatureMeshes=[];
 for(const ferry of c.ferries||[]){const mesh=view.mesh('round','#61d9f0',0,-.06,-ferry.z,ferry.halfWidth*2,.2,ferry.halfLength*2);mesh.userData??={};mesh.userData.custom=true;view.signatureMeshes.push({mesh,ferry});}
 for(const tile of c.collapseTiles||[]){const mesh=view.mesh('round','#f7a345',0,.1,-tile.z,c.width*2,.12,tile.halfLength*2);mesh.userData??={};mesh.userData.custom=true;view.signatureMeshes.push({mesh,tile});
  for(let x=-c.width+1;x<c.width;x+=2){const mark=view.mesh('box','#332344',x,.18,-tile.z,.5,.04,tile.halfLength*2);mark.rotation.y=.2;mark.userData??={};mark.userData.custom=true;view.signatureMeshes.push({mesh:mark,tile});}}
 if(c.signature==='tower')for(const s of c.spinners)for(const side of [-1,1]){view.mesh('cylinder','#6c498f',side*(c.width+1),3,-s.z,1.4,6,1.4);view.mesh('cone','#ffd349',side*(c.width+1),7,-s.z,2,2,2);}
}
export function animateSignature(view,room,mine){
 const player=room?.players.find(p=>p.id===mine);
 for(const item of view.signatureMeshes||[]){
  if(item.ferry)item.mesh.position.x=ferryX(item.ferry,room?.time||0);
  if(item.tile){const at=player?.tileContacts?.[item.tile.id],age=Number.isFinite(at)?room.time-at:0;item.mesh.visible=age<item.tile.delay;if(item.mesh.scale)item.mesh.scale.y=age>0?.08:.12;}
 }
}

export function renderSegments(c){
 let parts=c.segments.map(p=>[...p]);
 for(const tile of c.collapseTiles||[]){const lo=tile.z-tile.halfLength,hi=tile.z+tile.halfLength;parts=parts.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.max(a,lo)],[Math.min(b,hi),b]].filter(([x,y])=>y-x>.05));}
 return parts;
}
