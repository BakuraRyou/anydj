import test from 'node:test';
import assert from 'node:assert/strict';
import {movingDirections,directedPose} from '../public/dmx-moving-direction.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
const song=(characters=['atmospheric','rhythmic','rhythmic','atmospheric'])=>({
 duration:64,
 sections:characters.map((_,i)=>({start:i*16,end:(i+1)*16,look:['held','lift','peak','held'][i],motif:i===3?0:i})),
 arrangement:{times:Array.from({length:128},(_,i)=>i*.5),accents:Array(128).fill(.6),patterns:{
  events:Array.from({length:128},()=>({kind:'bounce',driving:true})),
  phrases:characters.map((character,i)=>({start:i*16,end:(i+1)*16,section:i,energy:.7,tone:.7,kind:'bounce',movement:{character,driving:1}}))
 }}
});
test('movement motifs are deterministic, song-derived and recalled without mutating the plan',()=>{
 const p=song(),original=structuredClone(p),d=movingDirections(p);
 assert.deepEqual(movingDirections(p),d);assert.deepEqual(p,original);
 assert.deepEqual(d.map(x=>x.shape),['arc','fan','pulse','arc']);
 assert.equal(d[3].recalled,true);
 for(let i=0;i<4;i++)assert.deepEqual(directedPose(d[0],i),directedPose(d[3],i));
 p.arrangement.patterns.phrases[3].tone=.1;
 assert.equal(movingDirections(p)[3].recalled,false);
});
test('instrument balance changes formation; builds open progressively and width is independent of speed',()=>{
 const p=song(),d=movingDirections(p);
 assert.ok(d[0].width>12);assert.ok(d[0].speed<d[2].speed);assert.ok(d[0].spacing>d[2].spacing);
 const width=progress=>Math.abs(directedPose(d[1],0,progress)[0].pan);
 assert.ok(width(0)<width(.5)&&width(.5)<width(1));
 p.arrangement.drama={step:1,intensity:Array(64).fill(.7),percussion:Array(64).fill(.2),vocalShare:Array(64).fill(.8),attacks:Array(64).fill(0)};
 assert.equal(movingDirections(p)[2].shape,'focus');
 p.arrangement.drama.vocalShare.fill(.1);
 assert.equal(movingDirections(p)[2].shape,'cross');
});
test('planned travel reaches acoustic cues, holds between journeys and bounds speed through section changes',()=>{
 const p=song(),cues=movingCues(p,'auto');
 for(let i=1;i<cues.length;i++){
  const cue=cues[i],prev=cues[i-1];
  assert.ok(p.arrangement.times.includes(cue.time));
  assert.deepEqual(movingCueAt(cues,cue.time),cue.pose);
  assert.ok(cue.travel<=cue.time-prev.time+1e-9);
  if(cue.time-cue.travel>prev.time+.01)assert.deepEqual(movingCueAt(cues,(prev.time+cue.time-cue.travel)/2),prev.pose);
 }
 let prev=movingCueAt(cues,0);
 for(let t=.01;t<64;t+=.01){
  const next=movingCueAt(cues,t);
  next.forEach((v,i)=>{
   assert.ok(Math.abs(v.pan)<=42&&v.tilt>=.55&&v.tilt<=1.15);
   assert.ok(Math.abs(v.pan-prev[i].pan)<=70*.01+1e-8);
   assert.ok(Math.abs(v.tilt-prev[i].tilt)<=.8*.01+1e-8);
  });prev=next;
 }
 const quiet=cues.filter(c=>c.time>0&&c.time<16);
 assert.ok(quiet.every(c=>c.travel<=1.5));assert.ok(quiet.length<=1);
});
test('prepared directions survive forward and backward seeking and leave manual styles intact',()=>{
 const p=song(),job=movingPlanJob(p,'auto');while(!job.done)job.advance();
 const expected=movingPlanAt(job.result,35.125);
 movingPlanAt(job.result,60);movingPlanAt(job.result,3);
 assert.deepEqual(movingPlanAt(job.result,35.125),expected);
 const legacy=structuredClone(p);legacy.arrangement.patterns.phrases.forEach(x=>delete x.movement);
 for(const mode of ['follow','alternate','wash'])assert.deepEqual(movingCues(p,mode),movingCues(legacy,mode));
 for(const mood of ['calm','atmospheric','energetic'])assert.ok(movingCues(p,'auto',mood).length<movingCues(legacy,'auto',mood).length);
});


