import {legacyColorDirection} from '../public/color-direction.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {settings} from '../lib/music.mjs';
const duration=16,beats=Array.from({length:32},(_,i)=>i*.5);
const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
const windows=Array.from({length:800},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
const make=audio=>legacyColorDirection(compileShow(audio,duration,settings({arrangement:'auto',maximum:75}),grid));
test('party and disco change interpretation, preserve timing and brightness limits',()=>{
 const base=make(windows),snapshot=structuredClone(base);
 const party=applyShowProfile(base,'party'),disco=applyShowProfile(base,'disco');
 for(const plan of [party,disco]){assert.deepEqual(plan.beatTiming.times,base.beatTiming.times);assert.deepEqual(plan.beatGrid,base.beatGrid);assert.ok(plan.frames.every(f=>f.dimming>=5&&f.dimming<=75));}
 const contrast=plan=>showFrameAt(plan,8).dimming-showFrameAt(plan,8.4).dimming;
 assert.ok(contrast(disco)<contrast(party));
 assert.ok(disco.colorEvents.length>party.colorEvents.length);assert.ok(contrast(party)>contrast(base));
 assert.notDeepEqual(disco.frames.map(f=>[f.r,f.g,f.b]),base.frames.map(f=>[f.r,f.g,f.b]));
 assert.deepEqual(base,snapshot);assert.equal(applyShowProfile(base,'auto'),base);
});
test('disco does not invent movement over silence or a constant pad',()=>{
 for(const rms of [0,.05]){
 const base=make(windows.map(w=>({...w,rms,bass:0,flux:0}))),disco=applyShowProfile(base,'disco');
 assert.equal(disco.arrangement.times.length,0);
 assert.deepEqual(disco.frames.map(f=>[f.r,f.g,f.b]),base.frames.map(f=>[f.r,f.g,f.b]));
 }
});
test('disco holds contrasting colors between musical accents and remains seek-stable',()=>{
 const base=make(windows),disco=applyShowProfile(base,'disco');
 const a=disco.colorEvents[2],b=disco.colorEvents[3];
 assert.ok(['r','g','b'].reduce((n,c)=>n+Math.abs(a[c]-b[c]),0)>200);
 for(const c of ['r','g','b'])assert.equal(showFrameAt(disco,(a.time+b.time)/2)[c],a[c]);
 const expected=showFrameAt(disco,b.time);showFrameAt(disco,15.9);assert.deepEqual(showFrameAt(disco,b.time),expected);
 assert.deepEqual(disco.beatTiming.times,base.beatTiming.times);
});

test('quiet styles preserve song timing and silence while reducing accent contrast',()=>{
 const base=make(windows),snapshot=structuredClone(base);
 for(const profile of ['calm','atmospheric']){
  const result=applyShowProfile(base,profile);
  assert.deepEqual(result.beatGrid,base.beatGrid);
  assert.deepEqual(result.arrangement.times,base.arrangement.times);
  assert.ok(result.arrangement.accents.every((v,i)=>v<base.arrangement.accents[i]||v===0));
  assert.ok(result.frames.every(f=>f.dimming>=0&&f.dimming<=75));
  assert.deepEqual(result.colorEvents,[]);
  const silent=applyShowProfile(make(windows.map(w=>({...w,rms:0,bass:0,flux:0}))),profile);
  assert.ok(silent.frames.every(f=>f.dimming===0||f.dimming===5));
  const legacy=applyShowProfile({step:1,frames:[{state:false,dimming:70},{dimming:0},{dimming:80}]},profile);
  assert.equal(legacy.frames[0].dimming,0);assert.equal(legacy.frames[1].dimming,0);assert.ok(legacy.frames[2].dimming<80);
 }
 assert.deepEqual(base,snapshot);
});

test('show ties color pictures and high contrast to existing musical events without changing the base plan',()=>{
 const base=compileShow(windows,duration,settings({arrangement:'auto',maximum:75}),grid),before=structuredClone(base);
 const show=applyShowProfile(base,'show');
 assert.equal(show.showProfile,'show');assert.ok(show.showCues.length>=3);
 assert.deepEqual(show.beatGrid,base.beatGrid);assert.deepEqual(show.arrangement.times,base.arrangement.times);
 assert.deepEqual(base,before);assert.equal(applyShowProfile(base,'auto'),base);
 const event=show.showCues.find(e=>e.time>1&&e.time<duration-1);
 const hit=showFrameAt(show,event.time),tail=showFrameAt(show,event.time+.65);
 assert.ok(hit.dimming-tail.dimming>25,'selected hits have a clear light/dark contrast');
 assert.deepEqual([hit.r,hit.g,hit.b],[event.r,event.g,event.b]);
 assert.deepEqual([tail.r,tail.g,tail.b],[hit.r,hit.g,hit.b],'color picture holds between cues');
 assert.ok(show.frames.every(f=>f.dimming>=0&&f.dimming<=75));
 assert.ok(show.showCues.every(e=>base.arrangement.times.includes(e.time)));
 assert.ok(show.showCues.some((e,i)=>i&&['r','g','b'].reduce((sum,k)=>sum+Math.abs(e[k]-show.showCues[i-1][k]),0)>180));
 assert.ok(showFrameAt(show,event.time,0).dimming<hit.dimming,'the existing flicker control still limits accents');
 const expected=showFrameAt(show,event.time);showFrameAt(show,15);assert.deepEqual(showFrameAt(show,event.time),expected);
});
test('show preserves explicit palettes and does not animate silence or a steady pad',()=>{
 for(const rms of [0,.05]){
  const base=make(windows.map(w=>({...w,rms,bass:0,flux:0}))),show=applyShowProfile(base,'show');
  assert.equal(show.showCues.length,0);
  assert.deepEqual(show.frames.map(f=>[f.r,f.g,f.b]),base.frames.map(f=>[f.r,f.g,f.b]));
 }
 const base=make(windows);base.effectiveOptions.palette='custom';base.colorPalette=[[255,0,0],[0,0,255]];
 const show=applyShowProfile(base,'show');
 assert.ok(show.showCues.every(e=>base.colorPalette.some(c=>c[0]===e.r&&c[1]===e.g&&c[2]===e.b)));
});
test('show is a distinct moving mode with coordinated arrivals and manual holds',async()=>{
 const {movingMoodForProfile}=await import('../public/dj-show-profile.js');
 const {movingCues,movingCueAt,movingCueExposure}=await import('../public/dmx-moving-cues.js');
 assert.equal(movingMoodForProfile('show'),'show');
 const plan=applyShowProfile(make(windows),'show'),cues=movingCues(plan,'auto','show');
 assert.ok(cues.some(c=>c.reason==='show-picture'&&c.coordinated));
 assert.ok(cues.every(c=>!c.darkTravel),'ordinary active picture changes stay visible');
 assert.equal(movingCueExposure(cues,6).level,1);
 const edited={...plan,sectionLighting:[{start:4,end:10,movement:0,rhythm:'none'}]};
 const held=movingCues(edited,'auto','show');assert.deepEqual(movingCueAt(held,4),movingCueAt(held,9.99));
});
test('show room targets deliberately reach floor, wall and ceiling',async()=>{
 const {roomSurfaceChoreography,newRoomPlan,roomPlanLayout}=await import('../public/dmx-ar-model.js');
 const layout=roomPlanLayout(newRoomPlan(10,10,4));
 const lamp={id:'test',type:'moving',position:{x:0,y:8,height:2.5},target:{x:1,y:2},motionFormation:'designed',motionPresentation:'show',power:1};
 for(const [y,surface] of [[.1,'floor'],[.5,'wall'],[.9,'ceiling']]){
  const value=roomSurfaceChoreography({...lamp,motionUV:{x:.6,y}},layout);
  assert.equal(value.targetSurface,surface);assert.equal(value.power,1);
 }
});

test('show color frames and fixture palettes change at the exact same off-grid cue',async()=>{
 const {songPaletteAt}=await import('../public/song-palette.js');
 const base=make(windows);base.arrangement.times=base.arrangement.times.map(t=>t+.037);
 const plan=applyShowProfile(base,'show'),cue=plan.showCues[1];assert.ok(cue);
 const frame=showFrameAt(plan,cue.time);
 assert.deepEqual(songPaletteAt(plan,cue.time)[0],[frame.r,frame.g,frame.b]);
});
test('parallel show beams retain their shared direction when projected onto a wall',async()=>{
 const {roomSurfaceChoreography,newRoomPlan,roomPlanLayout}=await import('../public/dmx-ar-model.js');
 const layout=roomPlanLayout(newRoomPlan(10,10,4));
 const targets=[-2,0,2].map(x=>roomSurfaceChoreography({id:'h'+x,type:'moving',position:{x,y:8,height:2.5},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionFormation:'designed',motionPresentation:'show',power:1},layout));
 assert.deepEqual(targets.map(l=>l.target.x),[-2,0,2]);
 assert.ok(targets.every(l=>l.targetSurface==='wall'));
 assert.equal(new Set(targets.map(l=>l.target.z)).size,1);
});


test('show develops moving formations between color cues on the measured pulse',async()=>{
 const {movingCues,movingCueAt}=await import('../public/dmx-moving-cues.js');
 const plan=applyShowProfile(make(windows),'show'),snapshot=structuredClone(plan);
 const cues=movingCues(plan,'auto','show'),motion=cues.filter(c=>c.reason==='show-motion');
 assert.ok(motion.length>=1,'active music develops a phrase between picture changes');
 assert.ok(motion.every(c=>plan.beatGrid.beats.includes(c.time)||plan.arrangement.times.includes(c.time)));
 const pairs=cues.slice(1).map((c,i)=>({c,p:cues[i]})).filter(({c,p})=>c.surface===p.surface);
 assert.ok(pairs.filter(({c,p})=>Math.abs(c.pose[0].pan-p.pose[0].pan)>2).length>=1,'same-surface formations visibly develop');
 for(const {c,p} of pairs){
  assert.ok(c.travel<=c.time-p.time);
  if(c.formation==='parallel')assert.ok(c.pose.every(h=>Math.abs(h.pan-c.pose[0].pan)<1e-6)||p.formation!=='parallel');
 }
 const sample=motion[0],t=sample.time-sample.travel*.5;
 assert.notDeepEqual(movingCueAt(cues,t),movingCueAt(cues,sample.time),'travel is visible between arrivals');
 const expected=movingCueAt(cues,t);movingCueAt(cues,15);assert.deepEqual(movingCueAt(cues,t),expected);
 assert.deepEqual(plan,snapshot,'motion does not alter the color and dimmer score');
});
test('show pulse does not animate a silent or steady pad even with a beat grid',async()=>{
 const {movingCues}=await import('../public/dmx-moving-cues.js');
 for(const rms of [0,.05]){
  const plan=applyShowProfile(make(windows.map(w=>({...w,rms,bass:0,flux:0}))),'show');
  const cues=movingCues(plan,'auto','show');
  assert.equal(cues.filter(c=>c.reason==='show-motion').length,0);
 }
});


test('show action shares exact musical timing, symmetric groups and smooth color waves',async()=>{
 const {showActionAt}=await import('../public/show-action.js');
 const {spatialColors}=await import('../public/dmx-auto.js');
 const {movingPresenceLevel}=await import('../public/dmx-activity.js');
 const plan={showProfile:'show',showCues:[{time:2.037,end:5,action:'launch',actionDuration:1,phase:0}]};
 assert.equal(showActionAt(plan,2),null);
 assert.equal(showActionAt(plan,3.037),null);
 for(const count of [1,2,7,8]){
  const colors=spatialColors({movingPlan:plan,songTime:2.537},count,[[255,30,0],[0,80,255]]);
  assert.equal(colors.length,count);
  assert.deepEqual(colors,[...colors].reverse(),'color gradient mirrors the formation');
  assert.ok(colors.every(c=>Math.max(...c)===255),'complementary transition keeps brightness');
  const levels=Array.from({length:count},(_,rank)=>movingPresenceLevel({level:1,mask:'show-action',action:'launch',progress:.3,amount:1},rank,count));
  assert.deepEqual(levels,[...levels].reverse());
  assert.ok(levels.every(v=>v>=0&&v<=1));
  if(count>2)assert.ok(levels[Math.floor(count/2)]>levels[0],'build opens from the center');
 }
 const source={movingPlan:plan,songTime:3.036};
 assert.ok(spatialColors(source,8,[[255,30,0],[0,80,255]]).every(c=>c[0]===255&&c[2]<=1),'color wave settles without a discontinuity');
 const limited={level:.8,mask:'show-action',action:'answer',phase:0,progress:.4,amount:0};
 assert.deepEqual(Array.from({length:8},(_,i)=>movingPresenceLevel(limited,i,8)),Array(8).fill(.8),'flicker zero removes group switching');
});
test('show group actions respect manual rhythm and deterministic playback',async()=>{
 const {movingPresenceAt}=await import('../public/dmx-activity.js');
 const plan=applyShowProfile(make(windows),'show');
 const cue=plan.showCues.find(c=>c.action==='answer');assert.ok(cue);
 const source={movingPlan:plan,songTime:cue.time+.1,movingMood:'show',flicker:.4};
 const expected=movingPresenceAt(source);assert.equal(expected.mask,'show-action');assert.equal(expected.amount,.4);
 movingPresenceAt({...source,songTime:15});assert.deepEqual(movingPresenceAt(source),expected);
 const manual={...plan,sectionLighting:[{start:0,end:16,rhythm:'none'}]};
 assert.equal(movingPresenceAt({...source,movingPlan:manual}).mask,'all');
});

test('show lateral bearings reach both side walls including the center head',async()=>{
 const {roomSurfaceChoreography,newRoomPlan,roomPlanLayout}=await import('../public/dmx-ar-model.js');
 const layout=roomPlanLayout(newRoomPlan(10,10,4));
 const lamp={id:'center',type:'moving',position:{x:0,y:8,height:2.5},target:{x:0,y:3},motionFormation:'designed',motionRole:'center',motionPresentation:'show',power:1};
 const hits=[.05,.95].map(x=>roomSurfaceChoreography({...lamp,motionUV:{x,y:.5}},layout));
 assert.ok(hits.every(h=>h.targetSurface==='wall'&&h.power===1));
 assert.ok(hits[0].target.x< -4.9&&hits[1].target.x>4.9);
 assert.ok(hits.every(h=>Math.abs(h.target.y-8)<.01),'lateral direction is not pulled to the front');
});
test('intense show arrivals and action endings follow exact beats outside the render grid',async()=>{
 const {movingCues,movingCueAt}=await import('../public/dmx-moving-cues.js');
 const {motionDuration}=await import('../public/dmx-moving-model.js');
 const base=make(windows),pulse=Array.from({length:32},(_,i)=>.037+i*.47);
 base.beatGrid={...base.beatGrid,beats:pulse,downbeats:pulse.filter((_,i)=>i%4===0)};
 base.arrangement.times=pulse;base.arrangement.accents=pulse.map(()=>.65);base.arrangement.eventSalience=pulse.map(()=>.8);
 base.arrangement.drama={step:.1,intensity:Array(160).fill(.9),percussion:Array(160).fill(.9),vocalShare:Array(160).fill(0)};
 base.sections=base.sections.map(s=>({...s,look:'peak'}));
 const plan=applyShowProfile(base,'show'),cues=movingCues(plan,'auto','show');
 assert.ok(cues.length<pulse.length,'large movements span several beats');
 for(const cue of cues.filter(c=>c.time>2&&c.time<14)){
  assert.ok(pulse.some(t=>Math.abs(t-cue.time)<1e-9),'motor arrival uses a measured beat');
  assert.deepEqual(movingCueAt(cues,cue.time),cue.pose,'arrival uses exact song time');
 }
 for(const color of plan.showCues.filter(c=>c.time>2&&c.time<14)){
  assert.ok(pulse.some(t=>Math.abs(t-color.time)<1e-9),'visual action uses the original event');
  assert.ok(pulse.some(t=>Math.abs(t-color.time-color.actionDuration)<1e-9),'action ends on a measured beat');
 }
 for(let i=1;i<cues.length;i++)assert.ok(motionDuration(cues[i-1].pose,cues[i].pose,.8)<=cues[i].travel+1e-6,'shared reach obeys motor bounds');
});
