'use strict';
const {createRaceServer}=require('./server.js');
const {EnhancedRaceEngine}=require('./gameplay.cjs');
function createEnhancedServer(options={}){
 const engine=options.engine||new EnhancedRaceEngine();
 const {server}=createRaceServer({...options,engine});
 const [handle]=server.listeners('request');server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&['/','/health','/api/health'].includes(route)){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({ok:true,mode:'enhanced-race',rewardsConfigured:!!engine.rewards.sender,pendingRewards:engine.rewards.jobs.size,obstacleCollisions:true,pendingRewardsSurviveRestart:false}));
  }
  return handle(req,res);
 });
 return {server,engine};
}
if(require.main===module){const {server}=createEnhancedServer();server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Enhanced Jester race server listening'));}
module.exports={createEnhancedServer};
