import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
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


  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  await evaluate(`(async()=>{
    const {createStage3d}=await import('/dmx-stage-3d.js');
    document.body.replaceChildren();localStorage.clear();const css=document.createElement('link');css.rel='stylesheet';css.href='/style.css';document.head.append(css);
    const host=document.createElement('main'),controls=document.createElement('div');document.body.append(host,controls);
    window.surfaceStage=createStage3d(host,controls,{getLayout:()=>({width:8,depth:6,height:3,positions:{}}),mountLayout:()=>{},mountLighting:()=>{}});
    await surfaceStage.setEnabled(true);surfaceStage.open();
    window.feedSurface=y=>surfaceStage.update([],Array.from({length:4},(_,i)=>({id:'head-'+i,position:{x:(i-1.5)*1.2,y:5,height:2},target:{x:(i-1.5)*1.2,y:1},motionUV:{x:.2+i*.2,y},color:i%2?'rgb(255,30,0)':'rgb(0,220,255)',power:1})),{});
    feedSurface(.5);
  })()`);
  await wait("document.querySelector('.stage-3d canvas').width>500");
  await evaluate("document.querySelector('[data-share-start]').click()");
  await wait("document.querySelector('[data-share-code]').textContent.length===6");
  await evaluate(`(async()=>{const pair=await (await fetch('/api/vr-preview/test-connect')).json();window.surfaceFrames=[];window.surfaceStream=new EventSource('/api/vr-preview/stream?id='+pair.id);surfaceStream.onmessage=e=>surfaceFrames.push(JSON.parse(e.data).scene);})()`);
  await wait("surfaceFrames.some(s=>s.lights.length===4&&s.lights.every(l=>l.targetSurface==='wall'&&l.target.z>1&&l.power===1))");
  await new Promise(r=>setTimeout(r,200));
  const wall=await evaluate("document.querySelector('.stage-3d canvas').toDataURL()");
  await writeFile('/tmp/anydj-surface-wall.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("feedSurface(.95)");
  await wait("surfaceFrames.some(s=>s.lights.every(l=>l.targetSurface==='ceiling'&&Math.abs(l.target.z-3)<.001))");
  await evaluate("document.querySelector('[data-dancer]').click()");
  await new Promise(r=>setTimeout(r,250));
  assert.notEqual(await evaluate("document.querySelector('.stage-3d canvas').toDataURL()"),wall);
  await writeFile('/tmp/anydj-surface-ceiling.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("feedSurface(.05)");
  await wait("surfaceFrames.some(s=>s.lights.length===4&&s.lights.every(l=>l.targetSurface==='floor'&&Math.abs(l.target.z)<.001&&l.power===1))");
  await evaluate("feedSurface(.5)");
  await wait("surfaceFrames.at(-1).lights.every(l=>l.targetSurface==='wall'&&l.power===1)");
  const musical=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const plan={duration:24,beatGrid:{beats:Array.from({length:49},(_,i)=>i/2),downbeats:Array.from({length:13},(_,i)=>i*2)},sections:[{start:0,end:8,look:'held'},{start:8,end:16,look:'lift'},{start:16,end:24,look:'peak'}]};
    plan.arrangement={times:Array.from({length:48},(_,i)=>i*.5),accents:Array(48).fill(.6),patterns:{phrases:plan.sections.map((section,i)=>({...section,section:i,energy:.4,tone:.8,movement:{character:i===0?'atmospheric':'rhythmic',driving:.5}}))}};
    let preview=[];
    const heads=createMovingHeads(scene,controls,{getPlans:()=>[plan],getDevices:()=>Array.from({length:9},(_,i)=>({id:'musical-'+i,group:i%3})),getPreviewEnabled:()=>true,getLayout:()=>({width:8,depth:6,positions:{}}),onPreview:value=>preview=value});
    const deadline=performance.now()+3000;
    while(!scene.textContent.includes('Choreografie bereit')){if(performance.now()>deadline)throw Error('Music preparation timeout');await new Promise(r=>setTimeout(r,20));}
    const frame={state:true,dimming:100,r:20,g:255,b:20};
    const sample=(songTime,time,blackout=false)=>heads.update([],frame,time,blackout,[{frame,weight:1,movingPlan:plan,songTime}]);
    sample(17,1);sample(17.05,1.05);
    const playing=preview.length===9&&preview.every(l=>l.motionAhead?.seconds===.12);
    sample(17.05,1.1);const paused=preview.every(l=>!l.motionAhead);
    sample(17.1,1.15,true);const blackout=preview.every(l=>!l.motionAhead&&l.power===0);
    sample(4,1.2);sample(4.05,1.25);
    for(let i=0;i<50;i++)sample(4.1+i*.05,1.3+i*.05);
    const held=preview.map(l=>({...l.motionUV}));
    sample(6.6,3.8);
    const coherent=preview.every((l,i)=>l.motionFormation==='designed'&&Number.isFinite(l.motionUV.x)&&Number.isFinite(l.motionUV.y)&&Math.abs(l.motionUV.x-held[i].x)<1e-8&&Math.abs(l.motionUV.y-held[i].y)<1e-8);
    const authored=preview.every(l=>l.roomFigure===undefined);
    heads.destroy();return {playing,paused,blackout,coherent,authored};
  })()`);
  assert.deepEqual(musical,{playing:true,paused:true,blackout:true,coherent:true,authored:true});
  await evaluate(`(async()=>{
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=650;
    document.body.replaceChildren(canvas);
    const targets=[{x:-3,y:7.5,z:0},{x:3,y:7.5,z:0},{x:3,y:8,z:1.6},{x:-3,y:7.5,z:3}];
    const lights=targets.map((target,i)=>({id:'corner-'+i,type:'moving',position:{x:(i-1.5)*.5,y:5,height:2},target,aimed:true,aimRotation:Math.atan2(target.x-(i-1.5)*.5,5-target.y)*180/Math.PI,color:'rgb(50,255,40)',power:1}));
    renderStage3d(canvas.getContext('2d'),1100,650,{width:6,depth:8,height:3,room:true,positions:{}},lights,{mode:'dancer',x:0,y:.4,eyeHeight:1.7,yaw:0,pitch:.02,zoom:1});
  })()`);
  await writeFile('/tmp/anydj-physical-corners.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const placed=await evaluate(`(async()=>{
    const {createRoomPreview,newRoomPlan}=await import('/dmx-ar-model.js');
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    const plan=newRoomPlan(10,10,4),lights=[];
    for(let i=0;i<9;i++){
      const moving=i%2===0,id='placed-'+i,position={type:moving?'moving':'spot',x:(i-4)*.8,y:7,height:2.5,rotation:0,size:{width:.3,depth:.3,height:.4},target:{x:-3,y:1}};
      plan.positions[id]=position;
      lights.push({id,type:position.type,position,target:position.target,...(moving?{motionUV:{x:[.2,.35,.15,.65,.8][i/2],y:.45},roomFigure:'fan'}:{}),color:'rgb(255,220,35)',power:moving?1:.25});
    }
    const scene=createRoomPreview()({layout:{width:10,depth:10,positions:{}},lights},plan,false,0);
    const canvas=document.querySelector('canvas');
    renderStage3d(canvas.getContext('2d'),1100,650,scene.layout,scene.lights,{mode:'dancer',x:0,y:9.8,eyeHeight:1.7,yaw:Math.PI,pitch:0,zoom:1});
    const heads=scene.lights.filter(l=>l.type==='moving');return {count:heads.length,x:heads[2].target.x,surface:heads[2].targetSurface};
  })()`);
  assert.equal(placed.count,5);assert.ok(Math.abs(placed.x)<1e-8);assert.equal(placed.surface,'wall');
  await writeFile('/tmp/anydj-five-saved-targets.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const rotation=await evaluate(`(async()=>{
    const {createARPlanner}=await import('/dmx-ar-planner.js');
    const {newRoomPlan}=await import('/dmx-ar-model.js');
    const host=document.createElement('div');document.body.append(host);
    let planner=createARPlanner(host),plan=newRoomPlan(8,6,4);
    plan.positions.mover={type:'moving',x:1,y:5,height:2,rotation:0,target:{x:-2,y:1},size:{width:.4,depth:.3,height:.4}};
    planner.use(plan);planner.openStep(2);
    const root=planner.root,input=root.querySelector('[data-ar-rotation]');
    const visible=!input.closest('label').hidden;
    input.value='90';input.dispatchEvent(new Event('change'));
    const target=JSON.stringify(planner.plan.positions.mover.target),stored=planner.plan.positions.mover.rotation;
    const map=root.querySelector('[data-device-id="mover"] rect').getAttribute('transform').startsWith('rotate(-90 ');
    planner.destroy();planner=createARPlanner(host);planner.openStep(2);
    const restored=Number(planner.root.querySelector('[data-ar-rotation]').value);
    planner.destroy();host.remove();return {visible,stored,map,restored,target};
  })()`);
  assert.deepEqual(rotation,{visible:true,stored:90,map:true,restored:90,target:JSON.stringify({x:-2,y:1})});
  await evaluate("surfaceStream.close();surfaceStage.destroy()");
  assert.deepEqual(errors,[]);
  console.log('Real stage component: four illuminated targets visit wall, ceiling, floor and wall again in desktop/VR output; browser renders without errors.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
