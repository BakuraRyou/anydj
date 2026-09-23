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



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click()");
  assert.ok(await evaluate("[...document.querySelectorAll('.dj-deck-tools,.dj-light-options,.dj-audio-options,.dj-list-options')].every(d=>!d.open)"));
  assert.equal(await evaluate("[...document.querySelector('.dj-deck').querySelectorAll('button')].filter(b=>b.checkVisibility()).length"),2,'Play and Cue visible by default');
  for(const [width,height] of [[1440,900],[1024,800],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await evaluate("document.querySelector('[data-close]').click()");
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'page overflow at '+width);
    assert.ok(await evaluate("document.querySelector('.stage-scene').scrollWidth<=document.querySelector('.stage-scene').clientWidth"),'stage horizontal overflow at '+width);
    if(width>760){
      const heights=await evaluate("[...document.querySelectorAll('.dj-deck,.dj-mixer')].map(e=>Math.round(e.getBoundingClientRect().height))");
      assert.equal(new Set(heights).size,1,'aligned panel heights');
    }
    await writeFile(new URL('../reports/ux-layout-'+width+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate("document.querySelector('#stageSettings').click()");
    assert.ok(await evaluate("document.querySelector('.stage-equipment-section').open===false"));
    assert.ok(await evaluate("document.querySelector('.stage-editor').scrollHeight<=document.querySelector('.stage-editor').clientHeight+1"),'no nested editor scrollbar');
    assert.ok(await evaluate("document.querySelector('#dmxStage').scrollWidth<=document.querySelector('#dmxStage').clientWidth"),'dialog overflow');
    await writeFile(new URL('../reports/ux-settings-'+width+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("document.querySelector('[data-close]').click();document.querySelector('.dj-transport-options').open=true;document.querySelector('.dj-deck-tools summary').click()");
  assert.ok(await evaluate("document.querySelector('[data-tempo]').checkVisibility()"),'expanded tools are reachable');
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'expanded tools fit mobile width');
  await evaluate("document.querySelector('.dj-deck-tools summary').focus()");
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await evaluate("document.querySelector('.dj-deck-tools').open"),false);
  await evaluate("document.querySelector('#stageSettings').click()");
  await evaluate("document.querySelector('.stage-equipment-section summary').click();document.querySelector('[data-add-spot]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.stage-spot').length"),5);
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false);
  assert.equal(await evaluate("document.activeElement.id"),'stageSettings');
  assert.deepEqual(errors,[]);
  console.log('Layout passed: aligned panels, no horizontal overflow, single settings scroll, equipment controls and keyboard focus at 1440/1024/390px.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