test('moderate sections keep moving while deliberately restrained moods can hold',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='peak');p.arrangement.patterns.phrases.forEach(p=>p.energy=.4);
 const snapshot=structuredClone(p);
 for(const mood of ['balanced','calm','atmospheric','energetic']){
  const cues=movingCues(p,'auto',mood);
  if(mood==='balanced'){
   assert.ok(cues.length>10);assert.notDeepEqual(movingCueAt(cues,10),movingCueAt(cues,63));
   assert.ok(cues.some(c=>c.reason==='section-flow'));
  }else{assert.equal(cues.length,2);assert.deepEqual(movingCueAt(cues,10),movingCueAt(cues,63));}
 }
 assert.deepEqual(p,snapshot);
});
test('section movement evolves between accents without changing its spatial character on each hit',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='peak');p.arrangement.patterns.phrases.forEach(p=>p.energy=.4);p.arrangement.accents.fill(.4);
 p.arrangement.accents[12]=.7;p.arrangement.patterns.phrases.slice(1).forEach(p=>p.tone=.2);
 const cues=movingCues(p,'auto');
 assert.ok(cues.some(c=>c.reason==='section-flow'));
 assert.notDeepEqual(movingCueAt(cues,5),movingCueAt(cues,7));
 assert.ok(cues.every(c=>c.travel<=2));
 assert.deepEqual(cues,movingCues(p,'auto'),'seeking/replanning is deterministic');
});
test('build sections develop continuously and measured rising energy adds build accents',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='lift');
 p.beatGrid={downbeats:Array.from({length:32},(_,i)=>i*2)};
 p.arrangement.patterns.events.forEach(e=>e.kind='build');
 assert.ok(movingCues(p,'auto').some(c=>c.reason==='section-flow'));
 p.arrangement.drama={step:.5,intensity:Array.from({length:128},(_,i)=>Math.min(.9,.1+i*.025)),percussion:Array(128).fill(.6),vocalShare:Array(128).fill(.1),attacks:Array(128).fill(.1)};
 const cues=movingCues(p,'auto');
 assert.ok(cues.some(c=>c.reason==='build'));
 assert.ok(cues.filter(c=>c.reason==='build').every(c=>p.beatGrid.downbeats.includes(c.time)));
});


test('intense grooves follow actual accents continuously and stop moving through breaks',()=>{
 const p=song(['rhythmic','rhythmic','atmospheric','atmospheric']);
 p.sections[0].look=p.sections[1].look='peak';p.sections[2].look='held';
 const original=structuredClone(p);
 for(const mood of ['balanced','energetic']){
  const cues=movingCues(p,'auto',mood),groove=cues.filter(c=>c.reason==='groove');
  assert.ok(groove.length>=30);
  const pans=Array.from({length:1200},(_,i)=>movingCueAt(cues,1+i*.025)[0].pan);
  assert.ok(Math.max(...pans)-Math.min(...pans)>20,'motor limits must not collapse an intense groove into tiny hops');
  const moving=pans.slice(1).filter((pan,i)=>Math.abs(pan-pans[i])>.01).length;
  assert.ok(moving/pans.length>.8,'fewer destinations must still produce continuous movement');
  assert.ok(groove.every(c=>p.arrangement.times.includes(c.time)&&c.time<32));
  for(let i=1;i<groove.length;i++)assert.ok(Math.abs(groove[i].travel-(groove[i].time-groove[i-1].time))<1e-9);
  assert.deepEqual(movingCueAt(cues,37),movingCueAt(cues,45));
 }
 for(const mood of ['calm','atmospheric'])assert.ok(!movingCues(p,'auto',mood).some(c=>c.reason==='groove'));
 assert.deepEqual(p,original);
});
test('groove timing follows irregular audio accents and louder hits change the path',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 p.arrangement.times=p.arrangement.times.map((t,i)=>t+(i%2?.09:0));
 const a=movingCues(p,'auto'),changed=structuredClone(p);
 changed.arrangement.accents=changed.arrangement.accents.map((v,i)=>i%3===0?.3:v);
 const b=movingCues(changed,'auto');
 assert.ok(a.filter(c=>c.reason==='groove').every(c=>p.arrangement.times.includes(c.time)));
 assert.ok(a.some((c,i)=>i>1&&Math.abs((c.time-a[i-1].time)-.5)>.05));
 assert.notDeepEqual(a.map(c=>c.pose),b.map(c=>c.pose));
 let previous=movingCueAt(b,0);
 for(let t=.01;t<64;t+=.01){const next=movingCueAt(b,t);next.forEach((v,i)=>{
  assert.ok(Math.abs(v.pan-previous[i].pan)<=.700001);assert.ok(Math.abs(v.tilt-previous[i].tilt)<=.008001);
 });previous=next;}
});
test('disco rhythmic formations give all four heads distinct roles beyond inner and outer pairs',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 for(const mood of ['disco']){
  const job=movingPlanJob(p,'auto',mood);while(!job.done)job.advance();
  let independent=0,total=0;
  for(let t=3;t<28;t+=.05){
   const poses=movingPlanAt(job.result,t);
   const mirrored=([a,b])=>Math.abs(poses[a].pan+poses[b].pan)<.1&&Math.abs(poses[a].tilt-poses[b].tilt)<.002;
   if(!mirrored([0,3])&&!mirrored([1,2]))independent++;
   total++;
  }
  assert.ok(independent/total>.8,'heads must not remain permanently locked into two mirror pairs');
 }
 const directions=movingDirections(p,true);assert.equal(directions[0].formation,'diagonal');
 p.arrangement.patterns.phrases.forEach(ph=>ph.movement.driving=.4);
 assert.equal(movingDirections(p,true)[0].formation,'ribbon');
});
test('automatic motion uses broad coherent arcs with fewer reversals than disco',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 const measure=mood=>{
  const cues=movingCues(p,'auto',mood),pans=[];
  for(let t=3;t<30;t+=.025)pans.push(movingCueAt(cues,t)[0].pan);
  let direction=0,turns=0;
  for(let i=1;i<pans.length;i++){
   const delta=pans[i]-pans[i-1];if(Math.abs(delta)<.005)continue;
   const next=Math.sign(delta);if(direction&&next!==direction)turns++;direction=next;
  }
  return {turns,range:Math.max(...pans)-Math.min(...pans)};
 };
 const normal=measure('balanced'),disco=measure('disco');
 assert.ok(normal.turns<disco.turns*.75);
 assert.ok(normal.range>25,'smoother must not mean tiny movements');
 assert.equal(movingDirections(p)[0].formation,'pairs');
 assert.equal(movingDirections(p,true)[0].formation,'diagonal');
});
test('automatic movement tempo follows a measured rise instead of a fixed eight-beat cycle',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 p.arrangement.drama={step:.5,intensity:Array.from({length:128},(_,i)=>i<64?.56:.95),percussion:Array(128).fill(.7),vocalShare:Array(128).fill(.1),attacks:Array(128).fill(.1)};
 const cues=movingCues(p,'auto');
 const reversals=(start,end)=>{
  let prior=movingCueAt(cues,start)[0].pan,direction=0;const times=[];
  for(let t=start+.025;t<end;t+=.025){const pan=movingCueAt(cues,t)[0].pan,delta=pan-prior;prior=pan;if(Math.abs(delta)<.01)continue;const next=Math.sign(delta);if(direction&&next!==direction)times.push(t);direction=next;}
  const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
  assert.ok(gaps.length>=1);return gaps[Math.floor(gaps.length/2)];
 };
 assert.ok(reversals(38,61)<reversals(5,29)*.85);
 const original=structuredClone(p);assert.deepEqual(movingCues(p,'auto'),cues);assert.deepEqual(p,original);
 const disco=movingCues(p,'auto','disco');assert.ok(disco.every(c=>c.drive===undefined&&c.settle===undefined));
});

