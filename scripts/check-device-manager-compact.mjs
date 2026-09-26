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



  await evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click();document.querySelector('[data-workspace-tab=fixtures]').click();document.querySelector('[data-ar-new]').click();document.querySelector('[data-ar-step=\"2\"]').click();for(let i=0;i<9;i++)document.querySelector('[data-ar-template=moving]').click()");
  await wait("document.querySelector('.ar-device-workspace')");
  for(const [width,height] of [[1440,900],[1280,720],[1024,768],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await new Promise(r=>setTimeout(r,200));
    await writeFile('/tmp/room-device-manager-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    for(const tab of ['devices','position','motion','size','zones','import']){
      await evaluate(`document.querySelector('[data-device-tab=${tab}]').click()`);
      if(width<600)await evaluate("document.querySelector('.ar-device-mobile button:last-child').click()");
      if(tab==='zones'&&width===1440)await evaluate("document.querySelector('.ar-room-zones [data-zone-add]').click()");
      if(tab==='motion'){await evaluate("document.querySelector('.ar-motion-tabs button:last-child').click();var wall=document.querySelector('[data-ar-wall]');wall.value='0';wall.dispatchEvent(new Event('change'))");}
      await new Promise(r=>setTimeout(r,50));
      const sizes=await evaluate(`[...document.querySelectorAll('.stage-3d-inspector-body,.ar-device-workspace,.ar-device-tab-panel')].filter(e=>e.checkVisibility()).map(e=>({name:e.className,h:e.clientHeight,scroll:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth}))`);
      for(const size of sizes){assert.ok(size.scroll<=size.h+2,width+' '+tab+' vertical overflow '+JSON.stringify(size));assert.ok(size.sw<=size.w+2,width+' '+tab+' horizontal overflow');}
      await writeFile('/tmp/room-device-manager-'+width+'-'+tab+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    }
  }

  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  const plan=()=>evaluate("(()=>{const s=JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'));return s.plans.find(p=>p.id===s.selected);})()");
  const countBefore=Object.keys((await plan()).positions).length;
  await evaluate("document.querySelector('[data-device-tab=position]').click();const name=document.querySelector('[data-ar-device-name]');name.value='Testleuchte';name.dispatchEvent(new Event('change'));document.querySelector('[data-ar-duplicate]').click()");
  assert.equal(Object.keys((await plan()).positions).length,countBefore+1);
  await evaluate("const x=document.querySelector('[data-ar-x]');x.value='1.2';x.dispatchEvent(new Event('change'))");
  assert.ok(Object.values((await plan()).positions).some(p=>p.name==='Testleuchte · Kopie'&&p.x===1.2));
  await evaluate("document.querySelector('[data-ar-remove]').click()");
  assert.equal(Object.keys((await plan()).positions).length,countBefore);
  await evaluate("document.querySelector('[data-ar-undo]').click()");
  assert.equal(Object.keys((await plan()).positions).length,countBefore+1);
  await evaluate("document.querySelector('[data-device-tab=devices]').click();document.querySelector('.ar-device-pager button:first-child').click()");
  assert.ok(await evaluate("document.querySelector('.ar-device-list .ar-device').checkVisibility()"),'previous device page works');
  await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
  assert.ok(await evaluate("document.querySelector('[data-ar-width]').checkVisibility()"),'room controls remain available');
  await evaluate("document.querySelector('[data-workspace-tab=fixtures]').click()");
  assert.ok(await evaluate("document.querySelector('.ar-device-workspace').checkVisibility()"));

  await evaluate("document.querySelector('[data-device-tab=position]').click();document.querySelector('[data-ar-place]').click()");
  const selectedId=await evaluate("document.querySelector('[data-ar-fixture]').value");
  const point=await evaluate("(()=>{const svg=document.querySelector('[data-ar-map]');const p=new DOMPoint(1,4).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};})()");
  await c('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  assert.equal((await plan()).positions[selectedId].x,1);
  assert.equal((await plan()).positions[selectedId].y,2);
  assert.equal(await evaluate("document.querySelector('#stageLayoutDialog')"),null,'legacy manager is not in the document');
  assert.ok(await evaluate("!document.querySelector('[data-ar-manage-show]').checkVisibility()"),'no route back to legacy manager');
  console.log('Current room device manager passed: all tabs without scrolling at 1440/1280/1024/390, wall targets, pagination, edits, duplicate/remove/undo and room navigation.');
  assert.deepEqual(errors,[]);

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
