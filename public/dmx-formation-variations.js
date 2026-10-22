const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const fract=v=>v-Math.floor(v);

// A shared, slowly changing expression track carries the actual audio contour
// through visual sentence boundaries. It is compiled once, not per fixture.
export function formationExpressionTrack(plan,start,end,fallback){
 const source=plan.arrangement?.motionEnvelope;
 if(!source?.length)return null;
 const drama=plan.arrangement.drama,step=.25,track=[];
 let at=0;
 for(let time=start;time<end+step*.5;time+=step){
  const t=Math.min(time,end);
  while(at+1<source.length&&source[at+1].time<=t)at++;
  let weight=0,energy=0,tone=0,percussion=0,voice=0;
  for(let i=Math.max(0,at-3);i<Math.min(source.length,at+4);i++){
   const e=source[i],w=Math.max(0,1-Math.abs(e.time-t)/.85);
   if(!w)continue;
   const j=Math.max(0,Math.min((drama?.intensity?.length??1)-1,Math.floor(e.time/(drama?.step||1))));
   weight+=w;energy+=(Number.isFinite(e.energy)?e.energy:fallback[0])*w;tone+=(Number.isFinite(e.tone)?e.tone:fallback[3])*w;
   percussion+=(drama?.percussion?.[j]??fallback[1])*w;voice+=(drama?.vocalShare?.[j]??fallback[2])*w;
  }
  track.push({time:t,energy:clamp(weight?energy/weight:fallback[0]),tone:clamp(weight?tone/weight:fallback[3]),
   percussion:clamp(weight?percussion/weight:fallback[1]),voice:clamp(weight?voice/weight:fallback[2])});
 }
 if(track.at(-1).time<end)track.push({...track.at(-1),time:end});
 return track;
}

export function formationExpressionAt(track,time){
 if(!track?.length)return null;
 let lo=0,hi=track.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(track[mid].time<=time)lo=mid;else hi=mid;}
 const a=track[lo],b=track[hi],p=clamp((time-a.time)/Math.max(.001,b.time-a.time));
 const mix=key=>a[key]+(b[key]-a[key])*p;
 return {energy:mix('energy'),tone:mix('tone'),percussion:mix('percussion'),voice:mix('voice')};
}

export const FORMATION_PATHS=Object.freeze(['traverse','radial','depth','diagonal','serpentine','split','zigzag','chevron']);
export const FORMATION_GESTURES=Object.freeze(['carry','sweep','scissor','orbit','ribbon','hinge','rise','mirror-orbit']);
export const FORMATION_ARTICULATIONS=Object.freeze(['stroke','echo','counterflow','reveal']);
export const FORMATION_GESTURE_NAMES=Object.freeze({carry:'Lichtübergabe',sweep:'Schwenkende Ebenen',scissor:'Scherenbewegung',
 orbit:'Kreisbahnen',ribbon:'Wandernde Bänder',hinge:'Klappende Fächer',rise:'Aufsteigende Bögen','mirror-orbit':'Gespiegelte Kreisbahnen'});

const preferences={relay:['sweep','scissor','hinge','carry'],dialogue:['carry','rise','mirror-orbit','ribbon'],
 weave:['orbit','ribbon','mirror-orbit','scissor'],suspend:['rise','orbit','carry'],bloom:['rise','hinge','ribbon','scissor'],gather:['hinge','rise','scissor']};

