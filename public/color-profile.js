import {showFrameAt} from './show-plan.js';
const cache=new WeakMap();
const distance=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
const hue=([r,g,b])=>{const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;return !d?-1:((max===r?(g-b)/d:max===g?2+(b-r)/d:4+(r-g)/d)+6)%6;};
// A time-weighted summary, not a timeline: each visible sampled interval has one vote.
export function colorProfile(plan){
 if(!plan?.frames?.length||!Number.isFinite(plan.duration)||plan.duration<=0||!Number.isFinite(plan.step)||plan.step<=0)return null;
 if(cache.has(plan))return cache.get(plan);
 const bins=new Map();let total=0;
 // At most 7200 samples, including bounded work for imported older plans.
 const step=Math.max(plan.step,plan.duration/7200);
 for(let t=0;t<plan.duration;t+=step){
  const frame=showFrameAt(plan,t);
  if(!frame||frame.state===false||!(frame.dimming>0))continue;
  const rgb=[frame.r,frame.g,frame.b];
  if(!rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=255)||Math.max(...rgb)===0)continue;
  const weight=Math.min(step,plan.duration-t),key=rgb.map(v=>Math.floor(v/32)).join(':');
  let bin=bins.get(key);if(!bin){bin={sum:[0,0,0],weight:0};bins.set(key,bin);}
  bin.weight+=weight;rgb.forEach((v,i)=>bin.sum[i]+=v*weight);total+=weight;
 }
 if(!total){cache.set(plan,null);return null;}
 // Keep work bounded even with continuously changing colors: 8^3 bins at most.
 let groups=[...bins.values()].map(b=>({rgb:b.sum.map(v=>v/b.weight),weight:b.weight}));
 // Merge least represented colors into their nearest neighbor, preserving all time shares.
 groups.sort((a,b)=>b.weight-a.weight);
 while(groups.length>6){
  const small=groups.pop();let closest=0;
  for(let i=1;i<groups.length;i++)if(distance(small.rgb,groups[i].rgb)<distance(small.rgb,groups[closest].rgb))closest=i;
  const target=groups[closest],weight=target.weight+small.weight;
  target.rgb=target.rgb.map((v,i)=>(v*target.weight+small.rgb[i]*small.weight)/weight);target.weight=weight;
  groups.sort((a,b)=>b.weight-a.weight);
 }
 groups.sort((a,b)=>hue(a.rgb)-hue(b.rgb));
 let position=0;
 const colors=groups.map(g=>{const start=position;position+=g.weight/total*100;return {rgb:g.rgb.map(Math.round),share:g.weight/total,start,end:position};});
 // Small transitions retain the proportional area while reading as one continuous gradient.
 const stops=colors.flatMap((c,i)=>{
  const inset=Math.min(.8,(c.end-c.start)/4),color=`rgb(${c.rgb.join(', ')})`;
  return [`${color} ${(i?c.start+inset:0).toFixed(3)}%`,`${color} ${(i===colors.length-1?100:c.end-inset).toFixed(3)}%`];
 });
 const result={colors,gradient:`linear-gradient(110deg, ${stops.join(', ')})`};cache.set(plan,result);return result;
}
