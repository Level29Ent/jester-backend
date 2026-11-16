// Deterministic recovery changes input decisions only: never position, rank or stats.
export function recoverBot(p,dt,width){
 if(!p.bot||p.rank)return null;
 if(!p.recovery)p.recovery={anchor:p.z,elapsed:0,attempt:0,remaining:0};
 const r=p.recovery;
 if(p.z>r.anchor+1.5){r.anchor=p.z;r.elapsed=0;r.attempt=0;r.remaining=0;}
 else if(p.stun<=0&&p.y>=.9)r.elapsed+=dt;
 if(r.elapsed>=2.2&&r.remaining<=0){r.attempt++;r.remaining=.8;r.elapsed=0;}
 if(r.remaining<=0)return null;
 r.remaining=Math.max(0,r.remaining-dt);
 const side=r.attempt%2?1:-1,target=Math.max(-width+1.5,Math.min(width-1.5,side*2.8));
 return {x:Math.max(-1,Math.min(1,(target-p.x)*1.1)),z:1,jump:p.y<=1.05&&r.remaining>.65,dash:p.cd===0&&r.remaining<.6};
}
export function checkpointTarget(course,cp){return course.checkpoints[Math.max(0,cp)]??course.finish;}
export function feedbackEvent(previous,p){
 if(!previous||p.falls>previous.falls)return null;
 if(p.cp>previous.cp)return 'CHECKPOINT SAVED';
 if(p.y<=1.05&&p.vy<=0&&previous.y>1.15)return 'LANDED';
 if(p.vy>0&&previous.vy<=0&&p.y>1.05)return 'JUMP';
 return null;
}
