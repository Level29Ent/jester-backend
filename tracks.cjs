const COLORS=['#9428c5','#36bf36','#f6bc18','#e95183'];
const COURSES={
 sky:{name:'Skyline Shuffle',sky:'#d7eafa',track:'#aee966',side:'#843ab8',accent:'#ffc928',speed:1,width:8,finish:104,segments:[[-8,34],[38,70],[74,113]],checkpoints:[43,80],spinners:[{z:23,rate:.95},{z:57,rate:-1.1},{z:92,rate:1.2}],bumpers:[{x:-4,z:13},{x:3,z:16},{x:4,z:46},{x:-3,z:50},{x:0,z:83},{x:4,z:86}],boosts:[{x:0,z:8},{x:-4,z:46},{x:3,z:81}],walls:[{z:63,rate:1.2,range:4.5}]},
 sunset:{name:'Golden Hour',sky:'#f6ddc5',track:'#ffcc55',side:'#ba5d8b',accent:'#6ace83',speed:1.13,width:7,finish:118,segments:[[-8,29],[33,61],[65,88],[92,127]],checkpoints:[39,73,99],spinners:[{z:19,rate:1.15},{z:51,rate:-1.05},{z:80,rate:1.3},{z:108,rate:-1.25}],bumpers:[{x:3,z:10},{x:-3,z:43},{x:4,z:70},{x:0,z:101}],boosts:[{x:-3,z:7},{x:3,z:38},{x:-3,z:71},{x:4,z:98}],walls:[{z:57,rate:1.3,range:4},{z:112,rate:-1.1,range:4}]},
 carnival:{name:'Jester Carnival',sky:'#e7daf8',track:'#82d7ad',side:'#982bc0',accent:'#ffd42b',speed:1.08,width:6.5,finish:126,segments:[[-8,36],[40,76],[80,135]],checkpoints:[47,90],spinners:[{z:23,rate:-1.1},{z:64,rate:1.2},{z:103,rate:-1.4}],bumpers:[{x:-3,z:14},{x:3,z:18},{x:0,z:53},{x:-3,z:86},{x:3,z:96}],boosts:[{x:0,z:8},{x:3,z:44},{x:-3,z:83},{x:0,z:115}],walls:[{z:32,rate:1.1,range:3.8},{z:71,rate:1.4,range:3.5},{z:117,rate:-1.2,range:3.8}]}
};
function spinnerAngle(o,t,course){return t*o.rate*COURSES[course].speed;}
function wallX(o,t){return Math.sin(t*o.rate)*o.range;}
function gaps(course){const s=COURSES[course].segments;return s.slice(0,-1).map(([a,b],i)=>[b,s[i+1][0]])}
function coinPositions(course){const c=COURSES[course],list=[];let id=0;for(const[a,b]of c.segments){for(let z=Math.max(5,a+4);z<Math.min(b-3,c.finish-2);z+=6){list.push({id:id++,x:[0,-3,3][id%3],y:1.1,z})}}return list}
// Default-map aliases retained for testing integrations.
const SEGMENTS=COURSES.sky.segments,FINISH=COURSES.sky.finish,CHECKPOINTS=COURSES.sky.checkpoints,SPINNERS=COURSES.sky.spinners,BUMPERS=COURSES.sky.bumpers;

module.exports={COURSES,coinPositions};
