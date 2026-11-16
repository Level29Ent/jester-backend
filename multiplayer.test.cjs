'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {createEnhancedServer}=require('./game-server.cjs');
test('deployed entry serves the current shared protocol and all 20 courses',async()=>{
 const {server}=await createEnhancedServer({autoTick:false,allowedOrigins:['https://game.test']});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/health',{headers:{Origin:'https://game.test'}});const health=await r.json();
 assert.equal(r.status,200);assert.match(health.protocol,/jester-network-1:smooth-v2:/);assert.equal(health.courses.length,20);assert.equal(health.raceLimit,120);assert.equal(health.rewards,false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('exported source hashes exactly match the frontend runtime snapshot',()=>{
 const source=JSON.parse(readFileSync('runtime/SOURCE.json','utf8'));assert.match(source.commit,/^[a-f0-9]{40}$/);
 for(const [name,hash]of Object.entries(source.hashes))assert.equal(createHash('sha256').update(readFileSync('runtime/'+name)).digest('hex'),hash,name);
});
