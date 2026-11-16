import {loadPublicConfig} from './public-config.js';
import {NETWORK_PROTOCOL} from './multiplayer-protocol.js';
export {NETWORK_PROTOCOL} from './multiplayer-protocol.js';
import {COURSE_IDS,RACE_LIMIT} from './course.js';
export async function createMultiplayerClient({auth,fetcher=fetch}={}){
  const config=await loadPublicConfig('multiplayer',{fetcher});
  if(!config.enabled)throw Error('Online racing is not configured yet. Solo play is ready.');
  let url;try{url=new URL(config.url);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();}catch{throw Error('Invalid race server configuration.');}
  const response=await fetcher(url.origin+'/api/health',{signal:AbortSignal.timeout(7000)});
  const health=response.ok?await response.json():null;
  if(health?.protocol!==NETWORK_PROTOCOL||health.raceLimit!==RACE_LIMIT||!Array.isArray(health.courses)||COURSE_IDS.some(id=>!health.courses.includes(id)))throw Error('The race server needs an update before this game can connect.');
  return {async request(action,data={}){
    if(!['enter','sync','start','leave','rematch','rooms','vote'].includes(action))throw Error('Unsupported online action.');
    const {data:session,error}=await auth.getSession();
    if(error||!session.session?.access_token)throw Error('Sign in with your email before playing online.');
    const result=await fetcher(`${url.origin}/api/${action}`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session.access_token}`},
      body:JSON.stringify({...data,protocol:NETWORK_PROTOCOL}),signal:AbortSignal.timeout(7000)});
    let body;try{body=await result.json();}catch{throw Error('Race server returned an invalid response.');}
    if(!result.ok){const e=Error(body.error||'Online race request failed.');e.status=result.status;throw e;}return body;
  }};
}
export async function mountMultiplayer(auth,{fetcher=fetch,doc=document,scope=globalThis}={}){
  const note=doc.getElementById('online-note');
  try{const service=await createMultiplayerClient({auth,fetcher});scope.jesterOnline=service;
    for(const id of ['online-btn','create-btn','join-btn','browse-btn'])doc.getElementById(id).disabled=false;
    doc.getElementById('online-btn').textContent='PLAY ONLINE ↗';
    note.textContent='Sign in to race real players. Public matchmaking needs 2 racers; private rooms use a code. No bots, upgrades or saved online rewards.';
    doc.getElementById('fill-bots').checked=false;doc.getElementById('fill-bots').disabled=true;
    doc.getElementById('lobby-mode').textContent='SOLO BOTS + ONLINE ROOMS';
  }catch(error){note.textContent=error.message;}
}
