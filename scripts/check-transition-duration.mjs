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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' · '+await evaluate("[...document.querySelectorAll('[data-status]')].map(e=>e.textContent).join(' | ')"));};


  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.transition-preview-open')");
  await evaluate(`(async()=>{
    const {createTransitionPreview}=await import('/transition-preview.js');
    const host=document.createElement('section');document.body.append(host);
    const deck=name=>({name,track:{name:'Testtitel '+name},duration:210,waveform:{peaks:Array.from({length:2100},(_,i)=>.2+.7*Math.abs(Math.sin(i*.031)))},rate:1,volume:1,eq:{trim:0}});
    createTransitionPreview({host,getPair:()=>({libraryTracks:[0,1].map(()=>({plan:{duration:210,beatGrid:{beats:Array.from({length:421},(_,i)=>i*.5),downbeats:Array.from({length:106},(_,i)=>i*2)}}})),from:deck('A'),to:deck('B'),position:0,plan:{time:208,cue:0,duration:2,style:'bass',label:'Bassübergabe'}}),onChoose:(_,choice)=>{window.applied=choice;return true;}});
    host.querySelector('button').click();window.editor=[...document.querySelectorAll('.dj-transition-preview')].at(-1);
    editor.querySelector('[data-proposal-edit="0"]').click();
    window.editDuration=value=>{const input=editor.querySelector('[data-edit-duration]');input.value=value;input.dispatchEvent(new Event('input'));};
  })()`);
  await evaluate('editDuration(20)');
  assert.equal(await evaluate("editor.querySelector('[data-edit-time]').value"),'190');
  assert.deepEqual(await evaluate("[...editor.querySelectorAll('.transition-curve-editor text')].map(n=>n.textContent)"),['0.0 s','5.0 s','10.0 s','15.0 s','20.0 s']);
  assert.equal(await evaluate("editor.querySelector('[data-edit-status]').checkVisibility()"),true);
  assert.equal(await evaluate("editor.querySelector('[data-choose]').disabled"),false);
  await evaluate("editDuration('')");
  assert.equal(await evaluate("editor.querySelector('[data-choose]').disabled"),true);
  assert.equal(await evaluate("[...editor.querySelectorAll('.transition-curve-editor text')].at(-1).textContent"),'20.0 s','incomplete input keeps last valid scale');
  await evaluate("editDuration(20);editor.querySelector('[data-choose]').click()");
  assert.equal(await evaluate('applied.duration'),20);assert.equal(await evaluate('applied.time'),190);
  const dragLane=async(key,fraction)=>{
    const selector='[data-timeline-start='+key+']';
    await evaluate(`editor.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const r=await evaluate(`(()=>{const n=editor.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5,width:r.width,hit:n.contains(document.elementFromPoint(r.x+r.width*.5,r.y+r.height*.5))};})()`);
    assert.equal(r.hit,true,'waveform is reachable');
    const before=await evaluate(`editor.querySelector(${JSON.stringify(selector)}).previousElementSibling.getAttribute('d')`);
    await c('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',buttons:1,clickCount:1});
    await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+r.width*fraction,y:r.y,buttons:1});
    await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+r.width*fraction,y:r.y,button:'left',buttons:0,clickCount:1});
    assert.notEqual(await evaluate(`editor.querySelector(${JSON.stringify(selector)}).previousElementSibling.getAttribute('d')`),before,'waveform moves under the overlap');
  };
  for(const width of [1280,390]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('editDuration(20)');
    assert.equal(await evaluate("editor.querySelector('.preview-advanced').open"),false,'optional curves start collapsed');
    assert.ok(await evaluate("editor.querySelector('.transition-timeline').getBoundingClientRect().height")<(width<600?450:370),'song lanes stay compact');
    assert.ok(await evaluate("[...editor.querySelectorAll('.transition-timeline svg')].every(n=>n.getBoundingClientRect().height<=57)"),'no SVG letterbox whitespace');
    await evaluate("editor.querySelector('.proposal-editor').scrollIntoView({block:'start'})");
    await writeFile('/tmp/anydj-compact-transition-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.equal(await evaluate("editor.querySelector('.transition-timeline').checkVisibility()"),true);
    await dragLane('time',.2);await dragLane('cue',-.2);
    await evaluate("editor.querySelector('[data-choose]').click()");
    const actual=await evaluate('[applied.time,applied.cue,applied.duration]');
    assert.ok(Math.abs(actual[0]-186)<.1);assert.ok(Math.abs(actual[1]-4)<.1);assert.equal(actual[2],20);
  }
  await evaluate(`for(const [key,value] of [['time',186.3],['cue',4.3]]){const input=editor.querySelector('[data-edit-'+key+']');input.value=value;input.dispatchEvent(new Event('input'));}editor.querySelector('[data-transition-align]').click();editor.querySelector('[data-choose]').click();`);
  assert.deepEqual(await evaluate('[applied.time,applied.cue,applied.duration]'),[186,4,20]);
  await evaluate("editor.querySelector('.preview-advanced').open=true");
  assert.equal(await evaluate("editor.querySelector('.transition-curve-editor').checkVisibility()"),true,'curves remain available on demand');
  assert.deepEqual(errors,[]);
  console.log('Transition lanes passed: end A / start B, 20-second overlap, independent waveform dragging at 1280 and 390 pixels, stable duration and saved source positions.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
