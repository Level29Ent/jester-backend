export const PALETTES=['#8e28bd','#36bd39','#f1bc1b','#e95584','#257abf','#ef7731','#252d42','#f0e9d3','#42bbbd','#bf343e'];
const names=['Royal','Emerald','Gold','Rose','Ocean','Flame','Midnight','Ivory','Mint','Crimson'];
const suits=['Race Jersey','Checkered Suit','Street Stripes','Camo Cargo'];
const hats=['Jester','Champion Crown','Street Cap','Top Hat','Halo'];
const shoes=['Track Sneakers','High Tops','Gold Sole','Trail Boots','Speed Runners'];
const packs=['Daypack','Rocket Pack','Boom Box','Crown Pack'];
export const CATALOG=[
 ...Array.from({length:40},(_,i)=>({id:`outfit-${i}`,slot:'outfit',index:i,name:`${names[i%10]} ${suits[Math.floor(i/10)]}`,price:i===0?0:80+Math.floor(i/10)*55+(i%10)*5,color:PALETTES[i%10],variant:Math.floor(i/10)})),
 ...Array.from({length:20},(_,i)=>({id:`hat-${i}`,slot:'hat',index:i,name:`${names[i%4]} ${hats[Math.floor(i/4)]}`,price:i===0?0:110+Math.floor(i/4)*35+(i%4)*10,color:PALETTES[i%4],variant:Math.floor(i/4)})),
 ...Array.from({length:20},(_,i)=>({id:`shoes-${i}`,slot:'shoes',index:i,name:`${names[i%4]} ${shoes[Math.floor(i/4)]}`,price:i===0?0:90+Math.floor(i/4)*30+(i%4)*10,color:PALETTES[i%4],variant:Math.floor(i/4)})),
 ...Array.from({length:20},(_,i)=>({id:`pack-${i}`,slot:'pack',index:i,name:`${names[i%5]} ${packs[Math.floor(i/5)]}`,price:i===0?0:130+Math.floor(i/5)*50+(i%5)*10,color:PALETTES[i%5],variant:Math.floor(i/5)}))
];
export const UPGRADES={
 speed:{name:'Fleet Feet',description:'2% more running speed per level.',max:3,cost:level=>180+level*140},
 jump:{name:'Spring Step',description:'2% more jump power per level.',max:3,cost:level=>160+level*130},
 dash:{name:'Quick Recharge',description:'Dash cooldown drops by 0.15s per level.',max:3,cost:level=>200+level*150},
 magnet:{name:'Coin Magnet',description:'Collect coins from farther away.',max:3,cost:level=>140+level*110}
};
export const starterLoadout={outfit:'outfit-0',hat:'hat-0',shoes:'shoes-0',pack:'pack-0'};
export function item(id){return CATALOG.find(v=>v.id===id)||CATALOG[0]}
