'use strict';
// Deploy the same authoritative 20-course simulation used by the current game.
// Legacy engines remain for reference/tests, but are not the production entry.
async function createEnhancedServer(options={}) {
  const {createMultiplayerServer}=await import('./runtime/server/multiplayer.js');
  return createMultiplayerServer(options);
}
if(require.main===module){
  createEnhancedServer().then(({server})=>server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Jester Rush multiplayer listening'))).catch(()=>{console.error('Multiplayer startup failed');process.exitCode=1;});
}
module.exports={createEnhancedServer};
