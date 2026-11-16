import {steerRacer} from './movement.js';
import {TRACK_VERSION, ZERO_UPGRADES, CUP_POINTS, exportBackup, importBackup, dailyChallenge, dailyComplete, medalFor, recordKey, ghostAt, cupStandings} from './progression.js';
import {SABOTAGE, normalizeSabotage, useSabotage, tickTraps} from './sabotage.js';
import {applyCourseElement} from './course-elements.js';
import {normalizeAppearance} from './appearance.js';
import {RIVALS} from './rivals.js';
import {COURSES, RACE_LIMIT, COURSE_IDS, randomCourse, coinPositions, gaps, spinnerAngle, wallX} from './course.js';
import {CATALOG, UPGRADES, starterLoadout} from './catalog.js';

export const COURSE_ORDER = COURSE_IDS;
export const nextPracticeCourse = randomCourse;
// Extended courses are fixed; reuse their pickup/gap arrays in every simulation step.
const COURSE_COINS = Object.fromEntries(COURSE_IDS.map(id=>[id,coinPositions(id)]));
const COURSE_GAPS = Object.fromEntries(COURSE_IDS.map(id=>[id,gaps(id)]));

// Only unbanked race coins are at risk; saved wallet coins never go negative.
export const FALL_PENALTY = 10;
export function restartAfterFall(p, course) {
  p.lostCoins = Math.min(FALL_PENALTY, p.raceCash);
  p.raceCash -= p.lostCoins;
  const checkpoints = COURSES[course]?.checkpoints || [];
  p.cp = Math.max(0, Math.min(checkpoints.length, p.cp || 0));
  p.x = 0; p.z = p.cp ? checkpoints[p.cp - 1] + 1 : 0; p.y = 1;
  p.vx = p.vy = p.vz = p.cd = p.boost = p.dashing = 0;
  p.jumpBuffer = p.coyote = 0;
  p.controlVx=p.controlVz=0;
  p.falls++; p.event++; p.stun = .15;
  // Keep coinIds: restarting must not allow farming the same pickups twice.
}

const SAVE_KEY = 'jester-rush-practice-v1';
const ONLINE_MESSAGE = 'Online racing needs a race server. Choose Practice with bots to play now.';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const copy = value => JSON.parse(JSON.stringify(value));

