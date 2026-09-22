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




  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.dj-light-tuning')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click()");
  assert.equal(await evaluate("document.querySelector('[data-stage-page=look]').hidden"),false);
  await evaluate("document.querySelector('[data-stage-choice=auto]').click()");
  assert.equal(await evaluate("document.querySelector('[data-mode]').value"),'auto');
  await evaluate("document.querySelector('[data-demo]').click()");
  await wait("Number(document.querySelector('.stage-spot').style.getPropertyValue('--stage-power'))>0");
  await evaluate("window.setLight=(key,value)=>{const n=document.querySelector('[data-light-tuning='+key+']');n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};setLight('saturation',0)");
  await wait("(()=>{const rgb=document.querySelector('.stage-spot').style.getPropertyValue('--stage-color').match(/[0-9]+/g).map(Number);return rgb[0]===rgb[1]&&rgb[1]===rgb[2];})()");
  await evaluate("setLight('brightness',0)");
  await wait("Number(document.querySelector('.stage-spot').style.getPropertyValue('--stage-power'))===0");
  await evaluate("setLight('brightness',75);setLight('saturation',110);setLight('hue',20);setLight('dynamics',80)");
  for(const width of [1280,390]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
   for(let i=0;i<4;i++){
    await evaluate(`document.querySelectorAll('.stage-nav-button')[${i}].click();document.querySelector('#dmxStage').scrollTop=0`);
    assert.equal(await evaluate("document.querySelector('#dmxStage').scrollWidth<=document.querySelector('#dmxStage').clientWidth"),true);
    const shot=await c('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/anydj-stage-redesign-${width}-${i}.png`,Buffer.from(shot.data,'base64'));
   }
  }
  await evaluate("document.querySelectorAll('.stage-nav-button')[2].click();document.querySelector('[data-add-bar]').click()");
  assert.ok(await evaluate("document.querySelector('[data-devices]').textContent.includes('Lichtleiste')"));
  await evaluate("document.querySelectorAll('.stage-nav-button')[0].click();document.querySelector('[data-stage-choice=design]').click()");
  assert.equal(await evaluate("document.querySelector('[data-editor]').hidden"),false);
  const previousOrigin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin>${previousOrigin}&&document.querySelector('.dj-light-tuning')`);
  assert.equal(await evaluate("document.querySelector('[data-light-tuning=brightness]').value"),'75');
  await evaluate("document.querySelector('.dj-light-tuning button').click()");
  assert.equal(await evaluate("document.querySelector('[data-light-tuning=brightness]').value"),'100');
  assert.equal(await evaluate("document.querySelector('[data-light-tuning=hue]').value"),'0');
  assert.deepEqual(errors,[]);console.log('Stage redesign passed: modes, navigation, grayscale, blackout, equipment, individual editing, persisted global settings, reset and desktop/mobile layout.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
