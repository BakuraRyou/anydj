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




  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/style.css'});await wait("document.readyState==='complete'&&location.pathname==='/style.css'");
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const key=async key=>{const code={ArrowDown:40,Enter:13,Escape:27}[key];for(const type of ['keyDown','keyUp'])await c('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code});};
  const open=async selector=>{
    const point=await evaluate(`(()=>{const el=document.querySelector('${selector}');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)===el,disabled:el.disabled};})()`);
    assert.equal(point.hit,true,selector+' must receive pointer events');assert.equal(point.disabled,false,selector+' must be enabled');
    for(const type of ['mousePressed','mouseReleased'])await c('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});
    await wait(`document.querySelector('${selector}').matches(':open')`);
  };
  const remains=async(selector,ms)=>{await pause(ms);assert.equal(await evaluate(`document.querySelector('${selector}').matches(':open')`),true,selector+' must stay open during updates');};
  await evaluate(`(async()=>{
    document.body.innerHTML='<main id="host"></main>';
    const {createStageTransport}=await import('/dmx-stage-transport.js');
    window.lists=[{id:'one',name:'Erste Liste'},{id:'two',name:'Zweite Liste'}];window.chosen='one';
    window.tracks=[{id:'song1',title:'Song 1',ready:true},{id:'song2',title:'Song 2',ready:true}];
    window.transport=createStageTransport(document.querySelector('#host'),{isVisible:()=>true});
    transport.setApi({getDecks:()=>['A','B'].map(id=>({id,title:'Song',duration:100,position:10,rate:1,canLoad:true})),getTracks:()=>tracks,
      getPlaylists:()=>({lists,selected:chosen,entries:[],ready:true}),selectPlaylist:value=>{chosen=value;}});
    window.tick=setInterval(()=>transport.update(),50);
  })()`);
  await open('[data-song-list]');
  await evaluate("lists.push({id:'three',name:'Neue Hintergrundliste'})");
  await remains('[data-song-list]',600);
  assert.equal(await evaluate("document.querySelector('[data-song-list]').options.length"),2,'Option updates must wait for menu close');
  await key('ArrowDown');await key('Enter');await wait("chosen==='two'&&document.querySelector('[data-song-list]').options.length===3");
  await open('[data-song-deck]');await remains('[data-song-deck]',400);await key('ArrowDown');await key('Enter');
  assert.equal(await evaluate('transport.getSelected().id'),'B');
  await evaluate("document.querySelector('[data-song-library]').click()");
  await open('[data-song-track]');await evaluate("tracks[0].title='Song 1 analysiert'");await remains('[data-song-track]',400);
  await key('ArrowDown');await key('Enter');await wait("document.querySelector('[data-song-track]').options[0].textContent==='Song 1 analysiert'");
  assert.equal(await evaluate("document.querySelector('[data-song-track]').value"),'song2');
  await evaluate(`(async()=>{clearInterval(tick);transport.destroy();const {createARPlanner}=await import('/dmx-ar-planner.js');window.planner=createARPlanner(document.querySelector('#host'));planner.openStep(1);window.tick=setInterval(()=>{window.ar=!window.ar;planner.setARSupport(ar);},100);})()`);
  const original=await evaluate("document.querySelector('[data-ar-room]').value");
  await open('[data-ar-room]');await remains('[data-ar-room]',1100);await key('ArrowDown');await key('Enter');
  await pause(300);assert.notEqual(await evaluate("document.querySelector('[data-ar-room]').value"),original);
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value===planner.plan.id"),true);
  await evaluate(`(async()=>{
    clearInterval(tick);planner.destroy();window.calls=[];window.outputName='Erster Ausgang';
    window.fetch=async(url,options)=>{calls.push({url,method:options?.method});return new Response(JSON.stringify({outputs:[{id:'usb1',name:outputName,description:'Test',kind:'usb',online:true,ready:true},{id:'usb2',name:'Zweiter Ausgang',description:'Test',kind:'usb',online:true,ready:true}]}),{status:200});};
    const {createDmxConnection}=await import('/dmx-connection.js');window.connection=createDmxConnection(document.querySelector('#host'));
  })()`);
  await wait("document.querySelector('.stage-hardware select').options.length===2");
  await open('.stage-hardware select');await evaluate("outputName='Aktualisierter Ausgang'");await remains('.stage-hardware select',3000);
  await key('ArrowDown');await key('Enter');await wait("document.querySelector('.stage-hardware select').options[0].textContent.includes('Aktualisierter Ausgang')");
  assert.equal(await evaluate("document.querySelector('.stage-hardware select').value"),'usb2');
  assert.equal(await evaluate("calls.every(call=>call.url==='/api/dmx/status'&&call.method==='GET')"),true,'No hardware output may be started');
  await evaluate('connection.destroy()');
  await c('Page.navigate',{url:base+'/dj'});await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('[data-stage3d-expand]')");
  await evaluate("document.querySelector('[data-stage3d-toggle]').click()");
  await wait("!document.querySelector('.stage-3d').hidden&&document.querySelector('.stage-3d-dialog[open]')");
  await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
  await wait("document.querySelector('.stage-3d-dialog[open] [data-ar-room]')?.getBoundingClientRect().height>0");
  const roomSelector='.stage-3d-dialog[open] [data-ar-room]';
  await open(roomSelector);await remains(roomSelector,1600);await key('ArrowDown');await key('Enter');
  const roomValue=await evaluate(`document.querySelector('${roomSelector}').value`);
  await pause(500);assert.equal(await evaluate(`document.querySelector('${roomSelector}').value`),roomValue);
  await open(roomSelector);await remains(roomSelector,500);await key('Escape');
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('Native select popups verified: playlists, decks, songs, rooms, and DMX outputs survive periodic and background updates; selections persist.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