test('groove shapes describe distinct paths instead of reusing ellipses',async()=>{
 const {groovePose}=await import('../public/dmx-moving-direction.js');
 const path=shape=>Array.from({length:65},(_,i)=>groovePose(i/4,{shape,energy:.8,strength:.8,percussion:.8,vocals:.1,formation:'mirror',period:16})[0]);
 const area=points=>Math.abs(points.slice(1).reduce((n,p,i)=>n+points[i].pan*p.tilt-p.pan*points[i].tilt,0));
 for(const shape of ['sweep','pulse','cross','arc'])assert.ok(area(path(shape))<1e-8,shape+' retraces an open path rather than orbiting');
 assert.ok(area(path('orbit'))>1);
 assert.equal(new Set(path('sweep').map(p=>p.tilt)).size,1);
 assert.ok(new Set(path('cross').map(p=>p.tilt)).size>10);
 const width=points=>Math.max(...points.map(p=>p.pan))-Math.min(...points.map(p=>p.pan));
 assert.ok(width(path('focus'))<width(path('sweep'))*.3);
});
test('actual automatic groove cues honor the musical shape and keep circles exceptional',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 assert.ok(movingCues(p,'auto').filter(c=>c.reason==='groove').every(c=>c.shape==='pulse'));
 p.arrangement.drama={step:.5,intensity:Array(128).fill(.9),percussion:Array(128).fill(.55),vocalShare:Array(128).fill(.6),attacks:Array(128).fill(.1)};
 assert.equal(movingDirections(p)[0].shape,'focus');
 assert.ok(movingCues(p,'auto').filter(c=>c.reason==='groove').some(c=>c.shape==='focus'));
 p.arrangement.drama.vocalShare.fill(.1);p.arrangement.patterns.phrases.forEach(ph=>{ph.energy=.9;ph.tone=.8;});
 assert.equal(movingDirections(p,true)[0].shape,'orbit');
 assert.notEqual(movingDirections(p)[0].shape,'orbit','balanced does not default to a circle at peaks');
 p.sections.forEach(s=>s.look='lift');assert.ok(movingDirections(p,true).every(d=>d.shape==='fan'));
});
test('ribbon formations preserve a fan opening rather than replacing it with a sweep',()=>{
 const design={shape:'fan',formation:'ribbon',width:28,depth:.1,inner:.5,category:'build'};
 assert.deepEqual(directedPose(design,0,.5),directedPose(design,2,.5));
 assert.notDeepEqual(directedPose(design,0,.1),directedPose(design,0,.9));
});

