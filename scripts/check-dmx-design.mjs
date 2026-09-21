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
  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.querySelector('#dmxStage')");
  await evaluate("(()=>{if(document.querySelector('#inlineLightStage').hidden)document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click();})()");
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),true);
  assert.equal(await evaluate("document.querySelectorAll('.stage-spot').length"),4);
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell').length"),8);
  await evaluate("document.querySelector('[data-demo]').click()");
  await wait("document.querySelector('.stage-status').textContent.startsWith('Demo läuft')");
  assert.ok(await evaluate("Number(document.querySelector('.stage-spot').style.getPropertyValue('--stage-power'))>0"));
  await evaluate("document.querySelector('[data-blackout]').click()");
  assert.equal(await evaluate("document.querySelector('.stage-spot').style.getPropertyValue('--stage-power')"),'0');
  await evaluate("document.querySelector('[data-blackout]').click();document.querySelector('#dmxStage details').open=true");
  await wait("document.querySelector('.stage-values').textContent.includes('Kanal 1–4')");
  await writeFile(new URL('../reports/dmx-stage-desktop.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('#djStop').click()");
  await wait("document.querySelector('.stage-status').textContent.startsWith('Bereit')");
  // Exercise the same component with a known live DJ frame, without audio/model dependencies.
  await evaluate(`(async()=>{document.querySelector('[data-close]').click();
    const {createDmxStage}=await import('/dmx-stage.js');
    const b=document.createElement('button');document.body.append(b);
    window.fixtureStage=createDmxStage(b);b.click();
    window.fixtureStage.update({state:true,r:255,g:0,b:0,dimming:50},true);})()`);
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spot')].at(-1).style.getPropertyValue('--stage-color')"),'rgb(128,0,0)');
  assert.equal(await evaluate("[...document.querySelectorAll('[data-demo]')].at(-1).disabled"),true);

  // Design controls work on the second, isolated live stage.
  await evaluate(`window.editStage=(key,value)=>{const p=[...document.querySelectorAll('.dmx-stage')].at(-1),e=p.querySelector('[data-'+key+']');e.value=value;e.dispatchEvent(new Event(key==='mode'||key==='target'||key==='scope'||key==='group'?'change':'input',{bubbles:true}));};
    editStage('mode','design');editStage('target','f0');
    [...document.querySelectorAll('[data-own]')].at(-1).click();
    editStage('animation','follow');editStage('color','fixed');editStage('a','#00ff00');`);
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[0].style.getPropertyValue('--stage-color')"),'rgb(0,128,0)');
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[1].style.getPropertyValue('--stage-color')"),'rgb(128,0,0)');
  await evaluate("editStage('mode','shared')");
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[0].style.getPropertyValue('--stage-color')"),'rgb(128,0,0)');
  await evaluate("editStage('mode','design')");
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[0].style.getPropertyValue('--stage-color')"),'rgb(0,128,0)');
  await evaluate(`window.liveSource={frame:{state:true,r:255,g:0,b:0,dimming:50},weight:1,beat:0,sectionKey:'test-song:0',sectionName:'Testsong · Strophe'};
    fixtureStage.update(liveSource.frame,true,[liveSource]);editStage('scope','section');
    [...document.querySelectorAll('[data-own]')].at(-1).click();editStage('a','#0000ff');`);
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[0].style.getPropertyValue('--stage-color')"),'rgb(0,0,128)');
  await evaluate("fixtureStage.update(liveSource.frame,true,[{...liveSource,sectionKey:'test-song:10',sectionName:'Refrain'}])");
  assert.equal(await evaluate("[...document.querySelectorAll('.stage-spots')].at(-1).children[0].style.getPropertyValue('--stage-color')"),'rgb(0,128,0)');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-design-v1')).config.fixtures[0].colors[0]"),'#00ff00');
  await evaluate('window.fixtureStage.update(null,false);window.fixtureStage.destroy();(()=>{if(document.querySelector("#inlineLightStage").hidden)document.querySelector("#openLightStage").click();document.querySelector("#stageSettings").click();})()');

  await c('Page.reload');await wait("document.querySelector('#dmxStage')");
  await evaluate("(()=>{if(document.querySelector('#inlineLightStage').hidden)document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click();})()");
  assert.equal(await evaluate("document.querySelector('[data-mode]').value"),'design');
  await evaluate("document.querySelector('.stage-spot').click()");
  assert.equal(await evaluate("document.querySelector('[data-a]').value"),'#00ff00');
  await evaluate("document.querySelector('[data-demo]').click()");
  await writeFile(new URL('../reports/dmx-design-desktop.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("(()=>{const r=document.querySelector('#dmxStage').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()"),true);
  await writeFile(new URL('../reports/dmx-design-mobile.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('[data-close]').focus()");
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false);
  assert.equal(await evaluate("document.activeElement.id"),'stageSettings');
  assert.equal(requests.includes('/api/music/start'),false);
  assert.deepEqual(errors,[]);
  console.log('DMX design browser checks passed: independent color, shared-mode restore, sections, persistence, demo, blackout, stop, live frame, mobile bounds, keyboard, no hardware session.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
