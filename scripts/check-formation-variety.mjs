import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {createApp} from '../server.mjs';
import {varietySong} from '../test/fixtures/formation-variety-song.mjs';

// Optional: exported plan, local audio path, playback start, duration or "full".
const [planFile,audioFile,startValue='40',durationValue='32',roomValue='arena',outputSuffix='']=process.argv.slice(2);
const saved=planFile?JSON.parse(await readFile(planFile,'utf8')):null;
const inputPlan=saved?(saved.plan??saved):varietySong();
const startTime=saved?Number(startValue):0;
const captureDuration=durationValue==='full'?inputPlan.duration-startTime:Number(durationValue);
assert.ok(Number.isFinite(startTime)&&startTime>=0&&captureDuration>0&&startTime+captureDuration<=inputPlan.duration);
assert.ok(['arena','club','club-open','large-club','combined','choreography','festival','festival-open'].includes(roomValue));
assert.match(outputSuffix,/^[a-z0-9-]*$/);
const roomLabel={arena:'Formationsarena',club:'Club-Bühne','club-open':'Club-Bühne ohne Ruhezonen','large-club':'Großclub',combined:'Panorama & Raumfächer',choreography:'Choreografie-Arena',festival:'Festival-Bühne','festival-open':'Festival-Bühne ohne Ruhezone'}[roomValue];
const sourceName=saved&&/\.mp3$/i.test(audioFile??'')?basename(audioFile):'dmx-test.mp3';
const caption=saved?sourceName+' · lokale Audioanalyse · '+roomLabel:'Ein durchgehender synthetischer Songabschnitt · 64 Sekunden · ohne Audio';
const escapedCaption=caption.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const galleryHtml='<main style="display:block;min-height:0;height:auto;background:#080e19;color:white;font:18px sans-serif;padding:18px"><h1 style="margin:0;font-size:22px">Formationen · Entwicklung innerhalb eines Liedes</h1><p style="margin:10px 0">'+escapedCaption+'</p><div id="directionShots" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div></main>';
const outputStem=(saved?'formation-'+sourceName.replace(/\.mp3$/i,'').toLowerCase().replace(/[^a-z0-9-]+/g,'-'):'formation-variety')+(roomValue==='arena'?'':'-'+roomValue)+(durationValue==='full'?'-full':'')+(outputSuffix?'-'+outputSuffix:'');
const shotTimes=saved?[10,43,65,89,110,135,173,189].filter(t=>t<inputPlan.duration):[4,12,20,28,36,44,52,60];
const app=await createApp({demo:true,previewPort:0,dataDir:'/tmp/anydj-strobe-browser-data'});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--enable-unsafe-swiftshader','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:1600,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#openLightStage')");
  await evaluate("document.querySelector('#openLightStage').click()");
  await wait("document.querySelector('#inlineLightStage')");
  await evaluate(`(async()=>{
   const {choreographyArenaRoom,roomSpectatorView,festivalStageRoom,combinedFormationRoom,formationArenaRoom,strobeStageRoom,clubStageRoom,clubStageRoomWithoutQuietZones,largeClubRoom}=await import('/dmx-room-presets.js');
   const {createARPlanner}=await import('/dmx-ar-planner.js');
   const roomKey='anydj-ar-rooms-v1',savedRooms=localStorage.getItem(roomKey),oldRoom=strobeStageRoom();
   oldRoom.name='Meine bearbeitete Bühne';oldRoom.positions['strobe-head-0-0'].x=-9;
   localStorage.setItem(roomKey,JSON.stringify({plans:[oldRoom],selected:oldRoom.id,enabled:true,
    clubRoomAdded:true,clubStageRoomAdded:true,clubStageOpenRoomAdded:true,hallDJRoomAdded:true,barnRoomAdded:true,festivalRoomAdded:true,strobeRoomAdded:true,choreographyArenaAdded:true,combinedFormationAdded:true}));
   const host=document.createElement('div');let planner=createARPlanner(host);
   const first=JSON.parse(localStorage.getItem(roomKey));planner.destroy();planner=createARPlanner(host);
   const second=JSON.parse(localStorage.getItem(roomKey));
   window.__arenaLibrary={selectedPreserved:planner.plan.id===oldRoom.id,
    editsPreserved:JSON.stringify(first.plans.find(p=>p.id===oldRoom.id))===JSON.stringify(oldRoom),
    addedOnce:second.plans.length===2&&second.plans.filter(p=>p.name==='Formationsarena · Raumfächer').length===1,
    listed:[...planner.root.querySelector('[data-ar-room]').options].some(o=>o.textContent==='Formationsarena · Raumfächer')};
   planner.destroy();
   localStorage.setItem(roomKey,JSON.stringify({...second,choreographyArenaAdded:false}));
   planner=createARPlanner(host);const showFirst=JSON.parse(localStorage.getItem(roomKey));planner.destroy();
   planner=createARPlanner(host);const showSecond=JSON.parse(localStorage.getItem(roomKey));
   window.__arenaLibrary.showAddedOnce=showFirst.plans.length===3&&showSecond.plans.length===3&&showSecond.choreographyArenaAdded===true;
   window.__arenaLibrary.showPreservedSelection=showSecond.selected===oldRoom.id&&JSON.stringify(showSecond.plans[0])===JSON.stringify(oldRoom);
   window.__arenaLibrary.showListed=[...planner.root.querySelector('[data-ar-room]').options].some(o=>o.textContent==='Choreografie-Arena · Beams, Wash & LED');
   planner.destroy();if(savedRooms===null)localStorage.removeItem(roomKey);else localStorage.setItem(roomKey,savedRooms);
   const {createRoomPreview,roomPlanLayout}=await import('/dmx-ar-model.js');
   const {createWebGlStage}=await import('/dmx-stage-webgl.js');
   const {createStageGpuScene}=await import('/dmx-stage-gpu-scene.js');
   const gpuCanvas=document.createElement('canvas'),gpu=createWebGlStage(gpuCanvas,()=>{}),geometry=createStageGpuScene();
   const renderStage3d=(ctx,width,height,layout,lights,camera,crowd,time)=>{
    if(gpuCanvas.width!==width)gpuCanvas.width=width;if(gpuCanvas.height!==height)gpuCanvas.height=height;
    gpu.render(geometry.build(width,height,layout,lights,camera,crowd,time));ctx.drawImage(gpuCanvas,0,0);
   };
   const {FORMATION_NAMES}=await import('/dmx-strobe-choreography.js');
   const {strobeScoreAt}=await import('/dmx-strobe-score.js');
   const {strobeConductor}=await import('/dmx-strobe-conductor.js');
   const plan=${JSON.stringify(inputPlan)};
   const actualSong=${!!saved};
   const {showFrameAt}=await import('/show-plan.js');
   const {songPaletteAt}=await import('/song-palette.js');
   const {automaticStage}=await import('/dmx-auto.js');
   const {movingPresenceAt}=await import('/dmx-activity.js');
   const room=({arena:formationArenaRoom,club:clubStageRoom,'club-open':clubStageRoomWithoutQuietZones,'large-club':largeClubRoom,combined:combinedFormationRoom,choreography:choreographyArenaRoom,festival:festivalStageRoom,'festival-open':()=>({...festivalStageRoom(),zones:[]})})[${JSON.stringify(roomValue)}]();
   const mountingRows=[...new Set(Object.values(room.positions).filter(p=>p.type==='moving').map(p=>p.y))];
   const scenes=strobeConductor(plan).formationScenes;
   window.__varietyScenes=scenes.map(s=>({start:s.start,end:s.end,formationId:s.formationId,program:s.formationProgram.kind,story:s.formationStory?.motion,act:s.formationStory?.act,chapter:s.formationStory?.chapter,variation:s.formationStory?.variation,scene:s.formationStory?.scene,action:s.formationStory?.action,musicalEvidence:s.formationStory?.musicalEvidence}));
   const camera=roomSpectatorView(roomPlanLayout(room));
   const draw=(time,canvas,preview)=>{
    const figure={...strobeScoreAt(plan,time),flicker:53};
    const sequence=figure.music.sequence;
    const presence={level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure};
    const source={id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
     motionPresentation:'strobe',power:1,color:'#2896ff',strobePalette:[[40,150,255],[255,100,20]],movingShutter:1,movingPresenceBasePower:1,movingPresence:presence};
    if(actualSong){
     const frame=showFrameAt(plan,time,53),section=plan.sections.find(s=>time>=s.start&&time<s.end);
     const stream={frame,weight:1,movingPlan:plan,songTime:time,stageMode:'strobe',movingMood:'balanced',flicker:53,
      look:section?.look,sectionProgress:section?(time-section.start)/(section.end-section.start):0,palette:songPaletteAt(plan,time)};
     const result=automaticStage([stream],2,{devices:[{id:'source',type:'moving',cells:1}]},'strobe',{movingSource:true});
     const f=result.frames[0][0];source.power=f.state===false?0:f.dimming/100*Math.max(f.r,f.g,f.b)/255;
     source.movingPresenceBasePower=source.power;source.movingPresence=movingPresenceAt(stream);
     source.strobePalette=result.palette?.map(rgb=>{const peak=Math.max(...rgb);return rgb.map(v=>peak?Math.round(v*255/peak):0);});
     source.color='rgb('+[f.r,f.g,f.b].join(',')+')';
    }
    const scene=preview({layout:{width:8,depth:6,positions:{}},lights:[source],crowd:[]},room,false,time);
    renderStage3d(canvas.getContext('2d'),canvas.width,canvas.height,scene.layout,scene.lights,camera,[],time);
    const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,canvas.width,36);
    ctx.font='18px sans-serif';ctx.fillStyle='white';ctx.fillText(FORMATION_NAMES[sequence.formationId]+' · '+(sequence.formationStory?.action?.kind??sequence.formationStory?.motion??sequence.role)+' · '+(sequence.formationStory?.act??'')+' · '+time.toFixed(1)+' s',12,25);
    return scene.lights.filter(l=>l.type==='moving');
   };
   for(const child of document.body.children)child.hidden=true;
   document.body.insertAdjacentHTML('beforeend',${JSON.stringify(galleryHtml)});
   const states=[];
   for(const time of ${JSON.stringify(shotTimes)}){
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=330;canvas.style.width='100%';
    document.querySelector('#directionShots').append(canvas);
    const heads=draw(time,canvas,createRoomPreview());
    states.push({time,targets:heads.map(l=>[l.target.x,l.target.y,l.target.z??0].map(v=>Math.round(v*10000))),visible:heads.filter(l=>l.power>.8).length,maximum:Math.max(...heads.map(l=>l.power)),
     rows:mountingRows.map(y=>({y,visible:heads.filter(l=>l.position.y===y&&l.power>.8).length,
      colors:[...new Set(heads.filter(l=>l.position.y===y).map(l=>l.color))]}))});
   }
   window.__directionStates=states;
   window.__recordDirection=async()=>{
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;
    const stream=canvas.captureStream(12),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const stopped=new Promise(resolve=>recorder.onstop=resolve),preview=createRoomPreview();
    let frames=0,lastHeads,lastTime;const speeds=[];const started=performance.now();recorder.start();
    while(performance.now()-started<${captureDuration*1000}){
     const time=${startTime}+Math.min(${captureDuration-.01},(performance.now()-started)/1000);
     const heads=draw(time,canvas,preview);frames++;
     if(lastHeads&&time>lastTime){
      let sum=0,count=0;
      const axis=l=>[l.target.x-l.position.x,l.target.y-l.position.y,(l.target.z??0)-(l.emissionHeight??l.position.height)];
      heads.forEach((l,i)=>{
       if(l.power<.1||lastHeads[i].power<.1)return;
       const a=axis(l),b=axis(lastHeads[i]),n=Math.hypot(...a)*Math.hypot(...b);
       if(n>0){sum+=Math.acos(Math.max(-1,Math.min(1,a.reduce((v,x,k)=>v+x*b[k],0)/n)))*180/Math.PI/(time-lastTime);count++;}
      });
      if(count)speeds.push({time,meanDegreesPerSecond:sum/count,visible:count});
     }
     lastHeads=heads;lastTime=time;
     await new Promise(resolve=>setTimeout(resolve,30));
    }
    recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
    const blob=new Blob(chunks,{type:'video/webm'}),reader=new FileReader();
    const data=await new Promise(resolve=>{reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
    return {frames,data,speeds};
   };
  })()`);
  const library=await evaluate('window.__arenaLibrary');
  assert.ok(Object.values(library).every(Boolean),'room planner adds the arena once and preserves selection and edits: '+JSON.stringify(library));
  const states=await evaluate('window.__directionStates');
  const scenes=await evaluate('window.__varietyScenes');
  assert.ok(scenes.length>=6);
  if(!saved)assert.equal(new Set(scenes.map(s=>s.act)).size,4);
  else assert.ok(new Set(scenes.map(s=>s.act)).size>=2,'measured musical development reaches the story without requiring a fixed four-act cycle');
  assert.ok(scenes.every(s=>s.story));
  if(saved)assert.ok(scenes.every(s=>s.musicalEvidence),'every actual-song picture records its audio evidence');
  assert.ok(new Set(states.map(s=>JSON.stringify(s.targets))).size>=5,'distinct pictures reach the physical room');
  if(!saved)assert.ok(states.every(s=>s.maximum>.9),'all passages retain bright active beams');
  assert.ok(states.every(s=>Number.isFinite(s.maximum)));
  assert.ok(states.every(s=>s.rows.every(r=>r.colors.length===1)),'each plane retains its color role');
  assert.deepEqual(errors,[]);
  await writeFile(`reports/dmx-test-quality/${outputStem}.png`,Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const recording=await evaluate('window.__recordDirection()');
  assert.ok(recording.frames>=48,'moving preview renders enough frames to judge the handovers');
  const video=Buffer.from(recording.data.split(',')[1],'base64');assert.ok(video.length>10000);
  await writeFile(`reports/dmx-test-quality/${outputStem}.webm`,video);
  await writeFile(`reports/dmx-test-quality/${outputStem}.json`,JSON.stringify({method:'Physical room preview, WebGL renderer (SwiftShader), normal playback score, 53 percent flicker, no hardware validation.',source:saved?sourceName+', local audio analysis':'synthetic constant section',interval:[startTime,startTime+captureDuration],library,scenes,states,frames:recording.frames,videoBytes:video.length,motionSamples:recording.speeds},null,2));
  if(audioFile){
   const ffmpeg=spawn('ffmpeg',['-v','error','-i',`reports/dmx-test-quality/${outputStem}.webm`,'-ss',String(startTime),'-i',audioFile,
    '-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-shortest','-y',`reports/dmx-test-quality/${outputStem}.mp4`],{stdio:'inherit'});
   const [code]=await once(ffmpeg,'close');assert.equal(code,0,'synchronized audio mux succeeds');
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'Within-song formation variety passed',scenes,frames:recording.frames,videoBytes:video.length}));

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
