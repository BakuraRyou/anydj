import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'wiz-dj-connection-'));
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const beforeIndex=process.argv.indexOf('--before');
  const previous=beforeIndex>=0?{scenes:await readFile(process.argv[beforeIndex+1],'utf8'),cues:await readFile(process.argv[beforeIndex+2],'utf8')}:null;
  if(previous){
    // Serve comparison modules on this test server; production CSP stays intact.
    const handlers=app.server.listeners('request');app.server.removeAllListeners('request');
    app.server.on('request',(req,res)=>{
      const source=req.url==='/__before-scenes.js'?previous.scenes:req.url==='/__before-cues.js'?previous.cues.replace('./dmx-light-scenes.js','./__before-scenes.js'):null;
      if(source!==null){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(source);return;}
      for(const handler of handlers)handler.call(app.server,req,res);
    });
  }
  const bassCheck=process.argv.includes('--bass');
  const planIndex=process.argv.indexOf('--plan');
  const recordedPlan=planIndex>=0?JSON.parse(await readFile(process.argv[planIndex+1],'utf8')):null;
  const audioIndex=process.argv.indexOf('--audio');
  const numberOption=(name,fallback)=>{const index=process.argv.indexOf(name);return index>=0?Number(process.argv[index+1]):fallback;};
  const clipStart=Math.max(0,numberOption('--start',0)),clipLength=numberOption('--length',recordedPlan?.duration??24),headCount=numberOption('--heads',7);
  const result=await evaluate(`(async()=>{
    const current=await import('/dmx-moving-cues.js'),activity=await import('/dmx-activity.js');
    const {lightingGestures}=await import('/dmx-light-scenes.js');
    const {createRoomPreview,newRoomPlan}=await import('/dmx-ar-model.js');
    const {movingDevicePoses,projectMovingHeads}=await import('/dmx-layout-model.js');
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    const {showFrameAt}=await import('/show-plan.js');
    const previous=${Boolean(previous)};
    const old=previous?await import('/__before-cues.js'):current;
    const oldScenes=previous?await import('/__before-scenes.js'):null;
    const duration=24,times=Array.from({length:48},(_,i)=>i*.5),salience=times.map(()=>.12);
    for(const t of [2.65,5.35,8.2,10.7,14.3,17.15,20.65]){times.push(t);salience.push(.9);}
    const events=times.map((time,i)=>({time,salience:salience[i]})).sort((a,b)=>a.time-b.time);
    const phrases=Array.from({length:3},(_,i)=>({start:i*8,end:(i+1)*8,energy:[.65,.85,.55][i],tone:[.25,.75,.45][i],movement:{character:'rhythmic',driving:.85},attention:{leader:['bass','drums','vocals'][i],confidence:.8}}));
    let plan={duration,sections:[{start:0,end:24,look:'flow',intensity:.7}],beatGrid:{downbeats:Array.from({length:13},(_,i)=>i*2)},arrangement:{
      times:events.map(e=>e.time),eventSalience:events.map(e=>e.salience),accents:events.map(()=>.6),patterns:{phrases},
      drama:{step:.1,intensity:Array.from({length:240},(_,i)=>phrases[Math.floor(i/80)].energy),percussion:Array(240).fill(.85),vocalShare:Array.from({length:240},(_,i)=>i>=160?.7:.1)}
    }};
    if(${bassCheck}){
      plan.arrangement.bassAttacks=[8.13,8.63,9.02,9.63,10.13,10.63,11.13,11.63,12.13,12.63,13.13,13.63,14.13,14.63,15.13].map(time=>({time,strength:.9}));
    }
    const {songPaletteAt}=await import('/song-palette.js');
    const {spatialColors,automaticPalette}=await import('/dmx-auto.js');
    const recordedPlan=${JSON.stringify(recordedPlan)};
    if(recordedPlan)plan=recordedPlan;
    const devices=Array.from({length:${headCount}},(_,i)=>({id:'h'+i})),room=newRoomPlan(10,10,4);
    devices.forEach((d,i)=>room.positions[d.id]={type:'moving',x:-3+6*i/Math.max(1,devices.length-1),y:8,height:2.8,rotation:0,size:{width:.34,depth:.34,height:.4}});
    const layout={width:10,depth:10,positions:room.positions};
    const mood=plan.showProfile==='show'?'show':'balanced';
    const nextCues=current.movingCues(plan,'auto',mood),oldCues=old.movingCues(plan,'auto',mood),gestures=lightingGestures(plan);
    const renders=[createRoomPreview(),createRoomPreview()],canvases=[document.createElement('canvas'),document.createElement('canvas')];
    for(const canvas of canvases){canvas.width=560;canvas.height=350;}
    const output=document.createElement('canvas');output.width=previous?1120:560;output.height=380;document.body.replaceChildren(output);document.body.style.cssText='margin:0;background:#101923';
    const ctx=output.getContext('2d'),camera={mode:'dancer',x:0,y:.5,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
    const stream=output.captureStream(0),track=stream.getVideoTracks()[0],chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2200000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};if(!recordedPlan)recorder.start();
    const positions=[],switches=[],frames=[];
    const clipStart=${clipStart},clipEnd=Math.min(plan.duration,clipStart+${clipLength});
    for(let frame=0;frame<clipEnd*20;frame++){
      const time=frame/20;
      for(const side of (previous?[0,1]:[1])){
        const pose=side?current.movingCueAt(nextCues,time):old.movingCueAt(oldCues,time);
        const mapped=movingDevicePoses(pose,devices,{formation:'designed',layout});
        const scene=oldScenes?.lightingSceneAt(plan,time);
        const presence=side||!scene?activity.movingPresenceAt({movingPlan:plan,songTime:time,look:'flow',movingMood:mood}):oldScenes.scenePresence(scene,plan,time);
        const exposure=(side?current:old).movingCueExposure(side?nextCues:oldCues,time);
        const songFrame=recordedPlan?showFrameAt(plan,time):null;
        const palette=recordedPlan?songPaletteAt(plan,time):null;
        const fixtureColors=songFrame?spatialColors({movingPlan:plan,songTime:time},devices.length,automaticPalette(songFrame,2,'peak',palette)):null;
        const rgb=songFrame?['r','g','b'].map(k=>songFrame[k]*songFrame.dimming/100):null;
        const basePower=rgb?Math.max(...rgb)/255:1;
        const color=rgb?'rgb('+rgb.map(v=>basePower?Math.round(v/basePower):0).join(',')+')':null;
        const lights=projectMovingHeads(layout,mapped,devices).map((l,i)=>({...l,type:'moving',motionPresentation:mood==='show'?'show':undefined,power:basePower,color:fixtureColors?'rgb('+fixtureColors[i].join(',')+')':color||(i%2?'rgb(255,179,40)':'rgb(30,183,255)'),movingPresence:presence,movingPresenceBasePower:basePower,movingShutter:exposure.level,cueTransit:exposure.transfer}));
        const rendered=renders[side]({layout,lights},room,false,time);
        renderStage3d(canvases[side].getContext('2d'),560,350,rendered.layout,rendered.lights,camera);
        if(side&&time>=8&&time<16)switches.push({time,powers:rendered.lights.map(l=>l.power)});
        if(side&&frame%10===0)positions.push(rendered.lights.map(l=>[l.target.x,l.target.y,l.target.z]));
      }
      ctx.fillStyle='#101923';ctx.fillRect(0,0,output.width,output.height);ctx.font='14px system-ui';ctx.fillStyle='#e1eaf1';
      if(previous){ctx.fillText('Bisherige Bewegung',14,21);ctx.drawImage(canvases[0],0,30);}
      const x=previous?560:0;ctx.fillText(recordedPlan?'Bewegung aus dem analysierten Audiosignal':'Neue Choreografie · synthetischer Musikverlauf',x+14,21);ctx.drawImage(canvases[1],x,30);
      if(recordedPlan&&time>=clipStart)frames.push(output.toDataURL('image/jpeg',.85).split(',')[1]);
      else if(!recordedPlan){track.requestFrame();await new Promise(r=>setTimeout(r,50));}
    }
    if(recordedPlan){stream.getTracks().forEach(t=>t.stop());return {frames,duration:clipEnd-clipStart,positions,gestures:[],switches};}
    const finished=new Promise(resolve=>recorder.onstop=resolve);recorder.stop();await finished;stream.getTracks().forEach(t=>t.stop());
    const blob=new Blob(chunks,{type:'video/webm'});
    const video=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
    return {video,switches,gestures:gestures.map(g=>({name:g.name,group:g.group,seconds:g.seconds})),positions};
  })()`);
  if(!recordedPlan)assert.ok(new Set(result.gestures.map(g=>g.name)).size>=2,'fixture changes its leading instrument');
  assert.ok(result.gestures.every(g=>g.seconds<=1.6));
  assert.ok(result.positions.every(p=>p.flat().every(Number.isFinite)));
  assert.ok(new Set(result.positions.map(p=>JSON.stringify(p.map(v=>v.map(n=>n.toFixed(1)))))).size>20);
  assert.deepEqual(errors,[]);
  if(bassCheck){
    const states=result.switches;
    assert.ok(states.some(s=>s.powers[0]>.5&&s.powers[1]===0),'first group switches alone');
    assert.ok(states.some(s=>s.powers[0]===0&&s.powers[1]>.5),'second group switches alone');
    assert.ok(states.every(s=>Math.max(...s.powers)>.3),'active passage never loses the whole rig');
  }
  if(recordedPlan){
    const directory=await mkdtemp(join(tmpdir(),'anydj-motion-frames-'));
    try{
      for(let i=0;i<result.frames.length;i++)await writeFile(join(directory,`frame-${String(i).padStart(5,'0')}.jpg`),Buffer.from(result.frames[i],'base64'));
      const args=['-v','error','-y','-framerate','20','-i',join(directory,'frame-%05d.jpg')];
      if(audioIndex>=0)args.push('-ss',String(clipStart),'-i',process.argv[audioIndex+1],'-map','0:v:0','-map','1:a:0');
      args.push('-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-t',String(result.duration),'/tmp/anydj-recorded-motion.mp4');
      await promisify(execFile)('ffmpeg',args);
      console.log(JSON.stringify({video:'/tmp/anydj-recorded-motion.mp4',frames:result.frames.length,duration:result.duration,audio:audioIndex>=0}));
    }finally{await rm(directory,{recursive:true,force:true});}
  }else{
  const file=bassCheck?'/tmp/anydj-bass-chase.webm':'/tmp/anydj-choreography-v26.webm';await writeFile(file,Buffer.from(result.video,'base64'));
  console.log(JSON.stringify({video:file,gestures:result.gestures.length,families:[...new Set(result.gestures.map(g=>g.name))],maxTravel:Math.max(...result.gestures.map(g=>g.seconds))}));
  }
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
