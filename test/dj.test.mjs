import test from 'node:test';
import assert from 'node:assert/strict';
import {deckGains,mixDeckFrames,fileIdentity,crossfadePosition,automaticFadeSource} from '../public/dj-model.js';
import {compileShow,transitionFrame,showFrameAt} from '../public/show-plan.js';
import {validateStructure} from '../public/song-structure.js';
import {settings} from '../lib/music.mjs';
const structure={version:1,source:'all-in-one',duration:8,segments:[{start:0,end:2,label:'intro'},{start:2,end:4,label:'verse'},{start:4,end:8,label:'chorus'}]};
test('DJ Crossfader lässt an den Enden nur ein Deck durch und überblendet Licht anteilig',()=>{
  const a={state:true,r:255,g:1,b:1,dimming:75},b={state:true,r:1,g:1,b:255,dimming:5};
  assert.deepEqual(mixDeckFrames([a,b],deckGains(0)),a);
  assert.deepEqual(mixDeckFrames([a,b],deckGains(1)),b);
  assert.deepEqual(mixDeckFrames([a,b],deckGains(.5)),{state:true,r:128,g:1,b:128,dimming:40});
  assert.deepEqual(mixDeckFrames([a,null],deckGains(.5)),a);
  assert.equal(mixDeckFrames([a,null],deckGains(1)).dimming,5);
  assert.throws(()=>deckGains(NaN));
  assert.deepEqual(deckGains(-1),[1,0]);
});
test('Lokale Dateizuordnung unterscheidet gleichnamige veränderte Dateien',()=>{
  const a={name:'song.mp3',size:20,lastModified:12};
  assert.notEqual(fileIdentity(a),fileIdentity({...a,lastModified:13}));
});
test('Songstruktur lehnt Lücken, Überlappungen, unbekannte Abschnitte und fremde Zeitbasis ab',()=>{
  assert.deepEqual(validateStructure(structure,8),structure);
  for(const segments of [[],[{start:0,end:8,label:'unknown'}],[{start:1,end:8,label:'verse'}],[{start:0,end:4,label:'verse'},{start:5,end:8,label:'chorus'}],[{start:0,end:5,label:'verse'},{start:4,end:8,label:'chorus'}]]) assert.throws(()=>validateStructure({...structure,segments},8));
  assert.throws(()=>validateStructure(structure,9));
});
test('Songstruktur verfeinert automatische Farben, erhält Beats und respektiert manuelle Gestaltung',()=>{
  const windows=Array.from({length:400},(_,i)=>({rms:.15,bass:.04,tone:.4,beatSeq:Math.floor(i/25)}));
  const options=settings({arrangement:'auto'});
  const baseline=compileShow(windows,8,options),enhanced=compileShow(windows,8,options,null,structure);
  assert.equal(baseline.beats,enhanced.beats);assert.notDeepEqual(baseline.arrangement.bases,enhanced.arrangement.bases);
  assert.equal(enhanced.sections[2].title,'Refrain');assert.equal(enhanced.sections[2].estimated,true);
  assert.notDeepEqual(baseline.frames,enhanced.frames);
  assert.deepEqual(compileShow(windows,8,settings()).frames,compileShow(windows,8,settings(),null,structure).frames);
  assert.deepEqual(transitionFrame(baseline,enhanced,6,0),showFrameAt(baseline,6));
  assert.deepEqual(transitionFrame(baseline,enhanced,6,1),showFrameAt(enhanced,6));
});

test('Auto-Crossfade beginnt nur am Ende mit vorbereitetem, unbenutztem Zieldeck',()=>{
  const a={ready:true,paused:false,remaining:7,used:false},b={ready:true,paused:true,remaining:120,used:false};
  assert.equal(automaticFadeSource([a,b],0,8),0);
  assert.equal(automaticFadeSource([b,a],1,8),1);
  assert.equal(automaticFadeSource([a,b],.5,8),-1);
  assert.equal(automaticFadeSource([{...a,remaining:10},b],0,8),-1);
  for(const target of [{...b,ready:false},{...b,used:true},{...b,paused:false}])assert.equal(automaticFadeSource([a,target],0,8),-1);
  assert.equal(automaticFadeSource([{...a,paused:true},b],0,8),-1);
});
test('Zeitbasierter Crossfade erreicht beide Endpunkte ohne Überschwingen',()=>{
  assert.equal(crossfadePosition(0,1,0,8),0);
  assert.equal(crossfadePosition(0,1,4,8),.5);
  assert.equal(crossfadePosition(0,1,10,8),1);
  assert.equal(crossfadePosition(.6,0,4,8),.3);
  assert.equal(crossfadePosition(1,0,-1,8),1);
  assert.throws(()=>crossfadePosition(0,1,1,0));
});
