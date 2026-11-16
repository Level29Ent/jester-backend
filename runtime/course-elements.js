import {buildSignature} from './signature-courses.js';
import {COURSES, COURSE_ELEMENTS, rhythmActive} from './course.js';
export {COURSE_ELEMENTS} from './course.js';
// Rendering and physics use the same finalized layout, including clearance.

export function courseElementAt(course, p) {
  return COURSE_ELEMENTS[course]?.zones.find(o =>
    Math.abs(p.x - o.x) <= o.halfWidth && Math.abs(p.z - o.z) <= o.halfLength);
}

// Modify velocity before integration so interpolation and collision checks see
// the same motion. Springs only fire from the ground, not during a fly-over.
export function applyCourseElement(course, p, dt = 1/60, previous = p) {
  const o = courseElementAt(course, p);
  if (!o || p.rank || p.stun > 0 || p.y < .9) return;
  if (o.type === 'wind' && p.y <= 1.05 && p.vy <= 0) p.vx += o.force;
  if (o.type === 'belt' && p.y <= 1.05 && p.vy <= 0) p.vz += o.force;
  if (p.y <= 1.05 && p.vy <= 0 && !p.dashing) {
    if (o.type === 'slime') { p.vx *= o.force; p.vz *= o.force; }
    if (o.type === 'ice') {
      const blend = 1 - Math.pow(1 - o.force, Math.max(0, dt) * 60);
      p.vx = previous.vx + (p.vx - previous.vx) * blend;
      p.vz = previous.vz + (p.vz - previous.vz) * blend;
    }
  }
  if (o.type === 'spring' && p.y <= 1.05 && p.vy <= 0) {
    p.vy = o.force; p.coyote = p.jumpBuffer = 0; p.event++;
  }
}

// Use the existing renderer's geometry/material cache; zone tiles batch with
// the track. No extra animation loops, assets or per-frame allocations.
export function buildCourseElements(view, course) {
  const elements = COURSE_ELEMENTS[course];
  if (!elements) return;
  view.rhythmLights=[];
  buildSignature(view,COURSES[course]);
  for(const route of COURSES[course].routes||[]){
    view.mesh('round','#ffd53d',route.x,.18,-route.z,route.halfWidth*2,.12,route.halfLength*2);
    const sign=view.label('↗ RISK ROUTE · JUMP','#251936','#ffd53d',3.2);sign.position.set(route.x,3.6,-route.z);view.courseGroup.add(sign);
  }
  buildCourseScenery(view, course);
  for(const trap of COURSES[course].rhythmTraps||[]){
    const color=trap.type==='pulse'?'#ee5367':'#ed9c35';
    view.mesh('round',color,trap.x,.14,-trap.z,trap.halfWidth*2,.12,trap.halfLength*2);
    for(let i=-1;i<=1;i++)view.mesh('box','#251936',trap.x,.23,-trap.z+i*.9,trap.halfWidth*1.8,.08,.16);
    const sign=view.label(trap.type==='pulse'?'PULSE · JUMP!':'RUMBLE · SLOW','#251936',color,2.8);sign.position.set(trap.x,3.7,-trap.z);view.courseGroup.add(sign);
    if(trap.type==='pulse'){const light=view.mesh('sphere',color,trap.x,.55,-trap.z,.35,.35,.35);(view.rhythmLights??=[]).push({mesh:light,trap,course});}
  }
  for (const o of elements.zones) {
    const color = o.color || (o.type === 'ice' ? '#a6f4ff' : o.type === 'slime' ? '#c5a642' : o.type === 'wind' ? '#5cd9f5' : o.type === 'spring' ? '#ff7bba' : o.force > 0 ? '#44cf88' : '#ed665f');
    view.mesh('round', color, o.x, .09, -o.z, o.halfWidth * 2, .12, o.halfLength * 2);
    for (let offset = -1; offset <= 1; offset++) {
      if (o.type === 'ice' || o.type === 'slime') {
        view.mesh('round', o.type === 'ice' ? '#ffffff' : '#769342', o.x+offset*o.halfWidth*.6, .18, -o.z, .35, .04, o.halfLength);
        continue;
      }
      const arrow = view.mesh('cone', '#ffffff', o.x + (o.type === 'wind' ? 0 : offset * .8), .19,
        -o.z + (o.type === 'wind' ? offset * 1.5 : 0), .5, .7, .06);
      arrow.rotation.x = -Math.PI / 2;
      if (o.type === 'wind') arrow.rotation.z = o.force > 0 ? -Math.PI / 2 : Math.PI / 2;
      else if (o.type === 'belt' && o.force < 0) arrow.rotation.z = Math.PI;
      if (o.type === 'spring') view.mesh('round', '#fff3ca', o.x + offset * .8, .14, -o.z + .65, .5, .06, .15);
    }
    buildSurfaceTrap(view, o);
    const sign = view.label(o.type === 'ice' ? '◇ ICE · TURN EARLY' : o.type === 'slime' ? '≈ STICKY · JUMP!' : o.type === 'wind' ? '≋ WIND TRAP' : o.type === 'spring' ? '↑ BOUNCE!' : o.force > 0 ? '↑ FAST BELT' : '↓ REVERSE BELT', '#251936', color, 2.8);
    sign.position.set(o.x, 3.7, -o.z);
    view.courseGroup.add(sign);
  }
}

