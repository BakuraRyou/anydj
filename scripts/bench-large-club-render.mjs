// Synthetic transitions in the actual 192-light preset, including CPU scene mapping.
// gl.getError forces a readback after finish; submission-only timings underreport GPU cost.
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

// CI: VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/bench-large-club-render.mjs
const profile=await mkdtemp(join(tmpdir(),'anydj-stage-gpu-'));
const chrome=spawn('/usr/bin/google-chrome',[...(process.env.DISPLAY?[]:['--headless=new']),'--no-sandbox','--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
if(process.env.GPU_DEBUG)chrome.stderr.on('data',data=>process.stderr.write(data));
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
  if(process.env.CLUB_PROFILE){await c('Profiler.enable');await c('Profiler.start');}
  const result=await evaluate(`(async()=>{
    const {largeClubRoom}=await import('/dmx-room-presets.js');
    const {applyRoomPlan}=await import('/dmx-ar-model.js');
    const {createStageGpuScene}=await import('/dmx-stage-gpu-scene.js');
    const {createWebGlStage}=await import('/dmx-stage-webgl.js');
    const plan=largeClubRoom(),camera={mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:0,pitch:-.1,zoom:1};
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;document.body.append(canvas);
    const backend=createWebGlStage(canvas,()=>{}),builder=createStageGpuScene(),gl=canvas.getContext('webgl'),results=[];let lastFrame;
    for(const phase of ${process.env.CLUB_SNAPSHOT_ONLY?JSON.stringify(['intense']):JSON.stringify(['quiet','intense','quiet-again','intense-again'])}){
      const timings=[],cpu=[],gpu=[];let vertices=0,beams=0;
      for(let f=0;f<${process.env.CLUB_SNAPSHOT_ONLY?2:65};f++){
        const begin=performance.now();
        const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},crowd:[],lights:['moving','spot','bar'].map((type,i)=>({id:type,type,position:{x:0,y:2,height:3},target:{x:Math.sin(f*.09)*3,y:3},power:phase.startsWith('quiet')?(i===0?.25:0):.95,color:i===0?'#00bddd':'#ff40a0'}))},plan);
        const frame=builder.build(1280,720,scene.layout,scene.lights,camera,[],f/60),built=performance.now();
        lastFrame=frame;backend.render(frame);gl.finish();if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error');const done=performance.now();
        vertices=frame.vertices.length/11;beams=frame.batches.filter(b=>b.volume).length;
        if(f>=${process.env.CLUB_SNAPSHOT_ONLY?0:15}){timings.push(done-begin);cpu.push(built-begin);gpu.push(done-built);}
        await new Promise(requestAnimationFrame);
      }
      const stats=a=>{a.sort((x,y)=>x-y);return {median:+a[Math.floor(a.length*.5)].toFixed(2),p95:+a[Math.floor(a.length*.95)].toFixed(2)};};
      results.push({phase,totalMs:stats(timings),cpuMs:stats(cpu),renderMs:stats(gpu),vertices,beams});
    }
    if(${!!process.env.CLUB_SNAPSHOT}){
      window.clubSnapshots={};const copy=document.createElement('canvas');copy.width=1280;copy.height=720;
      for(const [name,scale] of [['optimized',lastFrame.volumeScale],['full-haze',1]]){
        lastFrame.volumeScale=scale;backend.render(lastFrame);gl.finish();copy.getContext('2d').drawImage(canvas,0,0);window.clubSnapshots[name]=copy.toDataURL();
      }
    }
    backend.destroy();return {size:[1280,720],fixtures:192,results};
  })()`);
  if(process.env.CLUB_PROFILE){const {profile}=await c('Profiler.stop');await writeFile(process.env.CLUB_PROFILE,JSON.stringify(profile));}
  if(process.env.CLUB_SNAPSHOT)for(const [name,data] of Object.entries(await evaluate('window.clubSnapshots')))await writeFile(process.env.CLUB_SNAPSHOT+'-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
