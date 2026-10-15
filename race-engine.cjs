'use strict';
const { randomBytes } = require('node:crypto');
const tracks = {
  sky: { finish: 104, width: 8, segments: [[-8,34],[38,70],[74,113]], checkpoints: [43,80] },
  sunset: { finish: 118, width: 7, segments: [[-8,29],[33,61],[65,88],[92,127]], checkpoints: [39,73,99] },
  carnival: { finish: 126, width: 6.5, segments: [[-8,36],[40,76],[80,135]], checkpoints: [47,90] }
};
const id = () => randomBytes(16).toString('hex');
const axis = n => Number.isFinite(n) ? Math.max(-1, Math.min(1,n)) : 0;
class RaceEngine {
  constructor() { this.rooms = new Map(); this.sessions = new Map(); }
  enter(user, options = {}) {
    if (!user || typeof user.id !== 'string') throw Error('Verified player required');
    const mode = options.mode;
    if (!['public','create','join','quick'].includes(mode)) throw Error('Invalid mode');
    if (this.sessions.size >= 500) throw Error('Server full');
    if ([...this.sessions.values()].some(s => s.user === user.id)) throw Error('Player already in a room');
    let room;
    if (mode === 'join') {
      room = this.rooms.get(String(options.code || '').toUpperCase());
      if (!room || room.phase !== 'waiting' || room.players.length >= 12) throw Error('Room unavailable');
    } else {
      if (!Object.hasOwn(tracks, options.course)) throw Error('Invalid course');
      if (mode === 'public') room = [...this.rooms.values()].find(r => r.kind === 'public' && r.course === options.course && r.phase === 'waiting' && r.players.length < 12);
      if (!room) {
        if (this.rooms.size >= 100) throw Error('Server full');
        let code; do { code = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(code));
        room = { code, course: options.course, kind: mode === 'public' ? 'public' : 'private', phase: 'waiting', round: 1, time: 0, count: 0, host: null, fillBots: mode === 'quick' || (mode === 'create' && options.fillBots === true), players: [] };
        this.rooms.set(code,room);
      }
    }
    const token = id();
    const player = this.player(user,room.players.length);
    room.players.push(player); room.host ||= player.id;
    this.sessions.set(token,{ user: user.id, room, player, idle: 0 });
    if (mode === 'quick') this.start(token);
    return { token, id: player.id, room: this.view(room) };
  }
  player(user,index) {
    return { id: user.id, name: String(user.name || 'Player 29').slice(0,24), bot: false,
      x: (index % 6 - 2.5)*1.2, y: 0, z: -Math.floor(index/6)*2,
      vx:0,vy:0,vz:0,cp:0,falls:0,cd:0,boost:0,stun:0,dashing:0,event:0,
      rank:0,finishTime:0,raceCash:0,reward:0,coinIds:[],
      loadout: {...user.equipped}, upgrades: {speed:0,jump:0,dash:0,magnet:0}, input: {} };
  }
  session(token) { const s = this.sessions.get(token); if (!s) throw Error('Race session expired'); return s; }
  start(token) {
    const {room,player} = this.session(token);
    if (room.host !== player.id) throw Error('Only host can start');
    if (room.phase !== 'waiting') throw Error('Race already started');
    if (!room.fillBots && room.players.length < 2) throw Error('Two players required');
    if (room.fillBots) while (room.players.length < 6) {
      const bot = this.player({id: id(),name: 'BOT '+room.players.length,equipped: player.loadout},room.players.length);
      bot.bot = true; room.players.push(bot);
    }
    room.phase = 'countdown'; room.count = 3; room.time = 0;
    return this.view(room);
  }
  sync(token,input = {}) {
    const s = this.session(token); s.idle = 0;
    s.player.input = { x:axis(input.x), z:axis(input.z), jump:input.jump === true, dash:input.dash === true };
    return this.view(s.room);
  }
  leave(token) {
    const s = this.session(token); this.sessions.delete(token);
    s.room.players = s.room.players.filter(p => p !== s.player);
    if (s.room.host === s.player.id) s.room.host = s.room.players.find(p => !p.bot)?.id || null;
    if (!s.room.host) this.rooms.delete(s.room.code);
  }
  tick(dt = 1/30) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw Error('Invalid timestep');
    for (const [token,s] of this.sessions) { s.idle += dt; if (s.idle > 30) this.leave(token); }
    for (const room of this.rooms.values()) {
      const humans = room.players.filter(p => !p.bot).length;
      if (room.phase === 'waiting') {
        if (room.kind === 'public' && humans >= 2) { room.phase = 'countdown'; room.count = 3; }
        continue;
      }
      if (room.phase === 'countdown') { room.count -= dt; if (room.count <= 0) { room.phase = 'racing'; room.count = 0; } continue; }
      if (room.phase !== 'racing') continue;
      room.time += dt;
      const track = tracks[room.course];
      for (const p of room.players) {
        if (p.rank) continue;
        const grounded = p.y === 0 && track.segments.some(([a,b]) => p.z >= a && p.z <= b) && Math.abs(p.x) <= track.width;
        const gap = track.segments.slice(0,-1).some(([,b]) => p.z > b-1.7 && p.z < b);
        const input = p.bot ? {x:axis(-p.x),z:1,jump:gap,dash:false} : p.input;
        p.cd = Math.max(0,p.cd-dt); p.dashing = Math.max(0,p.dashing-dt);
        if (grounded && input.jump) p.vy = 9;
        if (input.dash && p.cd === 0) { p.dashing = .25; p.cd = 2.8; }
        const length = Math.max(1,Math.hypot(input.x || 0,input.z || 0));
        const speed = p.dashing ? 17 : 7;
        p.vx = (input.x || 0)/length*speed; p.vz = (input.z || 0)/length*speed;
        p.x += p.vx*dt; p.z += p.vz*dt;
        p.vy -= 22*dt; p.y += p.vy*dt;
        const floor = Math.abs(p.x) <= track.width && track.segments.some(([a,b]) => p.z >= a && p.z <= b);
        if (floor && p.y <= 0 && p.y > -1 && p.vy <= 0) { p.y = 0; p.vy = 0; }
        if (floor && p.y === 0) p.cp = track.checkpoints.filter(z => p.z >= z).length;
        if (p.y < -10) { p.x=0; p.z=p.cp ? track.checkpoints[p.cp-1] : 0; p.y=0; p.vy=0; p.falls++; }
        if (p.z >= track.finish && p.y >= 0) { p.rank=room.players.filter(q => q.rank).length+1; p.finishTime=room.time; }
      }
      if (room.time >= 90 || room.players.every(p => p.rank)) room.phase='results';
    }
  }
  view(room) {
    return { ...room, humanCount:room.players.filter(p => !p.bot).length, autoStart:room.count,
      players:room.players.map(({input,...p}) => ({...p,coinIds:[...p.coinIds],loadout:{...p.loadout},upgrades:{...p.upgrades}})) };
  }
}
module.exports = { RaceEngine };