test('automatic choreography gives every head depth and area instead of a permanent central lane',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 const cues=movingCues(p,'auto');
 for(let head=0;head<4;head++){
  const points=Array.from({length:560},(_,i)=>movingCueAt(cues,4+i*.1)[head]);
  const xs=points.map(p=>p.pan/42),ys=points.map(p=>(p.tilt-.85)/.3);
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,mx=mean(xs),my=mean(ys);
  const xx=mean(xs.map(x=>(x-mx)**2)),yy=mean(ys.map(y=>(y-my)**2)),xy=mean(xs.map((x,i)=>(x-mx)*(ys[i]-my)));
  assert.ok(Math.max(...ys)-Math.min(...ys)>.7,`head ${head} reaches front and back`);
  assert.ok(Math.min(...xs)<-.15&&Math.max(...xs)>.15,`head ${head} leaves its central role`);
  assert.ok(xx*yy-xy*xy>.002,`head ${head} covers area instead of a line`);
 }
});

test('musical phrases balance paired and independent movement without a fixed symmetry rule',async()=>{
 const {spatialPose}=await import('../public/dmx-moving-direction.js');
 const p=song(),d=movingDirections(p);
 assert.ok(d[0].asymmetry<d[1].asymmetry&&d[1].asymmetry<d[2].asymmetry);
 assert.equal(d[3].asymmetry,d[0].asymmetry,'returning motifs recall their group balance');
 p.arrangement.drama={step:1,intensity:Array(64).fill(.9),percussion:Array(64).fill(.8),vocalShare:Array(64).fill(.8),attacks:Array(64).fill(0)};
 const vocal=movingDirections(p)[2];assert.ok(vocal.asymmetry<d[2].asymmetry,'vocals bring the group together even at high energy');
 const poses=[{pan:-25,tilt:.65},{pan:-12,tilt:.9},{pan:5,tilt:1},{pan:18,tilt:.8}];
 const paired=spatialPose(poses,12,{asymmetry:0}),free=spatialPose(poses,12,{asymmetry:1});
 const tension=points=>Math.abs(points[0].pan+points[3].pan)+42*Math.abs(points[0].tilt-points[3].tilt);
 assert.equal(tension(paired),0);
 const calm=spatialPose(poses,12,{asymmetry:vocal.asymmetry}),peak=spatialPose(poses,12,{asymmetry:d[2].asymmetry});
 assert.ok(tension(calm)>0&&tension(calm)<tension(peak)&&tension(peak)<tension(free));
});

test('each section keeps its character across short phrases while quiet passages still develop',()=>{
 const p=song();p.sections=[{start:0,end:32,look:'quiet'},{start:32,end:64,look:'peak'}];
 p.arrangement.patterns.phrases=Array.from({length:8},(_,i)=>({start:i*8,end:(i+1)*8,section:i<4?0:1,energy:i%2?.8:.3,tone:i%2?.9:.2,movement:{character:'rhythmic',driving:.8}}));
 p.arrangement.drama={step:1,intensity:Array.from({length:64},(_,i)=>i<32?.35:.95),percussion:Array.from({length:64},(_,i)=>i<32?.2:.9),vocalShare:Array(64).fill(.1),attacks:Array(64).fill(.1)};
 const d=movingDirections(p),character=x=>[x.shape,x.formation,x.asymmetry,x.speed,x.energy];
 for(let i=1;i<4;i++)assert.deepEqual(character(d[i]),character(d[0]));
 for(let i=5;i<8;i++)assert.deepEqual(character(d[i]),character(d[4]));
 assert.ok(d[4].asymmetry>d[0].asymmetry&&d[4].speed>d[0].speed);
 const cues=movingCues(p,'auto');assert.ok(cues.filter(c=>c.time<32&&c.reason==='section-flow').length>=4);
 for(let i=1;i<cues.length;i++)if(cues[i].reason==='section-flow'&&cues[i].time<32){
  assert.equal(cues[i].continuous,true);
  assert.ok(Math.abs(cues[i].travel-(cues[i].time-cues[i-1].time))<1e-8,'quiet follow-up uses the whole interval without a hold');
 }
 assert.notDeepEqual(movingCueAt(cues,10),movingCueAt(cues,22));
 assert.ok(cues.some(c=>c.time>=32&&c.reason==='groove'));
});