// Compose dimensions of a musical gesture, not a shuffled list of complete
// presets. Recent use matters across passages and returning motifs as well.
export function chooseFormationVariation({motion,act,energy,tone,voice,history,ordinal,previous}){
 const quiet=motion==='suspend',global=motion==='bloom'||motion==='gather';
 const paths=act==='answer'&&previous?[previous.path]:quiet||global?['radial']:FORMATION_PATHS;
 const gestures=quiet||global?preferences[motion]:FORMATION_GESTURES;
 const articulations=quiet||global||act==='answer'?['stroke']:act==='resolve'?['reveal','stroke']
  :motion==='weave'||act==='interlace'?['stroke','echo','reveal']:FORMATION_ARTICULATIONS;
 const recent=history.slice(-48),preferred=preferences[motion]??['carry'];
 let best,bestCost=Infinity;
 for(const path of paths)for(const gesture of gestures)for(const articulation of articulations){
  const key=`${path}/${gesture}/${articulation}`;
  let cost=preferred.includes(gesture)?0:1.3;
  if(articulation==='counterflow')cost+=voice>.55?.6:energy<.5?1:0;
  if(articulation==='echo')cost+=energy<.45?1.2:0;
  if(path==='serpentine')cost+=voice>.55?1:0;
  if(path==='diagonal'||path==='chevron')cost+=Math.abs(tone-.65)*.4;
  recent.forEach((r,i)=>{
   const weight=(i+1)/recent.length;
   cost+=(r.key===key?12:0)*weight;
   cost+=((r.gesture===gesture?.35:0)+(r.path===path&&act!=='answer'?.25:0))*weight;
   if(i>=recent.length-4)cost+=((r.gesture===gesture?2:0)+(r.path===path&&act!=='answer'?1.5:0))*weight;
  });
  if(cost<bestCost){bestCost=cost;best={path,gesture,articulation,key};}
 }
 if(!history.length&&!quiet&&!global&&motion!=='rest')best={path:'traverse',gesture:'carry',articulation:'stroke',key:'traverse/carry/stroke'};
 const spread=.72+.28*fract((ordinal+1)*.61803398875+tone*.37);
 return {...best,spread,amplitude:(quiet?.035:.07+.08*energy)*spread,
  phaseSpan:quiet||global?.5:act==='interlace'?1.25:energy>.75?1:.5};
}

export function formationRadialPosition(rank,count){
 if(count<3)return 0;
 const minimum=count%2?0:1/(count-1);
 return Math.max(0,(Math.abs(rank/(count-1)*2-1)-minimum)/(1-minimum));
}

const profiles=new Map();
export function formationRoute(path,rank,count,row,groups,reversed=false){
 if((path==='radial'||path==='chevron')&&count===2)path='traverse';
 const key=`${path}:${count}:${groups}`;
 let profile=profiles.get(key);
 if(!profile){
  const routes=[];
  for(let j=0;j<groups;j++)for(let i=0;i<count;i++){
   const u=count>1?i/(count-1):0,z=groups>1?j/(groups-1):0;
   const radial=formationRadialPosition(i,count);
   let value=u+z*.45;
   if(path==='radial')value=radial+z*.45;
   if(path==='depth')value=z+u*.45;
   if(path==='diagonal')value=u+(1-z)*.7;
   if(path==='serpentine')value=j+(j%2?1-u:u);
   if(path==='split')value=(j%2?1-u:u)+z*.3;
   if(path==='zigzag')value=(i%2?Math.ceil(count/2)+Math.floor(i/2):Math.floor(i/2))+z*.45;
   if(path==='chevron')value=radial+(1-z)*.7;
   routes.push(value);
  }
  const ordered=[...routes].sort((a,b)=>a-b),low=ordered[0],span=ordered.at(-1)-low;
  const normalized=routes.map(v=>span>0?(v-low)/span:.5);
  const sorted=[...normalized].sort((a,b)=>a-b);let gap=0;
  for(let i=1;i<sorted.length;i++)gap=Math.max(gap,sorted[i]-sorted[i-1]);
  profile={routes:normalized,gap};
  if(profiles.size>=128)profiles.clear();profiles.set(key,profile);
 }
 const position=profile.routes[row*count+rank];
 return {position:reversed?1-position:position,gap:profile.gap};
}

export function varyFormationPose(pose,variation,phase,rank,count,row,groups){
 if(!variation||variation.gesture==='carry')return pose;
 const r=count>1?rank/(count-1)*2-1:0,side=Math.sign(r),z=row/Math.max(1,groups-1);
 const a=variation.amplitude,s=Math.sin(phase*Math.PI*2),c=Math.cos(phase*Math.PI*2);
 let {x,y}=pose;
 switch(variation.gesture){
  case 'sweep':x+=a*s;y+=a*.7*Math.sin(phase*Math.PI);break;
  case 'scissor':x+=side*a*s;y+=(z-.5)*a*c;break;
  case 'orbit':x+=a*s;y+=a*.8*c;break;
  case 'ribbon':x+=a*.6*Math.sin(phase*Math.PI*2+z*Math.PI);y+=a*Math.sin(r*Math.PI-phase*Math.PI*2);break;
  case 'hinge':x=.5+(x-.5)*(1-a*(1-c));y+=side*a*.7*s;break;
  case 'rise':y+=a*Math.sin(phase*Math.PI);x+=(x-.5)*a*s;break;
  case 'mirror-orbit':x+=side*a*s;y+=a*.8*Math.cos(phase*Math.PI*2+z*Math.PI);break;
 }
 return {...pose,x:clamp(x),y:clamp(y)};
}
