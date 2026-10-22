// Spatial constructions, not colour/speed presets. Every ID combines an
// explicit beam arrangement with a contour; section matching owns selection.
const clamp=v=>Math.max(0,Math.min(1,v));
export const CATALOG_CONTOURS=Object.freeze([
 ['level','Horizont',r=>0,'angular'],
 ['diagonal','Diagonale',r=>r,'angular'],
 ['arch','Parabel',r=>1-2*r*r,'curved'],
 ['valley','Mulde',r=>2*r*r-1,'curved'],
 ['chevron','Winkel',r=>1-2*Math.abs(r),'angular'],
 ['crown','Krone',r=>2*Math.abs(r)-1,'angular'],
 ['sine','Sinus',r=>Math.sin(r*Math.PI),'wave'],
 ['double-wave','Doppelwelle',r=>Math.sin(r*Math.PI*2),'wave'],
 ['cosine','Wellenkamm',r=>Math.cos(r*Math.PI*2),'wave'],
 ['scallop','Muschel',r=>2*Math.abs(Math.sin(r*Math.PI*2))-1,'curved'],
 ['serpentine','Serpentine',r=>(Math.sin(r*Math.PI)+.35*Math.sin(r*Math.PI*3))/1.35,'wave'],
 ['lens','Linse',r=>2*Math.sqrt(Math.max(0,1-r*r))-1,'curved'],
 ['ogive','Spitzbogen',r=>2*(1-Math.abs(r))**.55-1,'curved'],
 ['teeth','Zacken',r=>1-4*Math.abs((((r+1)*1.5)%1)-.5),'angular'],
 ['stairs','Treppe',r=>Math.min(3,Math.floor((r+1)*2))/1.5-1,'stepped'],
 ['split','Zwei Ebenen',r=>r<0?-.65:.65,'stepped'],
 ['terraced-arch','Stufenbogen',r=>Math.floor((1-r*r)*3.99)/1.5-1,'stepped'],
 ['cubic','S-Kurve',r=>r*r*r,'curved'],
 ['fold','Faltlinie',r=>Math.abs(r)<.5?1-4*Math.abs(r):4*Math.abs(r)-3,'angular'],
 ['shoulders','Schultern',r=>Math.cos(r*Math.PI)+.3*Math.cos(r*Math.PI*3),'curved']
].map(([id,name,profile,character],i)=>Object.freeze({id,name,profile,character,
 density:[.1,.2,.3,.3,.4,.45,.4,.85,.75,.8,.7,.25,.35,1,.6,.15,.55,.35,.7,.5][i],
 tone:[.2,.45,.5,.25,.4,.65,.45,.6,.5,.75,.65,.55,.6,.8,.35,.2,.45,.3,.5,.7][i]})));
