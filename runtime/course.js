export const COLORS=['#9428c5','#36bf36','#f6bc18','#e95183'];
export const COURSES={
 sky:{name:'Skyline Shuffle',sky:'#d7eafa',track:'#aee966',side:'#843ab8',accent:'#ffc928',speed:1,width:8,finish:104,segments:[[-8,34],[38,70],[74,113]],checkpoints:[43,80],spinners:[{z:15,rate:-.8},{z:23,rate:.95},{z:57,rate:-1.1},{z:92,rate:1.2}],bumpers:[{x:2,z:28},{x:-2,z:96},{x:-4,z:13},{x:3,z:16},{x:4,z:46},{x:-3,z:50},{x:0,z:83},{x:4,z:86}],boosts:[{x:0,z:8},{x:-4,z:46},{x:3,z:81}],walls:[{z:48,rate:-1,range:4.5},{z:63,rate:1.2,range:4.5}]},
 sunset:{name:'Golden Hour',sky:'#f6ddc5',track:'#ffcc55',side:'#ba5d8b',accent:'#6ace83',speed:1.13,width:7,finish:118,segments:[[-8,29],[33,61],[65,88],[92,127]],checkpoints:[39,73,99],spinners:[{z:7,rate:-.85},{z:19,rate:1.15},{z:51,rate:-1.05},{z:80,rate:1.3},{z:108,rate:-1.25}],bumpers:[{x:-2,z:24},{x:2,z:103},{x:3,z:10},{x:-3,z:43},{x:4,z:70},{x:0,z:101}],boosts:[{x:-3,z:7},{x:3,z:38},{x:-3,z:71},{x:4,z:98}],walls:[{z:76,rate:1,range:4},{z:57,rate:1.3,range:4},{z:112,rate:-1.1,range:4}]},
 carnival:{name:'Jester Carnival',sky:'#e7daf8',track:'#82d7ad',side:'#982bc0',accent:'#ffd42b',speed:1.08,width:6.5,finish:126,segments:[[-8,36],[40,76],[80,135]],checkpoints:[47,90],spinners:[{z:48,rate:-.9},{z:23,rate:-1.1},{z:64,rate:1.2},{z:103,rate:-1.4}],bumpers:[{x:2,z:58},{x:-2,z:109},{x:-3,z:14},{x:3,z:18},{x:0,z:53},{x:-3,z:86},{x:3,z:96}],boosts:[{x:0,z:8},{x:3,z:44},{x:-3,z:83},{x:0,z:115}],walls:[{z:94,rate:-1,range:3.8},{z:32,rate:1.1,range:3.8},{z:71,rate:1.4,range:3.5},{z:117,rate:-1.2,range:3.8}]}
};
// Fixed blueprints: random selection never changes a course's geometry or replay.
// Each entry chooses its platform lengths, width and palette; challenges follow below.
const BLUEPRINTS = [
  ['mint', 'Mint Motorway', [30,34,32], 8, '#c9f2e3', '#55d9ab'],
  ['lava', 'Lava Leap', [27,30,35,28], 7, '#ffcfbd', '#ff975e'],
  ['frost', 'Frostbite Freeway', [35,28,33], 7.5, '#d6f5ff', '#8fdaff'],
  ['royal', 'Royal Rumble', [29,36,31,30], 8, '#e6d1ff', '#c59cff'],
  ['neon', 'Neon Night Run', [32,29,38], 7, '#c8c9f4', '#eb86d9'],
  ['desert', 'Desert Dash', [38,30,29], 8.5, '#ffe5be', '#ebbd70'],
  ['ocean', 'Ocean Overdrive', [31,35,28,32], 7.5, '#bdeaff', '#4dc9da'],
  ['candy', 'Candy Chaos', [28,32,36], 8, '#ffe0ef', '#fb9ebf'],
  ['storm', 'Storm Sprint', [36,27,34,29], 7, '#d1d9f3', '#a0b0e8'],
  ['jungle', 'Jungle Jumble', [33,37,30], 8.5, '#d2efca', '#77c969'],
  ['solar', 'Solar Switchback', [26,33,31,35], 7.5, '#fff0c4', '#ffbf50'],
  ['moon', 'Moonlight Mayhem', [34,31,37], 7, '#d6d2f0', '#b6acf2'],
  ['coral', 'Coral Crossing', [30,28,34,33], 8, '#ffe0db', '#fa9f8a'],
  ['copper', 'Copper Carnival', [37,33,29], 7.5, '#efd7c8', '#dba66d'],
  ['cloud', 'Cloud Crown Chase', [32,36,30,28], 8.5, '#e5f2ff', '#b0dbff'],
  ['prism', 'Prism Panic', [29,34,38], 7, '#ebdfff', '#c88ee6'],
  ['champion', 'Champion Gauntlet', [35,32,29,34], 8, '#f3e4c6', '#e9c65a']
];
for (const [index, [id, name, lengths, width, sky, track]] of BLUEPRINTS.entries()) {
  const segments = []; let start = -8;
  for (const [j, length] of lengths.entries()) { segments.push([start, start + length]); start += length + [3, 4, 2.5][(index+j)%3]; }
  COURSES[id] = {name, sky, track, side:['#843ab8','#ba5d8b','#266f87'][index%3],
    accent:['#ffc928','#88f0ba','#ef9bdf'][index%3], speed:1+(index%4)*.04,
    width, segments, finish:segments.at(-1)[1]-9,
    checkpoints:segments.slice(1).map(([a])=>a+5),
    boosts:segments.map(([a])=>({x:index%2?-3:3,z:a+3}))
  };
}
// Authored identities replace the repeated one-sweeper/one-gate platform recipe.
// The first three tracks start from their familiar trap layouts; all tracks
// receive the same mesh/swept-footprint clearance pass below.
const CHALLENGES = {
  sky: ['Windwalk', 'Stay beside blue pads, or jump the crosswind.', 'cloud', 'mixed'],
  sunset: ['Express lanes', 'Chain green belts; steer around red reverse lanes.', 'sun', 'gates'],
  carnival: ['Bounce parade', 'Aim for pink launch pads before each gap.', 'tent', 'sweepers'],
  mint: ['Motorway express', 'Use long fast lanes, then jump the toll gates.', 'arch', 'gates'],
  lava: ['Volcano hop', 'Bounce between short islands. Save dash for the gaps.', 'volcano', 'sweepers'],
  frost: ['Ice slalom', 'Ice carries your momentum. Turn early or jump to regain control.', 'crystal', 'slalom'],
  royal: ['Castle gates', 'Watch the moving gates and dash through their openings.', 'castle', 'gates'],
  neon: ['Laser rhythm', 'Jump successive sweepers; the outside lanes offer space to recover.', 'arch', 'sweepers'],
  desert: ['Quicksand shortcuts', 'Amber sand slows you. Jump it or take the dry outside lane.', 'pyramid', 'slalom'],
  ocean: ['Tidal lanes', 'Alternate fast and reverse currents while dodging moving gates.', 'sail', 'gates'],
  candy: ['Sticky candy', 'Pink slime slows your feet; bounce pads bypass the sticky lanes.', 'candy', 'slalom'],
  storm: ['Crosswind alley', 'Alternating wind pads and quick sweepers demand lane changes.', 'bolt', 'sweepers'],
  jungle: ['Vine maze', 'Weave through bumper rows. Leap over green bog shortcuts.', 'tree', 'slalom'],
  solar: ['Sun launch', 'Chain springboards into a fast final platform.', 'sun', 'sweepers'],
  moon: ['Moon jumps', 'Low gravity makes jumps float farther. Release sideways input before landing.', 'moon', 'slalom'],
  coral: ['Reef chicanes', 'Thread alternating bumper rows, then ride the current to the finish.', 'coral', 'slalom'],
  copper: ['Clockwork gates', 'Slow and fast gates alternate. Wait for a clear opening.', 'gear', 'gates'],
  cloud: ['Cloud hopping', 'Floaty jumps and wind pads reward careful landings.', 'cloud', 'mixed'],
  prism: ['Split decision', 'Pick fast or reverse lanes, then dodge the bumper chicane.', 'crystal', 'mixed'],
  champion: ['Final exam', 'Belts, slime, springs and sweepers combine in one long gauntlet.', 'castle', 'mixed']
};
for (const [id, [title, tip, scenery, pattern]] of Object.entries(CHALLENGES)) {
  const c = COURSES[id];
  c.challenge = {title, tip, scenery};
  if (id === 'moon') c.gravity = 15;
  if (id === 'cloud') c.gravity = 19;
  if (['sky', 'sunset', 'carnival'].includes(id)) continue;
  c.spinners = []; c.walls = []; c.bumpers = [];
  const zones = [];
  // Keep the first obstacle beyond the starting grid and every zone on solid ground.
  c.segments.forEach(([a, b], j) => {
    const from = Math.max(7, a + 5), mid = (from + b - 5) / 2;
    const lane = j % 2 ? -2.8 : 2.8;
    if (pattern === 'sweepers' || pattern === 'mixed') {
      c.spinners.push({z:mid, rate:(j % 2 ? -1 : 1) * (id === 'storm' ? 1.6 : 1.05)});
      if (pattern === 'sweepers') c.spinners.push({z:b-5, rate:-(j % 2 ? -1 : 1) * .7});
    }
    if (pattern === 'gates' || pattern === 'mixed') {
      c.walls.push({z:pattern === 'mixed' ? b-5 : mid, rate:(j % 2 ? -1 : 1) * (id === 'copper' ? .65+j*.35 : 1.2), range:c.width-2});
      if (pattern === 'gates') c.walls.push({z:b-5, rate:-(.7+j*.2), range:c.width-2});
    }
    if (pattern === 'slalom' || pattern === 'mixed') {
      for (const [z, side] of [[from, 1], [mid, -1], [b-4, 1]]) {
        c.bumpers.push({x:side*lane, z}, {x:side*lane+ (side*lane>0 ? 2.8 : -2.8), z});
      }
    }
    const zone = (type, x, z, force, halfLength=2.5, halfWidth=type === 'wind' ? 1.5 : 1.6) => zones.push({type,x,z,force,halfLength,halfWidth, ...(type === 'slime' ? {color:id === 'candy' ? '#ee87b3' : id === 'desert' ? '#c5a642' : '#8dc949'} : {})});
    switch (id) {
      case 'mint': zone('belt', lane, mid-4, 4.5, 5); break;
      case 'lava': zone('spring', 0, b-4, 12.5, 1.5, 3); break;
      case 'frost': zone('ice', 0, mid, .12, 7, c.width-1); break;
      case 'royal': zone('belt', -lane, from, -3); break;
      case 'neon': zone('belt', lane, from, 4); break;
      case 'desert': zone('slime', 0, mid, .45, 6, c.width-2.5); break;
      case 'ocean': zone('belt', lane, mid-3, 4, 4); zone('belt', -lane, mid+3, -3, 4); break;
      case 'candy': zone('slime', -lane, mid, .4, 4); zone('spring', lane, b-4, 12.5, 1.5); break;
      case 'storm': zone('wind', lane, from, j%2?-3.5:3.5); break;
      case 'jungle': zone('slime', -lane, mid, .55, 4); break;
      case 'solar': zone('spring', lane, b-4, 13, 1.5); break;
      case 'moon': zone('belt', -lane, from, 2); break;
      case 'coral': zone('belt', -lane, mid+2, 3.5, 4); break;
      case 'copper': zone('belt', lane, from, j%2?-3:3); break;
      case 'cloud': zone('wind', lane, from, j%2?-2:2); break;
      case 'prism': zone('belt', lane, from, 4); zone('belt', -lane, from, -3); break;
      case 'champion': zone(['belt','slime','spring','wind'][j], lane, j===2?b-4:from, [4,.45,12.5,-3][j], j===2?1.5:2.5); break;
    }
  });
  c.elements = {title, tip, zones};
}

