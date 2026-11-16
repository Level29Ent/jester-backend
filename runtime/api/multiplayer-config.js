export function publicMultiplayerConfig(env=process.env){
  try{const url=new URL(env.JESTER_RACE_SERVER_URL);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();
    return {enabled:true,url:url.origin};
  }catch{return {enabled:false};}
}
export default function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});return res.status(200).json(publicMultiplayerConfig());}