// Static, batched landmarks: no extra animation loop or downloaded models.
function buildCourseScenery(view, course) {
  const c = COURSES[course], kind = c.challenge.scenery;
  const shapes = {
    cloud:['round','#ffffff',5,2,3], sun:['sphere','#ffcf45',3,3,1],
    tent:['cone','#e95183',4,5,4], arch:['box',c.accent,1,6,1],
    volcano:['cone','#bc5035',6,6,6], crystal:['cone','#a6f4ff',2,7,2],
    castle:['box',c.side,3,6,3], pyramid:['cone','#dcac57',6,5,6],
    sail:['cone','#e6fbff',3,6,1], candy:['sphere','#fb9ebf',3,3,3],
    bolt:['box','#faff7b',1,6,1], tree:['cone','#3c9b59',5,6,5],
    moon:['sphere','#e6e1ff',4,4,4], coral:['round','#fb937f',1,5,1],
    gear:['cylinder','#dba66d',4,1,4]
  };
  const [shape,color,w,h,d] = shapes[kind];
  for (const [a,b] of c.segments) for (const side of [-1,1]) {
    const x = side*(c.width+8), z = -(a+b)/2;
    view.mesh('cylinder',c.side,x,-1,z,1,4,1);
    const landmark = view.mesh(shape,color,x,h/2,z,w,h,d);
    if (kind === 'bolt') landmark.rotation.z = -.4;
    if (kind === 'arch' || kind === 'castle') {
      view.mesh(shape,color,x+side*4,h/2,z,w,h,d);
      view.mesh('box',c.accent,x+side*2,h,z,5,1,1);
    }
    if (kind === 'coral') {
      view.mesh('round',color,x-1,2,z,1,3,1);
      view.mesh('round',color,x+1,3,z,1,4,1);
    }
  }
  const sign = view.label(c.challenge.title.toUpperCase(), '#251936', c.accent, 5);
  sign.position.set(0,7,-5);
  view.courseGroup.add(sign);
}

