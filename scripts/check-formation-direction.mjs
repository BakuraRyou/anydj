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
  await evaluate(`(async()=>{
   const {strobeStageRoom}=await import('/dmx-room-presets.js');
   const {createRoomPreview}=await import('/dmx-ar-model.js');
   const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
   const {formationProgramFor,planFormationEntrances}=await import('/dmx-strobe-choreography.js');
   const room=strobeStageRoom();
   const descriptions=[['Ruhige Phrase','held','breath','vaulted-roof','verse'],['Dialog','groove','exchange','open-fan','verse'],
    ['Aufbau','build','opening','crossed-fans','bridge'],['Höhepunkt','arrival','wave','diamond','chorus']];
   const sequences=descriptions.map(([name,role,sequence,formationId,part],i)=>{
    const s={name,role,formationId,start:i*4,end:i*4+4,minimumHold:1.1,continuing:false,
     sharedPassage:{sequence,intent:{attention:{leader:'drums'}}},phraseArt:{function:part},
     entrances:Array.from({length:8},(_,j)=>({time:i*4+j*.5,duration:.2,strength:1}))};
    s.formationProgram=formationProgramFor(s);s.formationEntrances=planFormationEntrances(s);return s;
   });
   const camera={mode:'dancer',x:0,y:3,eyeHeight:2,yaw:0,pitch:-.08,zoom:1};
   const draw=(time,canvas,preview)=>{
    const index=Math.min(3,Math.floor(time/4)),base=sequences[index];
    const sequence={...base,time,age:time-base.start,progress:(time-base.start)/4,previous:sequences[index-1],
     formationEntries:base.formationEntrances.filter(e=>e.time<=time&&time<e.releaseEnd)};
    const figure={presentation:'strobe',kind:base.role==='held'?'calm':'groove',flicker:53,music:{sequence}};
    const presence={level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure};
    const source={id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
     motionPresentation:'strobe',power:1,color:'#2896ff',strobePalette:[[40,150,255],[255,100,20]],movingShutter:1,movingPresenceBasePower:1,movingPresence:presence};
    const scene=preview({layout:{width:8,depth:6,positions:{}},lights:[source],crowd:[]},room,false,time);
    renderStage3d(canvas.getContext('2d'),canvas.width,canvas.height,scene.layout,scene.lights,camera,[],time);
    const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,canvas.width,36);
    ctx.font='18px sans-serif';ctx.fillStyle='white';ctx.fillText(base.name+' · '+base.formationProgram.kind,12,25);
    return scene.lights.filter(l=>l.type==='moving');
   };
   for(const child of document.body.children)child.hidden=true;
   document.body.insertAdjacentHTML('beforeend','<main style="display:block;min-height:0;height:auto;background:#080e19;color:white;font:18px sans-serif;padding:18px"><h1 style="margin:0;font-size:22px">Formationen · Regie über mehrere Ebenen</h1><p style="margin:10px 0">Synthetische Phrasen · 53 % Flackereinstellung · technische Vorschau ohne Audio</p><div id="directionShots" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div></main>');
   const states=[];
   for(const time of [1,5,10.8,13]){
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=330;canvas.style.width='100%';
    document.querySelector('#directionShots').append(canvas);
    const heads=draw(time,canvas,createRoomPreview());
    states.push({time,visible:heads.filter(l=>l.power>.8).length,maximum:Math.max(...heads.map(l=>l.power)),
     rows:[27,30,33].map(y=>({y,visible:heads.filter(l=>l.position.y===y&&l.power>.8).length,
      colors:[...new Set(heads.filter(l=>l.position.y===y).map(l=>l.color))]}))});
   }
   window.__directionStates=states;
   window.__recordDirection=async()=>{
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;
    const stream=canvas.captureStream(12),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const stopped=new Promise(resolve=>recorder.onstop=resolve),preview=createRoomPreview();
    let frames=0;const started=performance.now();recorder.start();
    while(performance.now()-started<16000){
     draw(Math.min(15.99,(performance.now()-started)/1000),canvas,preview);frames++;
     await new Promise(resolve=>setTimeout(resolve,30));
    }
    recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
    const blob=new Blob(chunks,{type:'video/webm'}),reader=new FileReader();
    const data=await new Promise(resolve=>{reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
    return {frames,data};
   };
  })()`);
  const states=await evaluate('window.__directionStates');
  assert.ok(states[0].visible<states[3].visible,'arrival reveals a larger complete picture');
  assert.ok(states.every(s=>s.maximum>.95),'all passages retain bright active beams');
  assert.ok(states.every(s=>s.rows.every(r=>r.colors.length===1)),'each plane retains its color role');
  assert.deepEqual(errors,[]);
  await writeFile('reports/dmx-test-quality/formation-direction.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const recording=await evaluate('window.__recordDirection()');
  assert.ok(recording.frames>=48,'moving preview renders enough frames to judge the handovers');
  const video=Buffer.from(recording.data.split(',')[1],'base64');assert.ok(video.length>10000);
  await writeFile('reports/dmx-test-quality/formation-direction.webm',video);
  await writeFile('reports/dmx-test-quality/formation-direction.json',JSON.stringify({method:'Physical room preview, software renderer, four synthetic musical passages, 53 percent flicker, no audio or hardware validation.',states,frames:recording.frames,videoBytes:video.length},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'Formation direction passed',states,frames:recording.frames,videoBytes:video.length}));

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
