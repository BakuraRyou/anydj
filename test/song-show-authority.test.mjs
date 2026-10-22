import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHOW_PROFILES,resolveShowProfile,applySongShowProfile,movingMoodForProfile} from '../public/dj-show-profile.js';
import {stageModeForStreams,automaticStage} from '../public/dmx-auto.js';
test('song profile takes precedence; standard is used only for unassigned songs',()=>{
 const base={duration:1,step:.1,frames:[{state:true,r:255,g:20,b:0,dimming:50}]};
 for(const profile of SHOW_PROFILES)for(const standard of SHOW_PROFILES){
  assert.equal(resolveShowProfile(profile,standard),profile);
  const plan=applySongShowProfile(base,profile,standard);
  assert.equal(plan.showProfile,profile);assert.equal(plan.movingMood,movingMoodForProfile(profile));
  assert.equal(resolveShowProfile(undefined,standard),standard);
 }
 assert.equal(resolveShowProfile(undefined,'invalid'),'auto');
 assert.deepEqual(base,{duration:1,step:.1,frames:[{state:true,r:255,g:20,b:0,dimming:50}]},'profile resolution does not mutate the source');
});
test('saved stage modes cannot replace a song show in output or movement dispatch',()=>{
 for(const profile of SHOW_PROFILES){
  const stream={frame:{state:true,r:255,g:20,b:0,dimming:50},weight:1,look:'flow',movingPlan:{showProfile:profile}};
  const mode=profile==='strobe'?'strobe':'auto';
  for(const obsolete of ['shared','chase','wash','follow','alternate','design']){
   assert.equal(stageModeForStreams([stream],obsolete),mode);
   assert.deepEqual(automaticStage([stream],2,undefined,obsolete),automaticStage([stream],2,undefined,mode));
  }
 }
});
test('DJ surface exposes song choice and an inheritable standard, not a second stage show selector',async()=>{
 const stage=await readFile(new URL('../public/dmx-stage.js',import.meta.url),'utf8');
 const dj=await readFile(new URL('../public/dj.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/dj.html',import.meta.url),'utf8');
 assert.doesNotMatch(stage,/Wie soll dein Licht spielen|dataset\.stageChoice/);
 assert.match(stage,/stageModeForStreams\(streams,'auto'\)/);
 assert.match(stage,/songDriven:true/);
 assert.match(html,/Standard-Lichtshow für Songs ohne eigene Auswahl/);
 assert.match(dj,/value==='default'\)delete track\.showProfile/);
 assert.match(dj,/track\.basePlan&&!SHOW_PROFILES\.includes\(track\.showProfile\)/);
});
