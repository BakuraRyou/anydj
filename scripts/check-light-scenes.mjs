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


  await c('Emulation.setDeviceMetricsOverride',{width:1400,height:1050,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const output=await evaluate(`(async()=>{
    const {lightingScenes,scenePose}=await import('/dmx-light-scenes.js');
    const {movingPresenceAt}=await import('/dmx-activity.js');
    const {movingDevicePoses,projectMovingHeads}=await import('/dmx-layout-model.js');
    const {createRoomPreview,newRoomPlan}=await import('/dmx-ar-model.js');
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    const looks=['quiet','flow','lift','peak','flow','break'],energies=[.2,.55,.55,.9,.5,.05],drives=[.1,.8,.7,.9,.15,.05];
    const sections=looks.map((look,i)=>({start:i*12,end:(i+1)*12,look,intensity:energies[i]}));
    const plan={duration:72,sections,beatGrid:{downbeats:Array.from({length:37},(_,i)=>i*2)},arrangement:{blackouts:[{start:60,end:72}],patterns:{phrases:sections.map((s,i)=>({...s,energy:energies[i],movement:{character:i===4?'atmospheric':'rhythmic',driving:drives[i]}}))}}};
    plan.sections[2].buildEvidence={levels:[0,.25,.5,.8,1]};
    const scenes=lightingScenes(plan),room=newRoomPlan(10,12,4),devices=Array.from({length:7},(_,i)=>({id:'h'+i}));
    devices.forEach((d,i)=>room.positions[d.id]={type:'moving',x:i-3,y:10,height:2.5,rotation:0,size:{width:.34,depth:.34,height:.4}});
    const layout={width:10,depth:12,positions:room.positions};
    document.body.replaceChildren();document.body.style.cssText='margin:0;background:#10202c;color:white;display:grid;grid-template-columns:1fr 1fr;font:16px sans-serif';
    const names=['Stehender Akzent','Antwortende Gruppen','Wachsender Aufbau','Kraeftiger Einsatz','Gemeinsame Fahrt','Dunkelheit'];
    return scenes.map((scene,index)=>{
      const time=scene.start+7.5,presence=movingPresenceAt({movingPlan:plan,songTime:time,look:looks[index]});
      const poses=movingDevicePoses(scenePose(scene,time),devices,{formation:'designed',layout});
      const lights=projectMovingHeads(layout,poses,devices).map(l=>({...l,type:'moving',power:1,color:'rgb(70,210,230)',movingPresence:presence,movingPresenceBasePower:1}));
      const render=createRoomPreview()({layout,lights},room,false,time);
      const block=document.createElement('div');block.textContent=names[index];const canvas=document.createElement('canvas');canvas.width=680;canvas.height=315;block.append(canvas);document.body.append(block);
      renderStage3d(canvas.getContext('2d'),680,315,render.layout,render.lights,{mode:'dancer',x:0,y:.4,eyeHeight:1.7,yaw:0,pitch:.02,zoom:1});
      return {kind:scene.kind,lit:render.lights.filter(l=>l.power>0).length};
    });
  })()`);
  assert.deepEqual(output.map(s=>s.kind),['sculpture','groove','build','impact','sweep','silence']);
  assert.ok(output[0].lit>=1&&output[0].lit<=2);assert.equal(output[1].lit,7);assert.equal(output[3].lit,7);assert.equal(output[5].lit,0);
  await writeFile('/tmp/anydj-light-scenes.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);console.log('Six distinct musical scenes rendered through seven-head room projection; occupancy verified.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