// Static deployments have no race server. Keep practice state in this browser;
// never present local bots or local currency as multiplayer/server-owned state.
export function createPracticeClient({storage, now = () => performance.now(), onRaceStart, onRaceEnd, random = Math.random, network = null} = {}) {
  let persistent = false;
  let profile = {
    name: 'Player 29', cash: 0, owned: Object.values(starterLoadout),
    equipped: {...starterLoadout}, upgrades: {speed: 0, jump: 0, dash: 0, magnet: 0},
    stats: {races: 0, wins: 0}
  };
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    if (saved?.version === 1 && saved.profile) {
      const p = saved.profile;
      if (typeof p.name === 'string' && Number.isFinite(p.cash) && p.cash >= 0 &&
          Array.isArray(p.owned) && p.equipped && p.upgrades && p.stats &&
          Object.keys(starterLoadout).every(slot => CATALOG.some(i => i.id === p.equipped[slot] && i.slot === slot) && p.owned.includes(p.equipped[slot])) &&
          Object.entries(UPGRADES).every(([key, u]) => Number.isInteger(p.upgrades[key]) && p.upgrades[key] >= 0 && p.upgrades[key] <= u.max) &&
          ['races', 'wins'].every(key => Number.isInteger(p.stats[key]) && p.stats[key] >= 0)) profile = p;
    }
  } catch { /* Private browsing or damaged storage must not block play. */ }
  profile.appearance = normalizeAppearance(profile.appearance);
  profile.sabotage = normalizeSabotage(profile.sabotage);
  function save() {
    try {
      storage?.setItem(SAVE_KEY, JSON.stringify({version: 1, profile}));
      persistent = !!storage;
    } catch { persistent = false; }
  }
  save();
  let options = {runMode:'race',difficulty:'standard',autoRotate:true,standardized:false,checkpoint:0};
  let progress = {records:{},medals:{},daily:{}};
  try {const saved=JSON.parse(storage?.getItem('jester-rush-progress-v2')||'null');
    if(saved?.version===TRACK_VERSION && saved.records && typeof saved.records==='object'){
      const records=Object.entries(saved.records).slice(-20).filter(([k,r])=>k.startsWith(TRACK_VERSION+':')&&Number.isFinite(r?.time)&&r.time>0&&r.time<=RACE_LIMIT&&Array.isArray(r.samples)&&r.samples.length<=1300&&r.samples.every((p,i)=>Array.isArray(p)&&p.length===4&&p.every(Number.isFinite)&&(!i||p[0]>r.samples[i-1][0]))&&Array.isArray(r.splits));
      progress={records:Object.fromEntries(records),medals:Object.fromEntries(Object.entries(saved.medals||{}).filter(([k,v])=>COURSE_IDS.includes(k)&&['Gold','Silver','Bronze'].includes(v))),daily:typeof saved.daily==='object'&&saved.daily?saved.daily:{}};
    }
  } catch {}
  function saveProgress(){try{storage?.setItem('jester-rush-progress-v2',JSON.stringify({...progress,version:TRACK_VERSION}));}catch{}}
  let samples=[], splits=[], previousBest=null, cup=null, challenge=null, tutorial={move:false,jump:false,dash:false,checkpoint:false};
  const eligible = () => options.runMode==='race' && options.difficulty==='standard' && !options.standardized;
  let room = null, lastTick = now(), settled = false, trace = [], nextAt = null, raceColor = 0, generation = 0, queuedCourse = null, lastCourse = null;
  const id = 'practice-you', token = 'local-practice';

  function racer(index, color = 0) {
    const bot = index > 0;
    const loadout = bot ? {...RIVALS[index - 1].loadout} : {...profile.equipped};
    if (!bot) {
      if (loadout.outfit === 'outfit-0') loadout.outfit = `outfit-${color}`;
      if (loadout.hat === 'hat-0') loadout.hat = `hat-${color}`;
    }
    return {
      id: bot ? `practice-bot-${index}` : id, name: bot ? `Bot: ${RIVALS[index - 1].name}` : profile.name,
      bot, loadout, appearance: bot ? normalizeAppearance() : {...profile.appearance}, upgrades: bot || options.standardized ? {...ZERO_UPGRADES} : {...profile.upgrades},
      x: ((index % 4) - 1.5) * 2, y: 1, z: -Math.floor(index / 4) * 1.8,
      vx: 0, vy: 0, vz: 0, cd: 0, boost: 0, dashing: 0, stun: 0, event: 0,
      cp: 0, falls: 0, raceCash: 0, coinIds: [], rank: 0, finishTime: 0, reward: 0, lostCoins: 0,
      shield:0, turbo:0, magnetTime:0, slow:0, jammed:0, jinxed:0, usedSabotage:[], jumpBuffer: 0, coyote: 0, jumpHeld: false, dashHeld: false
    };
  }
  function start(course, color = 0, round = 1) {
    if (!Object.hasOwn(COURSES, course)) throw Error('Choose a valid course.');
    generation++; samples=[]; splits=[]; tutorial={move:false,jump:false,dash:false,checkpoint:false}; raceColor = color; nextAt = null; queuedCourse = null; lastCourse = course;
    room = {course, round, kind: 'practice', code: 'PRACTICE', host: id,
      humanCount: 1, phase: 'countdown', count: 3, time: 0,
      runMode:options.runMode,difficulty:options.difficulty,standardized:options.standardized,training:options.runMode==='training'||options.runMode==='tutorial',traps:[], sabotaged:false, perkNotice:"", players: network ? network.players.map((user,i)=>({...racer(i,color),id:user.id,name:user.name,bot:false,loadout:{...user.loadout},appearance:normalizeAppearance(user.appearance),upgrades:{...ZERO_UPGRADES}})) : Array.from({length: 12}, (_, i) => racer(i, color)), results: []};
    const player=room.players[0];
    previousBest=progress.records[recordKey(room,player)]||null;
    if(room.training && options.checkpoint>0){player.cp=Math.min(options.checkpoint,COURSES[course].checkpoints.length);restartAfterFall(player,course);player.falls=0;player.stun=0;}
    room.tutorial={...tutorial};
    room.daily=challenge;
    room.cup=cup ? {round:cup.index+1,total:3,standings:cupStandings(cup.scores,cup.names)} : null;
    settled = false;
    trace = [];
    lastTick = now();
    return {id, token, room};
  }
  function bank() {
    if (!room || settled) return;
    if(network){settled=true;return;}
    settled = true;
    const player = room.players[0];
    if (eligible() && !room.sabotaged && (player.rank || room.phase === 'results') && onRaceEnd) {
      // Submit only completed rounds. Callback failures never block local play.
      Promise.resolve(onRaceEnd(copy(trace))).catch(() => {});
    }
    if(room.training) return;
    if(player.rank && !room.sabotaged){
      const key=recordKey(room,player), old=progress.records[key];
      if(!old || player.finishTime<old.time){
        // Bound storage to one ghost per course/settings combination (max 20).
        const records=Object.entries(progress.records).filter(([k])=>k!==key).slice(-19);
        progress.records=Object.fromEntries(records);
        progress.records[key]={time:player.finishTime,samples,splits};room.personalBest=true;
      }
      if(options.standardized){const medal=medalFor(room.course,player.finishTime);const order=['Bronze','Silver','Gold'];
        if(medal&&order.indexOf(medal)>order.indexOf(progress.medals[room.course]))progress.medals[room.course]=medal;room.medal=medal;}
      if(challenge && dailyComplete(challenge,player)){progress.daily={[challenge.day]:true};room.dailyCompleted=true;}
      saveProgress();
    }
    if(cup){
      const ordered=[...room.players].sort((a,b)=>a.rank&&b.rank?a.rank-b.rank:a.rank?-1:b.rank?1:b.z-a.z);
      ordered.forEach((p,i)=>{cup.scores[p.id]=(cup.scores[p.id]||0)+(room.time<RACE_LIMIT||p.rank?CUP_POINTS[i]:0);cup.names[p.id]=p.name;});
      room.cup={round:cup.index+1,total:3,standings:cupStandings(cup.scores,cup.names)};
    }
    profile.cash += player.raceCash;
    profile.stats.races++;
    if (player.rank === 1) profile.stats.wins++;
    save();
  }
  function botInput(p, index) {
    const gap = COURSE_GAPS[room.course].some(([edge, end]) => p.z > edge - 4 && p.z < end);
    const course = COURSES[room.course];
    const hazard = course.spinners.some(o => Math.abs(o.z - p.z) < 4) ||
      course.walls.some(o => Math.abs(o.z - p.z) < 4) ||
      course.bumpers.some(o => Math.abs(o.z - p.z) < 3 && Math.abs(o.x - p.x) < 1.8);
    let lane = Math.sin(index * 2.1) * (course.width - 2);
    if(options.difficulty==='expert'){
      const obstacle=course.bumpers.find(o=>o.z>p.z&&o.z-p.z<10&&Math.abs(o.x-lane)<2);
      if(obstacle)lane=clamp(obstacle.x+(obstacle.x>0?-3:3),-course.width+1,course.width-1);
      const pad=course.boosts.find(o=>o.z>p.z&&o.z-p.z<12);if(pad)lane=pad.x;
    }
    const hesitation=options.difficulty==='beginner' && Math.sin(room.time*1.2+index)>.75;
    const jumpReady=options.difficulty==='beginner'?Math.sin(room.time*3+index)>.1:true;
    return {x: clamp((lane - p.x) * .7, -1, 1), z: hesitation?0:options.difficulty==='expert'?1:.83 + index % 3 * .06,
      jump: jumpReady && (gap || hazard) && p.y < 1.05, dash: (gap || options.difficulty==='expert' && !hazard) && p.cd === 0};
  }
  function move(p, input, dt) {
    if (p.rank) return;
    const c = COURSES[room.course];
    for (const key of ['cd', 'boost', 'dashing', 'stun', 'jumpBuffer', 'coyote', 'slow', 'jammed', 'jinxed', 'shield', 'turbo', 'magnetTime']) p[key] = Math.max(0, p[key] - dt);
    const ground = () => Math.abs(p.x) < c.width && c.segments.some(([a, b]) => p.z >= a && p.z <= b);
    if (ground() && p.y <= 1.001 && p.vy <= 0) p.coyote = .1;
    if (input.jump && !p.jumpHeld) p.jumpBuffer = .15;
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = 9.8 * (p.jinxed ? .65 : 1) * (1 + .02 * p.upgrades.jump);
      p.jumpBuffer = p.coyote = 0;
    }
    if (input.dash && !p.dashHeld && p.cd === 0 && !p.jammed) {
      p.dashing = .22; p.cd = 2.8 - .15 * p.upgrades.dash; p.event++;
    }
    p.jumpHeld = !!input.jump; p.dashHeld = !!input.dash;
    let x = clamp(Number(input.x) || 0, -1, 1), z = clamp(Number(input.z) || 0, -1, 1);
    const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length;
    const speed = 8.5 * (1 + .02 * p.upgrades.speed) * (p.boost || p.turbo ? 1.5 : 1) * (p.slow ? .5 : 1);
    const previousVelocity = {vx:p.vx, vz:p.vz};
    // Smooth the player's intended motion, not last frame's belt/wind/slime
    // output. Otherwise belts compound speed and sticky terrain compounds drag.
    if(p.stun===0){p.vx=p.controlVx??p.vx;p.vz=p.controlVz??p.vz;}
    steerRacer(p,x,z,speed,dt);
    p.controlVx=p.stun?0:p.vx;p.controlVz=p.stun?0:p.vz;
    tickTraps(room,p);
    applyCourseElement(room.course, p, dt, previousVelocity);
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.vy -= (c.gravity || 23) * dt; p.y += p.vy * dt;
    if (ground() && p.y <= 1 && p.y >= .5 && p.vy <= 0) { p.y = 1; p.vy = 0; }
    if (p.stun === 0) {
      let hit = c.bumpers.find(o => p.y < 2.6 && Math.hypot(p.x - o.x, p.z - o.z) < 1.3);
      hit ||= c.walls.find(o => p.y < 3.1 && Math.abs(p.z - o.z) < .9 && Math.abs(p.x - wallX(o, room.time)) < 1.8);
      hit ||= c.spinners.find(o => {
        const a = spinnerAngle(o, room.time, room.course);
        // Three.js rotates the bar in world -z; game coordinates use forward +z.
        const along = p.x * Math.cos(a) + (p.z - o.z) * Math.sin(a);
        const across = -p.x * Math.sin(a) + (p.z - o.z) * Math.cos(a);
        return p.y < 2 && Math.abs(along) < c.width - .4 && Math.abs(across) < .85;
      });
      if (hit && !p.shield) { p.stun = .4; p.vx = (p.x >= 0 ? 1 : -1) * 6; p.vz = -4; p.vy = 5; p.event++; }
    }
    if (c.boosts.some(o => Math.abs(p.x - o.x) < 1.5 && Math.abs(p.z - o.z) < 1.6 && p.y < 1.5)) p.boost = .8;
    if (ground() && p.y < 3) {
      c.checkpoints.forEach((z, i) => { if (p.z >= z) p.cp = Math.max(p.cp, i + 1); });
    }
    for (const coin of COURSE_COINS[room.course]) {
      if (!p.coinIds.includes(coin.id) && Math.hypot(p.x - coin.x, p.y - coin.y, p.z - coin.z) < 1.3 + p.upgrades.magnet * .3 + (p.magnetTime ? 3 : 0)) {
        p.coinIds.push(coin.id); p.raceCash += 5;
      }
    }
    if (p.y < -7) {
      restartAfterFall(p, room.course);
    }
    if (p.z >= c.finish && ground() && p.y >= .5) {
      room.finishCount=(room.finishCount||0)+1;p.rank=room.finishCount;
      p.finishTime = room.time; p.reward = p.rank === 1 ? 100 : 50;
      p.raceCash += p.reward; p.vx = p.vy = p.vz = 0;
    }
  }
  function tick(input) {
    const time = now();
    let remaining = Math.min(.25, Math.max(0, (time - lastTick) / 1000));
    if (!network && !settled) trace.push([remaining, input.x || 0, input.z || 0, !!input.jump, !!input.dash]);
    lastTick = time;
    while (remaining > .000001 && room.phase !== 'results') {
      const dt = Math.min(1 / 60, remaining); remaining -= dt;
      if (room.phase === 'countdown') {
        room.count = Math.max(0, room.count - dt);
        if (room.count <= .000001) { room.count = 0; room.phase = 'racing'; }
        continue;
      }
      const player=room.players[0], oldCP=player.cp;
      room.time += dt;
      room.traps = room.traps.filter(t=>t.expires>room.time);
      room.players.forEach((p, index) => move(p, network ? network.input(p.id) : index ? botInput(p, index) : input, dt));
      if(room.phase==='racing'){
        if(!samples.length||room.time-samples.at(-1)[0]>=.1)samples.push([room.time,...[player.x,player.y,player.z].map(n=>Math.round(n*100)/100)]);
        if(player.cp>oldCP)splits[player.cp-1]=room.time;
        const oldSplit=previousBest?.splits?.[player.cp-1];
        room.ghost=ghostAt(previousBest?.samples,room.time);
        room.bestTime=previousBest?.time||null;
        room.splitDelta=oldSplit&&splits[player.cp-1]?splits[player.cp-1]-oldSplit:null;
        tutorial.move ||= player.z>3; tutorial.jump ||= !!input.jump && player.y>1.1; tutorial.dash ||= !!player.dashing; tutorial.checkpoint ||= player.cp>0;
        room.tutorial={...tutorial};
        if(options.runMode==='tutorial' && Object.values(tutorial).every(Boolean)){room.phase='results';room.tutorialComplete=true;}
      }
      if ((!network && room.players[0].rank) || room.time >= (room.training?600:RACE_LIMIT) || room.players.every(p => p.rank)) {
        room.phase = 'results';
        if (room.players[0].rank && !network && options.autoRotate && !room.training && options.runMode==='race' && nextAt === null) {
          nextAt = now() + 5000; queuedCourse = randomCourse(room.course, random);
        }
        room.results = room.players.filter(p => p.rank).sort((a, b) => a.rank - b.rank);
      }
      if (room.players[0].rank || room.phase === 'results') bank();
    }
    if (nextAt !== null) room.nextCourse = {course: queuedCourse, seconds: Math.max(0, (nextAt - now()) / 1000)};
    return room;
  }
  async function request(action, data = {}) {
    switch (action) {
      case 'network/remove':
        if(!network||!room)throw Error('Not a network race.');
        // Keep finished standings; removing a winner must not reuse rank #1.
        room.players=room.players.filter(p=>p.id!==data.id||p.rank);
        for(const p of room.players)if(p.id===data.id)p.disconnected=true;
        return copy(room);
      case 'profile/export': return {backup:exportBackup(profile)};
      case 'profile/import': {
        if(room)throw Error('Leave the race before restoring a backup.');
        const restored=importBackup(data.backup);profile=restored;save();return copy({profile,persistent});
      }
      case 'progress': return copy({medals:progress.medals,daily:progress.daily,challenge:dailyChallenge()});
      case 'configure':
        if(room && room.phase!=='results')throw Error('Change race settings between races.');
        options={...options,...data};return copy(options);
      case 'rotation/cancel': nextAt=null;if(room)delete room.nextCourse;return copy(room);
      case 'training/restart':
        if(!room?.training)throw Error('Checkpoint restart is available in training only.');
        options.checkpoint=data.checkpoint??room.players[0].cp;
        return copy(start(room.course,raceColor,room.round+1).room);
      case 'profile/open': return copy({proof: null, profile, local: true, persistent});
      case 'profile/appearance':
        profile.appearance = normalizeAppearance(data.appearance); save(); return copy({profile});
      case 'profile/name': profile.name = String(data.name || 'Player 29').trim().slice(0, 18) || 'Player 29'; save(); return copy({profile});
      case 'resume': return {room: null};
      case 'enter': {
        if (data.mode !== 'quick') throw Error(ONLINE_MESSAGE);
        if(data.options)options={...options,...data.options};
        options.difficulty=['beginner','standard','expert'].includes(options.difficulty)?options.difficulty:'standard';
        options.runMode=['race','training','tutorial','daily','cup'].includes(options.runMode)?options.runMode:'race';
        challenge=options.runMode==='daily'?dailyChallenge():null;
        if(challenge)options.standardized=true;
        cup=options.runMode==='cup'?{courses:[],index:0,scores:{},names:{}}:null;
        if(cup){while(cup.courses.length<3){const id=COURSE_IDS[Math.floor(random()*COURSE_IDS.length)];if(!cup.courses.includes(id))cup.courses.push(id);else cup.courses.push(COURSE_IDS.find(k=>!cup.courses.includes(k)));}}
        const course = challenge?.course ?? cup?.courses[0] ?? data.course ?? (['training','tutorial'].includes(options.runMode)?options.course:null) ?? randomCourse(lastCourse, random);
        if (!Object.hasOwn(COURSES, course)) throw Error('Choose a valid course.');
        if (eligible() && onRaceStart) await onRaceStart({course, name: profile.name, upgrades: {...profile.upgrades}});
        return copy(start(course, clamp(Math.trunc(Number(data.color) || 0), 0, 3)));
      }
      case 'sync':
        if (!room || data.token !== token) throw Error('Start a practice race first.');
        if (nextAt !== null && now() >= nextAt) {
          const previous = generation, course = queuedCourse, round = room.round + 1;
          if (eligible() && onRaceStart) await onRaceStart({course, name: profile.name, upgrades: {...profile.upgrades}}, {background: true});
          if (previous !== generation || !room) throw Error('Practice race changed.');
          return copy(start(course, raceColor, round).room);
        }
        return copy(tick(data.input || {}));
      case 'leave': if(room?.phase==='results')bank(); else if(room && !room.training){profile.cash+=room.players[0].raceCash;save();} room = null; nextAt = null; generation++; return {};
      case 'rematch': {
        if (!room || room.phase !== 'results') throw Error('Wait for the race to finish.');
        if(cup && cup.index>=2)throw Error('Cup complete. Return to the playground for a new cup.');
        if(cup)cup.index++;
        const course = cup?cup.courses[cup.index]:data.sameCourse||room.training||challenge?room.course:randomCourse(room.course,random);
        if (eligible() && onRaceStart) await onRaceStart({course, name: profile.name, upgrades: {...profile.upgrades}});
        return copy(start(course, Number(room.players[0].loadout.hat.split('-')[1]) % 4, room.round + 1).room);
      }
      case 'profile/sabotage-buy': {
        const item=SABOTAGE[data.perk];
        if(!Object.hasOwn(SABOTAGE,data.perk)||!item)throw Error('Unknown perk.');
        if(room && room.phase!=='results')throw Error('Buy perks between races.');
        if(profile.sabotage[data.perk]>=99)throw Error('Inventory full.');
        if(profile.cash<item.price)throw Error('Earn more coins first.');
        profile.cash-=item.price;profile.sabotage[data.perk]++;save();return copy({profile});
      }
      case 'sabotage/use': {
        if(!room||data.token!==token)throw Error('Start a practice race first.');
        if(!Object.hasOwn(SABOTAGE,data.perk)||!profile.sabotage[data.perk])throw Error('Buy a charge first.');
        if(options.standardized || room.training)throw Error('Race items are disabled in training and standardized runs.');
        useSabotage(room,data.perk);
        profile.sabotage[data.perk]--;save();return copy({room,profile});
      }
      case 'profile/buy':
      case 'profile/equip': {
        const item = CATALOG.find(i => i.id === data.item);
        if (!item) throw Error('Unknown item.');
        if (!profile.owned.includes(item.id)) {
          if (action === 'profile/equip') throw Error('Buy this item first.');
          if (profile.cash < item.price) throw Error('Earn more cash in practice first.');
          profile.cash -= item.price; profile.owned.push(item.id);
        }
        profile.equipped[item.slot] = item.id; save(); return copy({profile});
      }
      case 'profile/upgrade': {
        const upgrade = UPGRADES[data.upgrade], level = profile.upgrades[data.upgrade];
        if (!upgrade || level >= upgrade.max) throw Error('Upgrade unavailable.');
        if (profile.cash < upgrade.cost(level)) throw Error('Earn more cash in practice first.');
        profile.cash -= upgrade.cost(level); profile.upgrades[data.upgrade]++; save(); return copy({profile});
      }
      default: throw Error(ONLINE_MESSAGE);
    }
  }
  return {request};
}
