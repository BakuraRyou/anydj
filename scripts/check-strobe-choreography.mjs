import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0,dataDir:'/tmp/anydj-strobe-browser-data'});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);
    chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.once('exit',()=>{clearTimeout(timer);reject(Error('Chrome exited'));});
  });
  ws=new WebSocket(endpoint);await once(ws,'open');
  let next=1;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  });
  const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  await c('Runtime.enable');await c('Page.enable');
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(await evaluate('({url:location.href,text:document.body?.innerText.slice(0,1500)})'))+' errors: '+JSON.stringify(errors));};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#openLightStage')");
  await evaluate("document.querySelector('#openLightStage').click()");
  await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click();document.querySelector('[data-workspace-tab=room]').click()");
  await wait("document.querySelector('[data-ar-room]')");
  const preset=await evaluate("JSON.parse(localStorage.getItem('anydj-ar-rooms-v1')).plans.find(p=>p.name==='Formationsbühne · 3 Ebenen')");
  assert.ok(preset,'the current room planner includes the new stage');
  assert.equal(Object.values(preset.positions).filter(p=>p.type==='moving').length,48);
  await evaluate(`(async()=>{
   const {strobeStageRoom}=await import('/dmx-room-presets.js');
   const {createRoomPreview}=await import('/dmx-ar-model.js');
   const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
   const {planFormationEntrances,FORMATION_NAMES}=await import('/dmx-strobe-choreography.js');
   for(const child of document.body.children)child.hidden=true;
   document.body.insertAdjacentHTML('beforeend','<main style="display:block;min-height:0;height:auto;background:#080e19;color:white;font:18px sans-serif;padding:18px"><h1 style="margin:0;font-size:22px;min-height:0;height:auto">Formationen · 3 Ebenen</h1><p style="margin:12px 0;height:auto;min-height:0">Gehaltene Strahlenbilder · Standard-Flackereinstellung 53 % · technische Vorschau ohne Audio</p><div id="frames" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div></main>');
   const room=strobeStageRoom();
   const states=[],preview=createRoomPreview();
   for(const beat of [.6,1.6,3.6,6]){
    const sequence={time:beat*.5,end:6,role:'groove',formationId:'crossed-fans',strobeSentence:'centre-out',progress:.5,continuing:true,sharedPassage:{composition:'fan'},entrances:[0,1.5,3,4.5].map(time=>({time,duration:.15,strength:1}))};
    sequence.formationEntrances=planFormationEntrances(sequence);sequence.formationEntries=sequence.formationEntrances.filter(e=>e.time<=sequence.time&&sequence.time<e.releaseEnd);
    const figure={presentation:'strobe',kind:'groove',rhythmBeat:beat,flicker:53,music:{sequence}};
    const presence={level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure};
    const source={id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'strobe',power:1,color:'#67aaff',movingShutter:1,movingPresenceBasePower:1,movingPresence:presence};
    const scene=preview({layout:{width:8,depth:6,positions:{}},lights:[source],crowd:[]},room,false,beat*.5);
    const card=document.createElement('section'),label=document.createElement('div'),canvas=document.createElement('canvas');
    canvas.width=600;canvas.height=330;canvas.style.width='100%';card.style.cssText='display:block;min-height:0;height:auto;padding:0;margin:0';
    label.textContent='Beat '+beat.toFixed(1)+' · '+scene.lights.filter(l=>l.type==='moving'&&l.power>.01).length+' aktive Strahlen';
    card.append(label,canvas);document.querySelector('#frames').append(card);
    renderStage3d(canvas.getContext('2d'),600,330,scene.layout,scene.lights,{mode:'dancer',x:0,y:3,eyeHeight:2,yaw:0,pitch:-.08,zoom:1},[],0);
    states.push(scene.lights.filter(l=>l.type==='moving').map(l=>({id:l.id,power:l.power,target:l.target})));
   }
   window.__strobeReview=states;
   window.__formationGallery=()=>{
    const traces=[];
    document.querySelector('#frames').innerHTML='';document.querySelector('#frames').style.gridTemplateColumns='1fr 1fr 1fr';
    document.querySelector('main:last-child h1').textContent='Formationen · räumliche Varianten';
    for(const [id,name] of Object.entries(FORMATION_NAMES)){
     const entry={time:0,formationStep:0,strength:1,holdEnd:4,releaseEnd:4.4};
     const sequence={time:1,role:'groove',sharedPassage:{composition:id},formationId:id,strobeSentence:'reveal',progress:1,continuing:true,formationEntrances:[entry],formationEntries:[entry]};
     const figure={presentation:'strobe',kind:'groove',flicker:53,music:{sequence}};
     const presence={level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure};
     const source={id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'strobe',power:1,color:'#67aaff',movingShutter:1,movingPresenceBasePower:1,movingPresence:presence};
     const scene=createRoomPreview()({layout:{width:8,depth:6,positions:{}},lights:[source],crowd:[]},room,false,0);
     traces.push(scene.lights.filter(l=>l.type==='moving').map(l=>[l.target.x,l.target.y,l.target.z??0].map(v=>Math.round(v*10000))));
     const card=document.createElement('div'),label=document.createElement('div'),canvas=document.createElement('canvas');
     canvas.width=400;canvas.height=220;canvas.style.width='100%';label.textContent=name;card.append(label,canvas);document.querySelector('#frames').append(card);
     renderStage3d(canvas.getContext('2d'),400,220,scene.layout,scene.lights,{mode:'dancer',x:0,y:3,eyeHeight:2,yaw:0,pitch:-.08,zoom:1},[],0);
    }
    return traces;
   };
  })()`);
  const states=await evaluate('window.__strobeReview');
  assert.equal(states.length,4);
  assert.ok(states.every(s=>s.length===48&&s.some(l=>l.power>.01)&&s.some(l=>l.power===0)));
  assert.deepEqual(states[0].map(l=>l.power),states[1].map(l=>l.power),'no flash between musical handovers');
  assert.notDeepEqual(states[0].map(l=>l.power),states[2].map(l=>l.power));
  assert.ok(states[0].some(l=>l.power>.95),'active beams retain full source brightness at 53 percent flicker');
  assert.ok(states[0].every((l,i)=>Math.hypot(...['x','y','z'].map(k=>(l.target[k]??0)-(states[1][i].target[k]??0)))<1e-8),'physical room targets remain held while pairs exchange');
  assert.deepEqual(errors,[]);
  await writeFile('reports/dmx-test-quality/strobo-three-levels.png',Buffer.from((await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  await writeFile('reports/dmx-test-quality/strobo-three-levels.json',JSON.stringify({method:'Isolated browser: current room planner preset plus four physical room frames through createRoomPreview and the software stage renderer; synthetic musical entrances 1.5 seconds apart, 53 percent flicker, no audio or hardware.',states},null,2));
  const gallery=await evaluate('window.__formationGallery()');
  assert.equal(new Set(gallery.map(t=>JSON.stringify(t))).size,16,'all sixteen pictures retain distinct physical room targets');
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:1750,deviceScaleFactor:1,mobile:false});
  await writeFile('reports/dmx-test-quality/formation-gallery.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('Formation stage passed: planner registration, 48 physical heads, changing mirrored selections and held targets, software render without browser errors.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
