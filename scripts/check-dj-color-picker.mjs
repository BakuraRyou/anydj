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



  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.dj-color-picker')");
  await evaluate("document.querySelector('.dj-transport-options').open=true;document.querySelector('.dj-light-options').open=true;document.querySelector('.dj-color-picker summary').click()");
  await new Promise(r=>setTimeout(r,300));
  assert.equal(await evaluate("document.querySelector('.dj-color-picker').open"),true,'empty deck explains prerequisites without snapping closed');
  await evaluate(`(async()=>{window.picker= (await import('/dj-color-picker.js')).createColorPicker('Test',async(track,mode)=>{track.colorMode=mode;});
    document.body.append(picker.element);window.track={id:'test'};picker.update(track);picker.element.querySelector('summary').click();})()`);
  await wait("picker.element.open");
  await evaluate(`window.select=picker.element.querySelector('.color-options');select.selectedIndex=2;select.dispatchEvent(new Event('change'));window.selected=select.value;select.focus();
    window.mutations=0;window.observer=new MutationObserver(entries=>mutations+=entries.length);observer.observe(picker.element,{subtree:true,childList:true});
    window.refresh=setInterval(()=>picker.update(track),50);`);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(await evaluate("picker.element.open&&select.value===selected&&document.activeElement===select"),true,'background updates retain focus and choice');
  assert.equal(await evaluate("mutations"),0,'unchanged updates do not rebuild controls');
  await evaluate("clearInterval(refresh);observer.disconnect();picker.element.querySelector('.color-apply').click()");
  await wait("!picker.element.open");assert.equal(await evaluate("track.colorMode.id===selected"),true);
  // The shared palette works without a loaded deck and survives new tracks/reloads.
  const chooseGlobal=async id=>{
    await evaluate("document.querySelector('.dj-light-settings').open=true;document.querySelector('#djLightPalette').open=true");
    await evaluate(`(()=>{const p=document.querySelector('#djLightPalette'),s=p.querySelector('.color-options');p.querySelector('.color-search').value='';p.querySelector('.color-filter').value='';p.querySelector('.color-filter').dispatchEvent(new Event('change'));s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change'));p.querySelector('.color-apply').click();})()`);
    await wait("!document.querySelector('#djLightPalette').open");
  };
  await chooseGlobal('warm-white');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-light-palette')).id"),'warm-white');
  await evaluate(`(async()=>{
    const {compileShow}=await import('/show-plan.js'),lib=await import('/dj-library.js');
    const options={arrangement:'auto',mood:'auto',minimum:5,maximum:100};
    const windows=Array.from({length:400},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
    const track={id:'palette-test',name:'Palette test.mp3',size:1234,lastModified:1,order:0};
    track.basePlan=compileShow(windows,8,{...options,palette:'sunset',saturation:100,toneFollow:.8,smoothing:.5,speed:1,intensity:1,dynamics:'balanced'});
    await lib.saveTrack(track);await lib.saveShow(track,options);
  })()`);
  const origin=await evaluate('performance.timeOrigin');await c('Page.reload');
  await wait(`performance.timeOrigin!==${origin}&&document.querySelector('[aria-label="Abschnittslicht bearbeiten"]')?.disabled===false`);
  assert.ok((await evaluate("document.querySelector('#djLightPalette summary').textContent")).includes('Warmweiß'));
  await evaluate(`document.querySelector('[aria-label="Abschnittslicht bearbeiten"]').click()`);
  await wait("document.querySelector('dialog.section-editor')?.open");
  const colors=await evaluate(`(()=>{const c=document.querySelector('dialog.section-editor canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<a.length;i+=4)if(a[i+3])colors.add([a[i],a[i+1],a[i+2]].join(','));return [...colors];})()`);
  assert.ok(colors.length&&colors.every(c=>c.split(',').every((v,i)=>Math.abs(Number(v)-[255,206,138][i])<=3)),'newly restored song uses the shared palette (canvas edge rounding)');
  await evaluate("document.querySelector('dialog.section-editor [data-close]').click()");
  await chooseGlobal('ocean');
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("document.querySelector('.dj-light-settings').open=true;document.querySelector('#djLightPalette').open=true");
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await evaluate("(()=>{const p=document.querySelector('#djLightPalette');p.querySelector('.color-name').value='Meine Palette';p.querySelector('.color-a').value='#ff0000';p.querySelector('.color-b').value='#00ff00';p.querySelector('.color-add').click();})()");
  await wait("!document.querySelector('#djLightPalette').open");
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('anydj-light-palette')).colors"),['#ff0000','#00ff00']);
  await chooseGlobal('auto');
  assert.equal(await evaluate("localStorage.getItem('anydj-light-palette')"),'null');
  assert.deepEqual(errors,[]);
  console.log('Color picker passed: deck selection, global presets, persistence, new songs, preview colors, custom palette, reset and mobile width.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
