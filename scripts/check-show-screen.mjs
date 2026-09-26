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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");



  await evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click()");
  await wait("document.querySelector('.stage-show-shell[open]')");
  assert.equal(await evaluate("document.querySelector('dialog.stage-3d-dialog')"),null,'native large dialog removed');
  let touch=false;
  const click=async selector=>{
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',inline:'nearest'})`);
   const p=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:n.contains(document.elementFromPoint(x,y))};})()`);
   assert.equal(p.hit,true,'click target unobstructed: '+selector);
   if(touch){await c('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await c('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});return;}
   await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
   await c('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
   await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  };
  for(const [width,height] of [[1440,900],[390,844],[844,390]]){
   touch=width<600;
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   for(const tab of ['room','fixtures','lighting','position','music']){
    await click('[data-workspace-tab='+tab+']');
    await wait("document.querySelector('[data-workspace-tab="+tab+"]').getAttribute('aria-expanded')==='true'");
    assert.equal(await evaluate("document.querySelector('[data-workspace-page="+tab+"]').checkVisibility()"),true);
    assert.equal(await evaluate("document.querySelector('.stage-3d-inspector').inert"),false);
    assert.ok(await evaluate("document.querySelector('.stage-3d-inspector').getBoundingClientRect().height")>100);
    await click('[data-tools-close]');
   }
   await writeFile('/tmp/anydj-show-screen-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await click('[data-workspace-tab=room]');
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  assert.equal(await evaluate("document.querySelector('.stage-show-shell').hidden"),false,'Escape closes drawer first');
  await click('[data-stage3d-expand]');
  assert.equal(await evaluate("document.querySelector('.stage-show-shell').hidden"),true);
  assert.equal(await evaluate("document.querySelector('#stageSettings').closest('[inert]')"),null,'background restored');
  await evaluate("document.querySelector('#stageSettings').click()");
  await wait("document.querySelector('.stage-show-shell[open]')");
  await click('[data-workspace-tab=music]');
  assert.equal(await evaluate("document.querySelector('[data-song-deck]').checkVisibility()"),true);
  assert.deepEqual(errors,[]);console.log('Show screen passed: no native dialog, real hit-tested tab clicks at three sizes, accessible drawers, close/reopen and background restoration.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