// Short courses target ~48 seconds, with a strict 60-second racing deadline.
// The three-second countdown is separate; finish earlier through skill.
export const RACE_LIMIT = 60;
export const TARGET_RACE_SECONDS = 48;
const RACE_SECTIONS = {sky:3,sunset:3,carnival:2,mint:4,lava:3,frost:4,
 royal:3,neon:4,desert:3,ocean:3,candy:4,storm:3,jungle:4,solar:3,
 moon:4,coral:3,copper:4,cloud:3,prism:3,champion:3};
for (const [id, c] of Object.entries(COURSES)) {
  const span = c.segments.at(-1)[1] + 12;
  const laps = RACE_SECTIONS[id];
  const original = {segments:c.segments, spinners:c.spinners, walls:c.walls,
    bumpers:c.bumpers, boosts:c.boosts, checkpoints:c.checkpoints};
  for (const key of ['segments','spinners','walls','bumpers','boosts','checkpoints']) {
    c[key] = Array.from({length:laps}, (_, lap) => original[key].map(o =>
      key === 'segments' ? o.map(z=>z+span*lap) : key === 'checkpoints' ? o+span*lap : {...o,z:o.z+span*lap}
    )).flat();
  }
  // A checkpoint near each new section prevents long runbacks after a fall.
  c.checkpoints = c.segments.slice(1).map(([a])=>a+5);
  c.finish += span*(laps-1);
  c.sections = laps;
}

