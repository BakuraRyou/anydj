import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage} from '../public/dmx-auto.js';
import {presenceComposition} from '../public/dmx-group-motion.js';
import {movingPresenceAt,mixMovingPresence} from '../public/dmx-activity.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';
import {createRoomMotors} from '../public/dmx-light-geometry.js';

const song=()=>({duration:8,showProfile:'strobe',showScore:[
 {start:0,end:4,role:'groove',rhythmic:true,energy:.8,tone:.5},
 {start:4,end:5,role:'silence',energy:0},
 {start:5,end:8,role:'arrival',rhythmic:true,energy:.9,tone:.5}],
 sections:[{start:0,end:8,look:'peak'}],beatGrid:{beats:Array.from({length:17},(_,i)=>i*.5)},
 arrangement:{times:[0,.5,1,1.5,2,2.5,3,3.5,5,5.5,6,6.5,7,7.5],accents:Array(14).fill(.6),eventSources:Array(14).fill('onset')}});
const source=(movingPlan,songTime)=>({movingPlan,songTime,weight:1,flicker:53,look:'peak',washDimming:80,
 frame:{state:true,r:255,g:30,b:0,dimming:80},palette:[[255,30,0],[0,80,255]]});
const equipment={devices:[{id:'head',type:'moving',cells:1},
 ...Array.from({length:4},(_,i)=>({id:'s'+i,type:'spot',cells:1})),{id:'bar',type:'bar',cells:8}]};

test('song crossfades blend each prepared companion envelope through equal deck weights',()=>{
 const a=source(song(),1.05),b=source(song(),1.4);
 const render=streams=>automaticStage(streams,2,equipment,'strobe').frames;
 const left=render([a]),right=render([b]);
 assert.ok(right.flat().some((f,i)=>Math.abs(f.dimming-left.flat()[i].dimming)>1),'different musical exposures');
 for(const t of [0,.1,.49,.499999,.5,.500001,.51,.9,1]){
  const mixed=render([{...a,weight:1-t},{...b,weight:t}]);
  mixed.flat().forEach((f,i)=>assert.ok(Math.abs(f.dimming-(left.flat()[i].dimming*(1-t)+right.flat()[i].dimming*t))<1e-9,
   `fixture ${i} at ${t}: both musical envelopes must survive`));
 }
});

test('a quiet incoming song cannot suddenly black out the outgoing companions at the midpoint',()=>{
 const a=source(song(),1.4),b=source(song(),4.5);
 const render=t=>automaticStage([{...a,weight:1-t},{...b,weight:t}],2,equipment,'strobe').frames.slice(1).flat();
 const before=render(.5-1e-6),after=render(.5+1e-6);
 assert.ok(before.some(f=>f.dimming>1));
 assert.ok(after.some(f=>f.dimming>1));
 after.forEach((f,i)=>assert.ok(Math.abs(f.dimming-before[i].dimming)<.001));
});

test('equal formation layers retain projection and visible travel throughout the song handover',()=>{
 const a=movingPresenceAt({...source(song(),1.05),stageMode:'strobe'});
 const b=movingPresenceAt({...source(song(),5.05),stageMode:'strobe'});
 for(const t of [.49,.5,.51])for(let rank=0;rank<8;rank++){
  const mixed=mixMovingPresence([{presence:a,weight:1-t},{presence:b,weight:t}]);
  const c=presenceComposition(mixed,rank,8);
  assert.equal(c.beamPicture,true,'room projection must not change at the midpoint');
  assert.equal(c.visibleMotion,true,'motor lag must not trigger a dark transfer during the morph');
 }
});

test('zero-weight layers do not enable visible travel for a held formation',()=>{
 const a=movingPresenceAt({...source(song(),1.05),stageMode:'strobe'});
 const b=movingPresenceAt({...source(song(),4.5),stageMode:'strobe'});
 const held=presenceComposition(b,0,8);
 const mixed=presenceComposition(mixMovingPresence([{presence:a,weight:0},{presence:b,weight:1}]),0,8);
 assert.equal(mixed.visibleMotion??false,held.visibleMotion??false);
 assert.equal(mixed.beamPicture??false,held.beamPicture??false);
});

test('current shared song choreography preserves both light envelopes and room geometry',()=>{
 const a=source(varietySong(),2.2),b=source(varietySong(),12.3);
 const presence=s=>movingPresenceAt({...s,stageMode:'strobe'});
 assert.ok(presence(a).groupMotion.music.sequence.formationStory,'exercise the current formation director');
 const render=streams=>automaticStage(streams,2,equipment,'strobe').frames.flat();
 const left=render([a]),right=render([b]);
 assert.ok(left.some((f,i)=>Math.abs(f.dimming-right[i].dimming)>1));
 for(const t of [.1,.49,.5,.51,.9]){
  const frames=render([{...a,weight:1-t},{...b,weight:t}]);
  frames.forEach((f,i)=>assert.ok(Math.abs(f.dimming-left[i].dimming*(1-t)-right[i].dimming*t)<1e-9));
  const blended=mixMovingPresence([{presence:presence(a),weight:1-t},{presence:presence(b),weight:t}]);
  for(let row=0;row<3;row++)for(let rank=0;rank<12;rank++){
   const c=presenceComposition(blended,rank,12,row,3);
   assert.equal(c.beamPicture,true);
   assert.equal(c.visibleMotion,true);
   assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));
  }
 }
});

test('room motors keep the live crossfade lit while retaining dark transfers for a single held pose',()=>{
 const a=movingPresenceAt({...source(song(),1.05),stageMode:'strobe'});
 const b=movingPresenceAt({...source(song(),5.05),stageMode:'strobe'});
 const composition=presenceComposition(mixMovingPresence([{presence:a,weight:.5},{presence:b,weight:.5}]),0,8);
 const layout={width:10,depth:8,height:4,room:true};
 const light={id:'head',type:'moving',position:{x:0,y:6,height:3},target:{x:0,y:2,z:.012},
  power:.8,movingGroupActive:true,motionPresentation:'strobe'};
 const render=visible=>{
  const motor=createRoomMotors();motor(light,layout,0);
  return motor({...light,target:{x:1,y:2,z:.012},strobeVisibleMotion:visible},layout,1/60);
 };
 assert.equal(render(composition.visibleMotion).power,.8,'no accidental blackout from motor lag');
 assert.equal(render(false).power,0,'a held direction still requires its dark transfer');
});
