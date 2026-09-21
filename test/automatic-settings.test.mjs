import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticSettings } from '../public/automatic-settings.js';
import { compileShow } from '../public/show-plan.js';
import { settings, MusicSession } from '../lib/music.mjs';

const quiet=Array.from({length:1000},()=>({rms:.08,bass:.01,flatness:.1,harmonicConfidence:.1,beatSeq:0}));
const melodic=quiet.map(w=>({...w,harmonicConfidence:.85,leadConfidence:.8}));
const rhythmic=quiet.map((w,i)=>({...w,bpm:125,confidence:.9,beatSeq:Math.floor(i/24),bands:[.5,.2,.1,.1,.1]}));
test('default brightness allows 100 percent while explicit limits are preserved',()=>{
  assert.equal(settings({}).maximum,100);
  for(const windows of [quiet,melodic,rhythmic,[]]){
    assert.equal(automaticSettings(windows).options.maximum,100);
    assert.equal(automaticSettings(windows,{maximum:60}).options.maximum,60);
  }
});
test('Unterschiedliche Musik erhält passende unterschiedliche Einstellungen innerhalb der Gerätegrenzen',()=>{
  const a=automaticSettings(quiet,{minimum:12,maximum:55},[]);
  const b=automaticSettings(melodic,{},[]);
  const c=automaticSettings(rhythmic,{},Array.from({length:40},(_,i)=>i*.48));
  assert.equal(a.kind,'calm');assert.equal(b.kind,'flow');assert.equal(c.kind,'pulse');
  assert.equal(a.options.minimum,12);assert.equal(a.options.maximum,55);
  assert.ok(a.options.smoothing>c.options.smoothing);
  assert.ok(a.options.saturation<c.options.saturation);
  for(const design of [a,b,c,automaticSettings([])])assert.doesNotThrow(()=>settings(design.options));
});
test('Beat This! bestimmt die Automatik auch bei abweichendem heuristischem Tempo',()=>{
  const low=rhythmic.map(w=>({...w,bpm:60,confidence:0}));
  assert.equal(automaticSettings(low,{},Array.from({length:40},(_,i)=>i*.48)).kind,'pulse');
  assert.notEqual(automaticSettings(low,{},[]).kind,'pulse');
});
test('Automatik berechnet pro Lied neu; manuelle Werte und Beat-Zeitpunkte bleiben gezielt nutzbar',()=>{
  const grid={source:'beat-this',version:1,duration:20,beats:Array.from({length:40},(_,i)=>i*.48),downbeats:[0,1.92]};
  const auto=compileShow(rhythmic,20,settings({arrangement:'auto',saturation:20,minimum:10,maximum:60}),grid);
  assert.equal(auto.automatic.kind,'pulse');assert.ok(auto.effectiveOptions.saturation>80);
  assert.deepEqual(auto.beatGrid,grid);assert.ok(auto.frames.every(f=>f.dimming>=10&&f.dimming<=60));
  const manual=compileShow(rhythmic,20,settings({arrangement:'manual',saturation:20}),grid);
  assert.equal(manual.automatic,null);assert.equal(manual.effectiveOptions.saturation,20);
  const next=compileShow(quiet,20,settings({arrangement:'auto'}));
  assert.equal(next.automatic.kind,'calm');assert.ok(next.frames.at(-1).dimming>5);assert.ok(new Set(next.frames.slice(-40).map(f=>f.dimming)).size<=2);
});
test('Live-Automatik bestätigt Moduswechsel und lässt sich manuell übersteuern',async()=>{
  const session=new MusicSession({inspect:async()=>({pilot:{state:false},capabilities:{color:true,brightness:true}}),exchange:async()=>({})},{tickMs:100000});
  const {id}=await session.start('192.168.1.2','file',{arrangement:'auto'});
  try {
    const s=session.session;
    for(let i=0;i<70;i++){
      session.frame(id,{rms:.1,bass:.04,bpm:125,confidence:.9,beatSeq:i});
      if(i===65)s.autoUpdated=0;
      session.tick(s);await s.inFlight;
      if(i===31)assert.equal(s.automatic.kind,'calm');
    }
    assert.equal(session.status(id).automatic.kind,'pulse');
    session.configure(id,{arrangement:'manual',mode:'soft',saturation:25});
    assert.equal(session.status(id).automatic,null);assert.equal(s.config.saturation,25);
  } finally {await session.stop(id);}
});