export const COURSE_ELEMENTS = {
  sky: {
    title: 'Wind-trap pads',
    tip: 'Only marked blue wind-trap pads push sideways. Avoid the pad or jump over it.',
    zones: [
      {type:'wind', x:3, z:9, halfWidth:1.5, halfLength:3, force:2.4},
      {type:'wind', x:-3, z:79, halfWidth:1.5, halfLength:3, force:-2.4}
    ]
  },
  sunset: {
    title: 'Conveyor rush',
    tip: 'Green belts carry you forward; red belts pull you back. Jump or switch lanes.',
    zones: [
      {type:'belt', x:3, z:40, halfWidth:1.6, halfLength:4, force:3.2},
      {type:'belt', x:-3, z:99, halfWidth:1.6, halfLength:4, force:-2.8}
    ]
  },
  carnival: {
    title: 'Springboard spectacular',
    tip: 'Pink springboards launch you high. Keep moving forward to clear the next gap.',
    zones: [
      {type:'spring', x:0, z:31, halfWidth:2.2, halfLength:1.5, force:12.5},
      {type:'spring', x:0, z:71, halfWidth:2.2, halfLength:1.5, force:12.5}
    ]
  }
};

// Finalize once for renderer, bot pathing, collision checks and server replay.
// Mesh extents: bumper cap radius 1.14; gate half-depth .45 (strip included);
// rotating bar/endcap reaches width-.25 in every direction. Leave .4 breathing room.
for (const [id, c] of Object.entries(COURSES)) {
  if (c.elements) COURSE_ELEMENTS[id] = c.elements;
  const elements = COURSE_ELEMENTS[id], span = (c.segments.at(-1)[1]+12) / c.sections;
  elements.zones = Array.from({length:c.sections}, (_, section)=>elements.zones.map(o=>({...o,z:o.z+span*section}))).flat();
  const radius = c.width-.25, clearance = .4;
  const spinners = [];
  for (const spinner of c.spinners) {
    if (spinners.every(other=>Math.abs(other.z-spinner.z)>=2*radius+clearance)) spinners.push(spinner);
  }
  c.spinners = spinners;
  c.walls = c.walls.filter(w=>spinners.every(s=>Math.abs(w.z-s.z)>=radius+.45+clearance));
  const bumpers = [];
  for (const b of c.bumpers) {
    if (Math.abs(b.x)+1.14+clearance>c.width) continue;
    if (bumpers.some(other=>Math.hypot(b.x-other.x,b.z-other.z)<2*1.14+clearance)) continue;
    if (spinners.some(s=>Math.hypot(b.x,b.z-s.z)<radius+1.14+clearance)) continue;
    if (c.walls.some(w=>Math.abs(w.z-b.z)<.45+1.14+clearance && Math.abs(b.x)<w.range+1.25+1.14+clearance)) continue;
    // Ice and slime are intentional ground surfaces. Raised action pads must
    // remain usable, rather than hiding their arrows and signs inside a drum.
    if (elements.zones.some(p=>['belt','wind','spring'].includes(p.type) &&
      Math.abs(p.x-b.x)<p.halfWidth+1.14+clearance && Math.abs(p.z-b.z)<p.halfLength+1.14+clearance)) continue;
    bumpers.push(b);
  }
  c.bumpers = bumpers;
}