export const CATALOG_STRUCTURES=Object.freeze([
 ['span','Breites Band','rows','relay',.65],['cross','Kreuzband','rows','weave',.75],
 ['twins','Doppelflügel','banks','dialogue',.65],['triptych','Triptychon','banks','dialogue',.7],
 ['quarters','Vier Portale','banks','relay',.85],['folded','Faltebenen','rows','weave',.7],
 ['radial','Radialkranz','banks','weave',.65],['spiral','Spiralband','banks','weave',.6],
 ['diamond-frame','Diamantrahmen','banks','bloom',.8],['box-frame','Rechteckrahmen','banks','bloom',.65],
 ['stack','Schichtebenen','rows','suspend',.35],['pillars','Säulenpaare','banks','bloom',.55],
 ['woven','Webebenen','rows','weave',.8],['lanes','Strahlenbahnen','rows','relay',.85],
 ['focus','Brennfächer','banks','gather',.35]
].map(([id,name,family,motion,energy])=>Object.freeze({id,name,family,motion,energy})));
export const FORMATION_CATALOG=Object.freeze(CATALOG_STRUCTURES.flatMap(structure=>CATALOG_CONTOURS.map(contour=>Object.freeze({
 id:`geometry-${structure.id}-${contour.id}`,name:`${structure.name} · ${contour.name}`,structure,contour,
 family:structure.family,cyclic:['radial','spiral'].includes(structure.id)||contour.character==='wave'
}))));
const byId=new Map(FORMATION_CATALOG.map(f=>[f.id,f]));
export const CATALOG_NAMES=Object.freeze(Object.fromEntries(FORMATION_CATALOG.map(f=>[f.id,f.name])));
export const catalogFormation=id=>byId.get(id);
export function catalogCounterpart(id){
 const form=byId.get(id);if(!form)return null;
 const i=CATALOG_CONTOURS.indexOf(form.contour),other=CATALOG_CONTOURS[i%2?i-1:i+1];
 return `geometry-${form.structure.id}-${other.id}`;
}
export function catalogCandidates(motion,evidence={}){
 const texture=evidence.texture;
 // Keep sparse passages free of a forest of separate beams. Repetition may
 // choose among eligible constructions, never promote an unsuitable section.
 const eligible=FORMATION_CATALOG.filter(f=>(evidence.energy??.5)>.35||!['quarters','lanes','woven'].includes(f.structure.id))
  .filter(f=>texture!=='voice'||!['quarters','lanes'].includes(f.structure.id));
 return eligible.slice().sort((a,b)=>catalogMatchScore(b,motion,evidence)-catalogMatchScore(a,motion,evidence));
}
export function catalogSpatialPose(id,rank,count,row=0,groups=1,progress=.5){
 const form=byId.get(id);if(!form)return null;
 const u=count>1?rank/(count-1):.5,r=u*2-1,side=r<0?-1:1,layer=row/Math.max(1,groups-1),p=clamp(progress);
 const profile=q=>{const v=Math.max(-1,Math.min(1,form.contour.profile(q)));return form.contour.character==='wave'?Math.sin(Math.asin(v)+p*Math.PI*2):v;};
 let f=profile(r),x=.5+r*.43,y=.5+f*.32,beamFocus=1;
 // A contour stays visible throughout the opening; progress unfolds its
 // receiving plane, not independent per-fixture clocks or random motion.
 y=.5+f*(form.cyclic?.32:.22+.1*p);
 switch(form.structure.id){
  case 'cross':x=.5-r*.43;y=.48+f*.29+layer*.06;break;
  case 'twins':case 'triptych':case 'quarters':{
   const panels={twins:2,triptych:3,quarters:4}[form.structure.id],bank=Math.min(panels-1,Math.floor(u*panels)),local=(u*panels-bank)*2-1;
   x=(bank+.5)/panels+local*.38/panels;y=.5+profile(local)*(.3-.02*panels)+layer*.035;break;
  }
  case 'folded':x=.5+r*(row%2?-.34:.4);y=.2+layer*.27+f*.14;beamFocus=.45;break;
  case 'radial':case 'spiral':{
   const spiral=form.structure.id==='spiral',angle=u*Math.PI*(spiral?3:2)+p*Math.PI*2+layer*.2;
   const radius=(spiral?.08+u*.24:.27)+f*.055;
   x=.5+Math.cos(angle)*radius;y=.5+Math.sin(angle)*radius*.88;break;
  }
  case 'diamond-frame':{
   const theta=u*Math.PI*2,scale=.31+f*.065;
   x=.5+Math.cos(theta)*scale/(Math.abs(Math.cos(theta))+Math.abs(Math.sin(theta)));
   y=.5+Math.sin(theta)*scale/(Math.abs(Math.cos(theta))+Math.abs(Math.sin(theta)));break;
  }
  case 'box-frame':{
   const theta=u*Math.PI*2,scale=.27+f*.055,den=Math.max(Math.abs(Math.cos(theta)),Math.abs(Math.sin(theta)));
   x=.5+Math.cos(theta)*scale/den;y=.5+Math.sin(theta)*scale/den;break;
  }
  case 'stack':x=.5+r*.37;y=.17+layer*.62+f*.1;beamFocus=.25;break;
  case 'pillars':x=.5+side*(.17+layer*.12)+r*.025;y=.49+f*.34;break;
  case 'woven':x=.5+r*(row%2?-.39:.39);y=.3+layer*.19+f*.17;break;
  case 'lanes':x=.18+Math.min(3,Math.floor(u*4))*.21+f*.025;y=.17+u*.59+f*.08;break;
  case 'focus':x=.5-r*(form.cyclic?.055:.045+.02*p);y=.47+f*.36;break;
 }
 return {x:clamp(x),y:clamp(y),beamFocus};
}

export function catalogMatchScore(f,motion,evidence={}){
 const texture=evidence.texture,character=texture==='drums'?'angular':texture==='bass'?'stepped':texture==='melody'||texture==='voice'?'curved':'wave';
 return (f.structure.motion===motion?2:0)+(f.contour.character===character?1.4:0)
  -Math.abs(f.structure.energy-(evidence.energy??.5))
  -Math.abs(f.contour.density-(evidence.density??.4))*1.2-Math.abs(f.contour.tone-(evidence.tone??.5))*.8
  +(f.family==='banks'&&texture==='bass'?.3:0)+(f.cyclic&&(evidence.pitchConfidence??0)>.55?.4:0);
}
