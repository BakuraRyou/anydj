import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--autoplay-policy=no-user-gesture-required','--mute-audio','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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

  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {createLightEditor}=await import('/light-editor.js');
    const {openSectionEditor}=await import('/section-editor.js');
    const {compileShow}=await import('/show-plan.js');
    const duration=12,windows=Array.from({length:600},(_,i)=>({rms:.12,bass:.02,flux:0,tone:.5,beatSeq:Math.floor(i/25)}));
    const plan=compileShow(windows,duration,{arrangement:'auto',mood:'auto',minimum:5,maximum:100,palette:'sunset',saturation:100,toneFollow:.8,smoothing:.5,speed:1,intensity:1,dynamics:'balanced'});
    const rate=8000,samples=rate*duration,buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
    const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+samples*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples*2,true);
    for(let i=0;i<samples;i++)v.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*3000,true);
    const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'})),audio=new Audio(url);document.body.append(audio);
    await audio.play();const before=audio.currentTime;
    let previewTime=0,previewPlan;
    const host=document.createElement('div');document.body.append(host);
    const editor=openSectionEditor({track:{name:'Running deck'},host,plan,externalAudio:audio,position:()=>audio.currentTime,onPreview:value=>{previewTime=value.time;previewPlan=value.plan;}});
    // The workspace relocates the curve and hides the compact preview card.
    const timeline=host.querySelector('.le-track');timeline.insertBefore(host.querySelector('.le-preview-card canvas'),timeline.querySelector('.le-phases'));
    host.querySelector('.le-preview-card').hidden=true;
    const openedPlaying=!audio.paused,button=host.querySelector('[data-play]').textContent;
    await new Promise(r=>setTimeout(r,350));
    const progressed=audio.currentTime>before+.15,following=Math.abs(previewTime-audio.currentTime)<.15,unchangedPlan=previewPlan===plan;
    audio.currentTime=6;await new Promise(r=>setTimeout(r,150));const followsSeek=Math.abs(previewTime-audio.currentTime)<.15;
    editor.destroy();const closedPlaying=!audio.paused,after=audio.currentTime;
    await new Promise(r=>setTimeout(r,200));const continued=audio.currentTime>after+.1;
    audio.pause();
    const pausedEditor=createLightEditor(host,{plan,externalAudio:audio});const staysPaused=audio.paused;pausedEditor.destroy();
    const ownedEditor=createLightEditor(host,{plan,audioSrc:url});await host.querySelector('[data-play]').onclick();ownedEditor.destroy();
    URL.revokeObjectURL(url);return {openedPlaying,button,progressed,following,unchangedPlan,followsSeek,closedPlaying,continued,staysPaused};
  })()`);
  assert.equal(result.openedPlaying,true);assert.match(result.button,/Pause/);assert.equal(result.progressed,true);assert.equal(result.following,true);assert.equal(result.closedPlaying,true);assert.equal(result.continued,true);assert.equal(result.staysPaused,true);
  assert.equal(result.unchangedPlan,true,'opening the Licht tab must preserve the live lighting plan');assert.equal(result.followsSeek,true,'the embedded preview follows deck seeks');
  assert.deepEqual(errors,[]);
  console.log('Light editor playback passed: running audio, live playhead, disposal preserves playback, paused audio stays paused.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
