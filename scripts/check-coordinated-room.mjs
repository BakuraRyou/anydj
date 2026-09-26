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


  await c('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  await evaluate(`(async()=>{
    const {roomSurfaceChoreography,newRoomPlan,roomPlanLayout}=await import('/dmx-ar-model.js');
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    document.body.replaceChildren();document.body.style.cssText='margin:0;background:#10202c;color:white;display:grid;grid-template-columns:1fr 1fr;font:16px sans-serif';
    const layout=roomPlanLayout(newRoomPlan(8,12,4));
    for(const y of [.4,.55,.7])for(const coherent of [false,true]){
      const block=document.createElement('div');block.textContent=(coherent?'Direkte Winkel':'Bisherige Raumfahrt')+' · gleiche Musikpose '+y;
      const canvas=document.createElement('canvas');canvas.width=680;canvas.height=295;block.append(canvas);document.body.append(block);
      const lights=Array.from({length:7},(_,i)=>{
        const x=.2+i*.1;
        return roomSurfaceChoreography({id:'head-'+i,type:'moving',motionFormation:coherent?'coherent':undefined,position:{x:i-3,y:10,height:2.5},target:{x:(x-.5)*8,y:y*12},motionUV:{x,y},power:.75,color:'rgb(30,230,200)'},layout);
      });
      renderStage3d(canvas.getContext('2d'),680,295,layout,lights,{mode:'dancer',x:0,y:.4,eyeHeight:1.7,yaw:0,pitch:.02,zoom:1});
    }
  })()`);
  await writeFile('/tmp/anydj-coordinated-room.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);console.log('Seven-head projection comparison rendered without browser errors.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
