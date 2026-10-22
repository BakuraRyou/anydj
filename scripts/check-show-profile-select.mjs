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

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+JSON.stringify(await evaluate("({title:document.querySelector('.dj-track-title')?.textContent,status:document.querySelector('#djStatus')?.textContent,analysis:document.querySelector('.dj-analysis')?.textContent,hidden:document.hidden,selects:[...document.querySelectorAll('[data-deck-show-profile]')].map(n=>({disabled:n.disabled,value:n.value}))})")));};




  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/style.css'});await wait("document.readyState==='complete'&&location.pathname==='/style.css'");
  await evaluate(`(async()=>{
    const {createStageFullTransport}=await import('/dmx-stage-full.js');
    document.body.innerHTML='<dialog class="stage-3d-full" style="width:1100px"><div id="controls"></div><canvas></canvas><div id="transport"></div></dialog>';
    const dialog=document.querySelector('dialog');dialog.showModal();
    const host=document.querySelector('#transport');
    window.selected='default';window.saved=[];
    window.transport=createStageFullTransport(host,{dialog,topControls:document.querySelector('#controls'),canvas:document.querySelector('canvas')});
    transport.setApi({getShowProfiles:()=>[{value:'default',label:'Standard verwenden'},{value:'auto',label:'Automatisch'},{value:'show',label:'Show'},{value:'strobe',label:'Formationen'}],
      getDecks:()=>['A','B'].map(id=>({id,title:'Geladener Song',showProfile:selected,showProfileInherited:selected==='default',defaultShowProfileLabel:'Automatisch',canSetShowProfile:true})),
      setTrackShowProfile:async(id,value)=>{saved.push({id,value});selected=value;}});
    transport.setActive(true);
  })()`);
  const selector='[data-full-deck="A"] [data-full-profile]';
  await wait(`!document.querySelector('${selector}').disabled`);
  await evaluate(`window.optionMutations=0;new MutationObserver(records=>{optionMutations+=records.length;}).observe(document.querySelector('${selector}'),{subtree:true,childList:true,characterData:true});`);
  const point=await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await c('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  await wait(`document.querySelector('${selector}').matches(':open')`);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(await evaluate(`document.querySelector('${selector}').matches(':open')`),true,'Lichtshow popup must stay open across transport refreshes');
  assert.equal(await evaluate('optionMutations'),0,'refreshes must not rebuild native menu content');
  for(const key of ['ArrowDown','ArrowDown','Enter']){
    const code={ArrowDown:40,Enter:13}[key];
    await c('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
    await c('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
  }
  await wait("saved.length===1");
  assert.deepEqual(await evaluate('saved'),[{id:'A',value:'show'}]);
  await new Promise(r=>setTimeout(r,400));
  assert.equal(await evaluate(`document.querySelector('${selector}').value`),'show');
  await evaluate('transport.destroy()');
  await c('Page.navigate',{url:base+'/dj'});await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('#trackList .dj-empty')");
  await evaluate(`(async()=>{document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=(url,options)=>String(url).startsWith('/api/analysis/')?Promise.resolve(new Response('{}',{status:503})):original(url,options);${(await readFile(new URL('../public/web-demo.js',import.meta.url),'utf8')).replace('export function','function')}
    const dt=new DataTransfer();window.uploadedName='Selectbox regression '+Date.now()+'.wav';dt.items.add(new File([createDemoFiles()[0]],uploadedName,{type:'audio/wav',lastModified:1}));const input=document.querySelector('#djFiles');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await wait("[...document.querySelectorAll('#trackList>li')].some(li=>li.querySelector('strong')?.textContent===uploadedName)");
  await evaluate("[...document.querySelectorAll('#trackList>li')].find(li=>li.querySelector('strong')?.textContent===uploadedName).querySelector('[aria-label=\"Auf Deck A laden\"]').click()");
  await wait("!document.querySelector('[data-deck-show-profile=A]').disabled");
  await evaluate("(()=>{const input=document.querySelector('[data-deck-show-profile=A]');for(let n=input.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;input.scrollIntoView({block:'center'});window.deckMutations=0;new MutationObserver(records=>deckMutations+=records.length).observe(input,{subtree:true,childList:true,characterData:true});})()");
  const deckPoint=await evaluate("(()=>{const r=document.querySelector('[data-deck-show-profile=A]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await c('Input.dispatchMouseEvent',{type:'mousePressed',...deckPoint,button:'left',clickCount:1});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',...deckPoint,button:'left',clickCount:1});
  await wait("document.querySelector('[data-deck-show-profile=A]').matches(':open')");
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(await evaluate("document.querySelector('[data-deck-show-profile=A]').matches(':open')"),true);
  assert.equal(await evaluate('deckMutations'),0);
  for(const key of ['ArrowDown','ArrowDown','ArrowDown','Enter']){
    const code={ArrowDown:40,Enter:13}[key];await c('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});await c('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
  }
  await wait("!document.querySelector('[data-deck-show-profile=A]').disabled&&document.querySelector('[data-deck-show-profile=A]').value==='strobe'");
  assert.equal(await evaluate("(async()=>{const {readLibrary}=await import('/dj-library.js');return (await readLibrary()).find(track=>track.name===uploadedName).showProfile;})()"),'strobe');
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('Lichtshow: native popups in stage and loaded deck remain open across refreshes; selection saves to the song');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
