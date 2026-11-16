// Static hosts have no Vercel Functions. A build-time public-only JSON document
// provides the same explicit configuration, never privileged credentials.
export async function loadPublicConfig(kind,{fetcher=fetch}={}){
  const path=kind==='auth'?'/api/auth-config':'/api/multiplayer-config';
  try{const r=await fetcher(path,{signal:AbortSignal.timeout(7000)});if(r.ok){const config=await r.json();if(typeof config?.enabled==='boolean')return config;}}catch{}
  const response=await fetcher('/online-config.json',{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('Public configuration unavailable.');
  const config=(await response.json())[kind];if(typeof config?.enabled!=='boolean')throw Error('Invalid public configuration.');return config;
}