// All details stay inside the existing hazard footprint. Static geometry batches
// with its parent, including moving sweeper/gate groups; no new animation loop.
export function buildSolidTrap(view, type, o, course, group = view.courseGroup) {
  const dark = '#211c2c', yellow = '#ffcf32', red = '#e84d59';
  if (type === 'bumper') {
    view.mesh('cylinder', dark, o.x, .9, -o.z, 1.075, .36, 1.075, group);
    for (const side of [-1,1]) {
      const stripe = view.mesh('box', yellow, o.x+side*.44, .91, -o.z+.99, .22, .32, .035, group);
      stripe.rotation.z = -.45;
    }
    view.mesh('sphere', red, o.x, 1.83, -o.z, .55, .12, .55, group);
  }
  if (type === 'spinner') {
    const length = course.width*2-1.3;
    for (let x=-length/2+.6; x<length/2; x+=1.5) {
      for(const side of [-1,1]) {
        const stripe=view.mesh('box',yellow,x,0,side*.296,.45,.52,.025,group);
        stripe.rotation.z=-.45;
      }
    }
    for(const x of [-length/2,length/2]) view.mesh('sphere',red,x,0,0,.39,.39,.39,group);
  }
  if (type === 'gate') {
    for(const side of [-1,1]) {
      view.mesh('box',dark,0,0,side*.36,2.4,1.8,.025,group);
      for(let x=-.8;x<=.8;x+=.8) {
        const stripe=view.mesh('box',yellow,x,0,side*.39,.27,1.65,.025,group);
        stripe.rotation.z=-.3;
      }
      view.mesh('sphere',red,0,.94,side*.37,.18,.18,.06,group);
    }
  }
}

function buildSurfaceTrap(view, o) {
  const dark='#211c2c', yellow='#ffcf32';
  // Recessed warning border: stays low so it does not imply a solid wall.
  for(const side of [-1,1]) {
    view.mesh('box',dark,o.x+side*(o.halfWidth-.09),.17,-o.z,.16,.035,o.halfLength*2);
    for(const z of [-.65,0,.65]) view.mesh('box',yellow,o.x+side*(o.halfWidth-.09),.2,-o.z+z*o.halfLength,.17,.025,.35);
  }
  if(o.type==='wind') {
    view.mesh('cylinder',dark,o.x,.18,-o.z,.7,.08,.7);
    for(let i=0;i<3;i++) {
      const blade=view.mesh('box','#d9faff',o.x,.24,-o.z,1.25,.035,.18);
      blade.rotation.y=i*Math.PI/3;
    }
  }
  if(o.type==='belt') for(let i=-2;i<=2;i++) {
    view.mesh('box','#253936',o.x,.17,-o.z+i*o.halfLength*.35,o.halfWidth*1.6,.025,.08);
  }
  if(o.type==='spring') {
    for(const side of [-1,1]) for(const dz of [-.6,0,.6]) {
      view.mesh('cylinder','#f5efff',o.x+side*(o.halfWidth-.4),.22,-o.z+dz,.13,.12,.13);
    }
    view.mesh('round','#ffbee0',o.x,.24,-o.z,o.halfWidth*1.1,.08,.6);
  }
  if(o.type==='ice') for(let i=-1;i<=1;i++) {
    const crack=view.mesh('box','#3c95bd',o.x+i*o.halfWidth*.45,.22,-o.z,.055,.025,o.halfLength*1.2);
    crack.rotation.y=(i%2?1:-1)*.35;
  }
  if(o.type==='slime') for(let i=-1;i<=1;i++) {
    view.mesh('sphere',o.color||'#83b83e',o.x+i*o.halfWidth*.45,.22,-o.z+i*.7,.3,.12,.3);
  }
}

export function applyRhythmTrap(course,p,time){
 const trap=COURSES[course].rhythmTraps?.find(o=>Math.abs(p.x-o.x)<o.halfWidth&&Math.abs(p.z-o.z)<o.halfLength&&rhythmActive(o,time));
 if(!trap||p.y>1.05||p.vy>0||p.shield||p.dashing)return;
 if(trap.type==='pulse'&&p.stun===0){p.stun=.22;p.vy=3;p.event++;}
 if(trap.type==='rumble'){p.vx*=.65;p.vz*=.65;}
}
