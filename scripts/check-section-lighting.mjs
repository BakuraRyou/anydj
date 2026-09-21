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
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});
const lamp=app.client.lights.get('192.168.178.50');app.client.lights.clear();
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
  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.querySelector('#trackList')&&document.readyState==='complete'");
  await evaluate(`(async()=>{
    const {compileShow}=await import('/show-plan.js'),lib=await import('/dj-library.js');
    const duration=24,beats=Array.from({length:48},(_,i)=>i*.5+.003);
    const windows=Array.from({length:1200},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
    const options={arrangement:'auto',mood:'auto',minimum:5,maximum:75};
    const track={id:'section-test',name:'Section test.mp3',size:1234,lastModified:1,order:0};
    track.basePlan=compileShow(windows,duration,{...options,palette:'sunset',saturation:100,toneFollow:.8,smoothing:.5,speed:1,intensity:1,dynamics:'balanced'},
      {version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)},
      {version:1,source:'all-in-one',duration,segments:[{start:0,end:8,label:'chorus'},{start:8,end:16,label:'verse'},{start:16,end:24,label:'chorus'}],
       instruments:{version:1,source:'htdemucs',step:.1,drums:Array.from({length:240},(_,i)=>i>=80&&i<160?.001:i%5===0?.25:.04),bass:Array(240).fill(.05),vocals:Array(240).fill(.04),other:Array(240).fill(.02)}});
    track.refined=true;track.structureState='complete';await lib.saveTrack(track);await lib.saveShow(track,options);
  })()`);
  await c('Page.reload');
  await wait("document.querySelector('[aria-label=\"Abschnittslicht bearbeiten\"]')?.disabled===false");
  assert.equal(await evaluate("(async()=>{const lib=await import('/dj-library.js'),track=(await lib.readLibrary())[0],saved=await lib.readShow(track,{arrangement:'auto',mood:'auto',minimum:5,maximum:75});return saved.plan.arrangement.drama.intensity.length===240&&saved.plan.structure.instruments.drums.length===240;})()"),true);
  await evaluate("document.querySelector('[aria-label=\"Abschnittslicht bearbeiten\"]').click()");
  await wait("document.querySelector('dialog')?.open");
  await evaluate("document.querySelector('[data-preset=calm]').click();document.querySelector('[data-transfer]').click()");
  await evaluate("document.querySelector('dialog form').requestSubmit()");
  await wait("!document.querySelector('dialog')");
  const saved=await evaluate("(async()=>{const lib=await import('/dj-library.js');return (await lib.readLibrary())[0].sectionEdits;})()");
  assert.equal(saved.length,3);assert.equal(saved[0].movement,.35);assert.equal(saved[2].movement,.35);assert.equal(saved[1].movement,1);
  await c('Page.reload');
  await wait("document.querySelector('[aria-label=\"Abschnittslicht bearbeiten\"]')?.disabled===false");
  await evaluate("document.querySelector('[aria-label=\"Abschnittslicht bearbeiten\"]').click()");
  await wait("document.querySelector('dialog')?.open");
  assert.equal(await evaluate("Number(document.querySelector('[name=movement]').value)"),.35);
  await evaluate("document.querySelector('[data-split-time]').value='4.1';document.querySelector('[data-split]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.section-timeline button').length"),4);
  assert.equal(await evaluate("Number(document.querySelector('[name=start]').value)"),4.003);
  assert.equal(await evaluate("document.querySelector('dialog form').checkValidity()"),true);
  await evaluate("document.querySelector('[data-merge]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.section-timeline button').length"),3);
  await evaluate("document.querySelector('[data-close]').click()");
  assert.equal((await evaluate("(async()=>{const lib=await import('/dj-library.js');return (await lib.readLibrary())[0].sectionEdits;})()"))[0].end,8);
  await evaluate("document.querySelector('[aria-label=\"Abschnittslicht bearbeiten\"]').click()");
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("document.querySelector('dialog').getBoundingClientRect().width<=innerWidth"),true);
  assert.deepEqual(errors,[]);
  const result={instrumentPersistence:true,openFromLibrary:true,motifTransfer:true,persistence:true,beatSnappedSplit:true,merge:true,cancelPreservesSaved:true,mobileFits:true,browserErrors:0};
  console.log(JSON.stringify(result,null,2));
  await writeFile(new URL('../reports/section-lighting-browser-check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
