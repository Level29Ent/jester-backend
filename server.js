'use strict';
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { RaceEngine } = require('./race-engine.cjs');
const SUPABASE_URL = 'https://rubtdmmdxjvforydjjcn.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ReLhNtOihv4AXPUXmqmw2g_FHiB_gmQ';

async function authenticate(req) {
  const bearer = req.headers.authorization || '';
  if (!/^Bearer [^\s]+$/.test(bearer) || bearer.length > 8192) throw Error('Sign in required');
  const headers = { apikey: PUBLISHABLE_KEY, Authorization: bearer };
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', { headers, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Player sign-in expired');
  const user = await response.json();
  if (typeof user.id !== 'string') throw Error('Invalid player');
  const url = new URL(SUPABASE_URL + '/rest/v1/player_profiles');
  url.searchParams.set('id', 'eq.' + user.id);
  url.searchParams.set('select', 'id,name,equipped');
  const saved = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  if (!saved.ok) throw Error('Profile could not be loaded');
  const rows = await saved.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== user.id) throw Error('Profile missing');
  const profile = rows[0];
  const equipped = {};
  for (const slot of ['outfit','hat','shoes','pack']) {
    const value = profile.equipped?.[slot];
    equipped[slot] = typeof value === 'string' && new RegExp('^' + slot + '-[0-9]+$').test(value) ? value : slot + '-0';
  }
  return { id:user.id, name:profile.name, equipped };
}
async function readBody(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw Error('Request too large');
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Invalid request');
  if (body.input !== undefined && (!body.input || typeof body.input !== 'object' || Array.isArray(body.input))) throw Error('Invalid input');
  return body;
}
function createRaceServer(options = {}) {
  const engine = options.engine || new RaceEngine();
  const verify = options.authenticate || authenticate;
  const origins = new Set(options.allowedOrigins || (process.env.ALLOWED_ORIGINS || 'https://level-29-jester-rush-2.vercel.app').split(',').map(s => s.trim()).filter(Boolean));
  const rates = new Map();
  const server = http.createServer(async (req,res) => {
    const send = (status,data) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(data));
    };
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Vary','Origin');
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return send(403,{error:'Origin not allowed'});
    if (origin) res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const now = Date.now(), address = req.socket.remoteAddress || 'unknown';
    if (!rates.has(address) && rates.size >= 1000) return send(503,{error:'Server busy'});
    let rate = rates.get(address);
    if (!rate || now-rate.start >= 1000) { rate={start:now,count:0}; rates.set(address,rate); }
    if (++rate.count > 300) return send(429,{error:'Too many requests'});
    const route = new URL(req.url,'http://localhost').pathname;
    if (req.method === 'GET' && ['/','/health','/api/health'].includes(route)) return send(200,{ok:true,mode:'race-prototype',persistence:false,rewards:false,obstacleCollisions:false});
    if (req.method === 'GET' && route === '/api/rooms') return send(200,[...engine.rooms.values()].filter(r => r.kind === 'public' && r.phase === 'waiting' && r.players.length < 12).map(r => ({code:r.code,course:r.course,players:r.players.length,capacity:12})));
    if (req.method !== 'POST') return send(404,{error:'Endpoint not found'});
    if (!['/api/enter','/api/start','/api/sync','/api/leave','/api/rematch'].includes(route)) return send(404,{error:'Endpoint not found'});
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(415,{error:'Send JSON'});
    let body;
    try { body = await readBody(req); } catch { return send(400,{error:'Invalid or oversized JSON request'}); }
    if (route === '/api/enter') {
      let user;
      try { user = await verify(req); } catch { return send(401,{error:'Sign-in or profile verification failed'}); }
      try { return send(200,engine.enter(user,body)); } catch(error) { return send(400,{error:error.message}); }
    }
    if (typeof body.token !== 'string' || !/^[a-f0-9]{32}$/.test(body.token)) return send(401,{error:'Invalid race session'});
    try { engine.session(body.token); } catch { return send(401,{error:'Race session expired'}); }
    try {
      if (route === '/api/start') return send(200,engine.start(body.token));
      if (route === '/api/sync') return send(200,engine.sync(body.token,body.input));
      if (route === '/api/leave') { engine.leave(body.token); return send(200,{ok:true}); }
      return send(501,{error:'Rematches are not implemented yet. Leave and create a new room.'});
    } catch(error) { return send(400,{error:error.message}); }
  });
  server.requestTimeout=10000; server.headersTimeout=10000; server.maxRequestsPerSocket=1000;
  server.on('upgrade',(_req,socket) => socket.end('HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n'));
  let previous=performance.now(), elapsed=0;
  const timer=setInterval(()=>{
    const now=performance.now(); elapsed+=Math.min(.2,(now-previous)/1000); previous=now;
    while(elapsed>=1/30){engine.tick(1/30);elapsed-=1/30;}
    for(const [key,value] of rates) if(Date.now()-value.start>60000) rates.delete(key);
  },1000/30);
  timer.unref(); server.on('close',()=>clearInterval(timer));
  return {server,engine};
}
if(require.main === module){
  const {server}=createRaceServer();
  server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Jester race prototype listening'));
}
module.exports={createRaceServer};
