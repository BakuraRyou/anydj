import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
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
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.dj-full-host')");
  await evaluate(`(async()=>{const {createFullMode}=await import('/dj-full.js');window.fullTrigger=document.createElement('button');fullTrigger.textContent='Test Full';document.body.append(fullTrigger);window.fullTest=createFullMode(fullTrigger);window.testFrame={state:true,r:240,g:45,b:80,dimming:85};fullTest.update(testFrame,[{frame:testFrame,weight:1,look:'peak'}]);})()`);
  const coverChecks=await evaluate(`(async()=>{
    const {createLocalCovers}=await import('/local-cover.js');
    const covers=createLocalCovers({save:async()=>{},changed:()=>{}});
    const plan={duration:4,step:1,frames:[{r:255,g:0,b:0,dimming:80},{r:255,g:0,b:0,dimming:80},{r:255,g:0,b:0,dimming:80},{r:0,g:0,b:255,dimming:80}]};
    const track={name:'Cover test',size:123,lastModified:0,plan};
    const holder=document.createElement('div');document.body.append(holder);covers.attach(holder,track);
    const fallback=Boolean(holder.querySelector('.dj-color-profile')?.style.backgroundImage.includes('linear-gradient'));
    const accessible=holder.firstChild?.getAttribute('aria-label').includes('75 %');
    holder.replaceChildren();covers.attach(holder,{...track,plan:null});const pending=holder.children.length===0;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
    holder.replaceChildren();covers.attach(holder,{...track,coverKey:JSON.stringify([track.name,track.size,track.lastModified]),cover:canvas.toDataURL('image/jpeg')});
    const image=holder.querySelector('img');await image.decode();
    const realCover=holder.children.length===1&&holder.firstChild===image;
    holder.remove();return {fallback,accessible,pending,realCover};
  })()`);
  assert.deepEqual(coverChecks,{fallback:true,accessible:true,pending:true,realCover:true});
  const gesture=expression=>c('Runtime.evaluate',{expression,userGesture:true,awaitPromise:true});
  await gesture('fullTrigger.click()');await wait("document.querySelectorAll('.dj-full')[1].open");
  assert.equal(await evaluate("document.fullscreenElement===document.querySelectorAll('.dj-full-host')[1]"),true);
  assert.equal(await evaluate("new Set([...document.querySelectorAll('.dj-full')[1].querySelectorAll('.dj-full-color')].map(n=>n.style.getPropertyValue('--full-color'))).size"),4);
  assert.equal(await evaluate("Boolean(document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('.dj-full'))"),true,'Fullscreen host must not cover the dialog');
  await new Promise(r=>setTimeout(r,500));
  const shot=await c('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/anydj-full-four-colors.png',Buffer.from(shot.data,'base64'));
  await wait("document.querySelectorAll('.dj-full')[1].classList.contains('dj-full-idle')");
  const before=await evaluate("[...document.querySelectorAll('.dj-full')[1].querySelectorAll('.dj-full-color')].map(n=>n.style.getPropertyValue('--full-color'))");
  await evaluate("fullTest.update({...testFrame,r:30,b:230},[{frame:testFrame,weight:.5,look:'peak'},{frame:{...testFrame,r:30,b:230},weight:.5,look:'peak'}])");
  assert.notDeepEqual(await evaluate("[...document.querySelectorAll('.dj-full')[1].querySelectorAll('.dj-full-color')].map(n=>n.style.getPropertyValue('--full-color'))"),before);
  await evaluate("window.songColors=[[240,45,80],[25,180,110],[70,90,220],[230,190,40]];fullTest.update(testFrame,[{frame:testFrame,weight:1,look:'peak',palette:songColors}])");
  assert.equal(await evaluate("[...document.querySelectorAll('.dj-full')[1].querySelectorAll('.dj-full-color')].every(n=>songColors.some(c=>n.style.getPropertyValue('--full-color')==='rgb('+c.join(', ')+')'))"),true,'Full must use supplied song colors instead of fixed hue offsets');
  await evaluate('fullTest.update(null)');assert.equal(await evaluate("document.querySelectorAll('.dj-full')[1].style.getPropertyValue('--full-level')"),'0');
  await evaluate("document.querySelectorAll('.dj-full')[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await wait('!document.fullscreenElement');
  await wait('document.activeElement===fullTrigger');
  await evaluate("document.querySelectorAll('.dj-full-host')[1].requestFullscreen=async()=>{throw Error('Fullscreen unavailable')};fullTest.update(testFrame)");
  await gesture('fullTrigger.click()');await wait("document.querySelectorAll('.dj-full')[1].open");
  assert.equal(await evaluate('document.fullscreenElement===null'),true);
  for(const width of [390,1280]){await c('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width===390});await wait("Math.abs(document.querySelectorAll('.dj-full')[1].getBoundingClientRect().width-innerWidth)<2");}
  await evaluate('fullTest.destroy()');assert.equal(await evaluate("document.querySelectorAll('.dj-full-host').length"),1);
  await evaluate(`(async()=>{document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=(url,options)=>String(url).startsWith('/api/analysis/')?Promise.resolve(new Response('{}',{status:503})):original(url,options);${(await readFile(new URL('../public/web-demo.js',import.meta.url),'utf8')).replace('export function','function')}
const dt=new DataTransfer();dt.items.add(createDemoFiles()[0]);const input=document.querySelector('#djFiles');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await wait("document.querySelector('[aria-label=\"Auf Deck A laden\"]')&&!document.querySelector('[aria-label=\"Auf Deck A laden\"]').disabled");
  await evaluate("document.querySelector('[aria-label=\"Auf Deck A laden\"]').click()");
  await wait("!document.querySelector('.dj-play').disabled");
  const comparison=await evaluate(`(async()=>{
    const picker=document.querySelector('.dj-color-picker'),audio=document.querySelector('.dj-deck audio');
    const source=audio.src,time=audio.currentTime;
    const select=picker.querySelector('.color-options'),button=picker.querySelector('.color-apply');
    async function choose(value){picker.open=true;select.value=value;button.click();for(let i=0;i<100&&picker.open;i++)await new Promise(r=>setTimeout(r,20));if(picker.open)throw Error('Color selection timed out');}
    await choose('legacy-auto');const old=picker.querySelector('summary span').textContent.includes('Bisherige');
    await choose('auto');return {old,current:picker.querySelector('summary span').textContent.includes('Songanalyse'),sameAudio:audio.src===source&&audio.currentTime===time};
  })()`);
  assert.deepEqual(comparison,{old:true,current:true,sameAudio:true});
  await gesture("document.querySelector('.dj-play').click()");
  await wait("document.querySelector('.dj-deck audio').currentTime>.5");
  await gesture("[...document.querySelectorAll('button')].find(b=>b.textContent==='Full').click()");
  await wait("document.querySelector('.dj-full').open&&Number(document.querySelector('.dj-full').style.getPropertyValue('--full-level'))>0");
  assert.equal(await evaluate("document.querySelectorAll('.dj-full-color').length"),4);
  await evaluate("{const input=document.querySelector('[data-light-tuning=saturation]');input.value=0;input.dispatchEvent(new Event('input',{bubbles:true}));}");
  await wait("[...document.querySelectorAll('.dj-full-color')].every(n=>{const rgb=n.style.getPropertyValue('--full-color').match(/[0-9]+/g).map(Number);return rgb[0]===rgb[1]&&rgb[1]===rgb[2];})");
  await evaluate("{const input=document.querySelector('[data-light-tuning=brightness]');input.value=0;input.dispatchEvent(new Event('input',{bubbles:true}));}");
  await wait("document.querySelector('.dj-full').style.getPropertyValue('--full-level')==='0'");
  await evaluate("document.querySelector('.dj-light-tuning button').click()");
  await evaluate("document.querySelector('.dj-deck audio').pause()");
  await wait("document.querySelector('.dj-full').style.getPropertyValue('--full-level')==='0'");
  await evaluate("document.querySelector('.dj-full button').click()");
  assert.deepEqual(errors,[]);console.log('Full mode passed: four colors, fullscreen visibility, live changes, idle controls, pause, Escape, focus, viewport fallback and cleanup.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