export const COURSE_IDS = Object.freeze(Object.keys(COURSES));
export function randomCourse(previous, random = Math.random) {
  const choices = COURSE_IDS.filter(id => id !== previous);
  const sample = Math.max(0, Math.min(.999999999, Number(random()) || 0));
  return choices[Math.floor(sample * choices.length)];
}

export function spinnerAngle(o,t,course){return t*o.rate*COURSES[course].speed;}
export function wallX(o,t){return Math.sin(t*o.rate)*o.range;}
export function gaps(course){const s=COURSES[course].segments;return s.slice(0,-1).map(([a,b],i)=>[b,s[i+1][0]])}
export function coinPositions(course){const c=COURSES[course],list=[];let id=0;for(const[a,b]of c.segments){for(let z=Math.max(5,a+4);z<Math.min(b-3,c.finish-2);z+=6){list.push({id:id++,x:[0,-3,3][id%3],y:1.1,z})}}return list}
// Default-map aliases retained for testing integrations.
export const SEGMENTS=COURSES.sky.segments,FINISH=COURSES.sky.finish,CHECKPOINTS=COURSES.sky.checkpoints,SPINNERS=COURSES.sky.spinners,BUMPERS=COURSES.sky.bumpers;

// Side-lane hazards keep the center route readable and never obstruct gaps.
for(const [id,c] of Object.entries(COURSES)){
  c.rhythmTraps=c.segments.filter((_,i)=>i%3===1).map(([a,b],i)=>({type:i%2?'rumble':'pulse',x:(i%2?1:-1)*(c.width-2),z:(a+b)/2,halfWidth:1.2,halfLength:1.7,phase:i*.7})).filter(o=>!c.spinners.some(s=>Math.hypot(o.x,o.z-s.z)<c.width+2)&&!c.walls.some(w=>Math.abs(o.z-w.z)<3)&&!c.bumpers.some(b=>Math.hypot(o.x-b.x,o.z-b.z)<3)&&!COURSE_ELEMENTS[id].zones.some(z=>Math.abs(o.x-z.x)<z.halfWidth+o.halfWidth&&Math.abs(o.z-z.z)<z.halfLength+o.halfLength));
}
export function rhythmActive(trap,time){return trap.type==='rumble'||Math.sin(time*3+trap.phase)>0;}

// A narrow alternate lane before selected gaps offers speed in exchange for
// needing an edge jump. Center track remains the safe route, never a teleport.
for(const c of Object.values(COURSES)){
 c.routes=c.segments.slice(0,-1).flatMap(([a,b],i)=>i%3===0?[{x:(i%2?1:-1)*(c.width-1.4),z:b-3.2,end:c.segments[i+1][0]+2,halfWidth:.8,halfLength:1.2}]:[]);
}
