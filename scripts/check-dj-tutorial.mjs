// Uses the existing user-managed server. Never starts or restarts a server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=process.env.ANYDJ_TEST_URL||'https://127.0.0.1:3030';
const profile=await mkdtemp(join(tmpdir(),'anydj-tutorial-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--ignore-certificate-errors','--disable-gpu','--mute-audio','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timeout=setTimeout(()=>reject(Error('Chrome timeout')),15000);chrome.stderr.on('data',data=>{log+=data;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});chrome.on('error',reject);chrome.once('exit',()=>{clearTimeout(timeout);reject(Error('Chrome exited before startup'));});});
 ws=new WebSocket(endpoint);await once(ws,'open');let next=1;const pending=new Map(),errors=[];
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 const c=(method,params)=>command(method,params,sessionId);await c('Runtime.enable');await c('Page.enable');
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};
 const click=label=>evaluate(`[...document.querySelectorAll('.animatus-tutorial-card button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.animatus-tutorial-launcher') && document.querySelector('#localTab')");
 const doc=JSON.parse(await readFile(new URL('../public/tutorial.json',import.meta.url),'utf8'));
 assert.deepEqual(await evaluate("fetch('/tutorial.json').then(r=>r.json())"),doc);
 assert.equal(await evaluate("Boolean(document.querySelector('#djHelp'))"),false,'No extra header help button');
 const results=[];
 for(const width of [1440,390]){
  await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  assert.ok(await evaluate("(()=>{const r=document.querySelector('.animatus-tutorial-launcher').getBoundingClientRect();return innerWidth-r.right<=20&&innerHeight-r.bottom<=20&&r.width===56})()"),'Original floating launcher bottom right');
  for(const path of doc.paths){
   await evaluate("document.querySelectorAll('details').forEach(d=>d.open=false);document.querySelector('.animatus-tutorial-launcher').click()");
   await wait("document.querySelectorAll('.animatus-tutorial-card__choice').length===2");
   await evaluate(`[...document.querySelectorAll('.animatus-tutorial-card__choice')].find(b=>b.querySelector('strong').textContent===${JSON.stringify(path.title)}).click()`);
   let visited=0;
   while(await evaluate("Boolean(document.querySelector('.animatus-tutorial-card'))")){
    assert.ok(visited++<doc.paths[1].steps.length+5,'Flow terminates');
    await new Promise(r=>setTimeout(r,350));
    const title=await evaluate("document.querySelector('.animatus-tutorial-card h3')?.textContent");
    if(!title)break;
    const step=path.steps.find(s=>s.title===title);assert.ok(step,title);
    if(step.target)assert.ok(await evaluate(`Boolean(document.querySelector(${JSON.stringify(step.target)})?.getClientRects().length)`),`Visible target: ${step.id}, ${width}`);
    assert.ok(await evaluate("(()=>{const r=document.querySelector('.animatus-tutorial-card').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),'Tutorial in viewport');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow');
    assert.ok(await evaluate("Boolean(document.querySelector('.animatus-tutorial-card__progress[role=progressbar]'))"));
    if(step.advanceOn?.target.endsWith('> summary')){
     assert.equal(await evaluate("Boolean(document.querySelector('.animatus-tutorial-card__next'))"),false,'Actions require interaction, no bypass');
     await evaluate(`document.querySelector(${JSON.stringify(step.advanceOn.target)}).click()`);
     await wait(`document.querySelector('.animatus-tutorial-card h3')?.textContent!==${JSON.stringify(title)}`);
    }else if(step.completeWhen){
     await wait(`document.querySelector('.animatus-tutorial-card h3')?.textContent!==${JSON.stringify(title)}`);
    }else await evaluate("document.querySelector('.animatus-tutorial-card__next').click()");
   }
   results.push({width,path:path.id,visited});
   await wait("Boolean(document.querySelector('.animatus-tutorial-exit'))");
   await wait("!document.querySelector('.animatus-tutorial-exit') && document.querySelector('.animatus-tutorial-launcher')");
  }
 }
 // Shared skip/close behavior returns to the launcher, which restarts at path selection.
 await evaluate("document.querySelector('.animatus-tutorial-launcher').click()");
 await wait("document.querySelectorAll('.animatus-tutorial-card__choice').length===2");
 await evaluate("document.querySelector('.animatus-tutorial-card__choice').click()");
 await click('Tutorial überspringen');
 await wait("Boolean(document.querySelector('.animatus-tutorial-exit'))");
 await wait("!document.querySelector('.animatus-tutorial-exit')");
 await evaluate("document.querySelector('.animatus-tutorial-launcher').click()");
 await wait("document.querySelectorAll('.animatus-tutorial-card__choice').length===2");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait("!document.querySelector('.animatus-tutorial-card')");
 await wait("!document.querySelector('.animatus-tutorial-exit')");
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(new URL('../reports/dj-tutorial-check.json',import.meta.url),JSON.stringify({base,implementation:'Original Animatus Tutorial component',results,checks:['floating help icon bottom right','original path selection','original progress bar and spotlight','actions advance only after interaction','empty-library conditional steps','desktop/mobile viewport','original completion/skip animation','launcher restarts at selection','Escape'],errors},null,2)+'\n');
 console.log('Shared DJ tutorial checks passed:',results);
} finally {
 ws?.close();if(chrome.exitCode===null&&chrome.signalCode===null){const exited=once(chrome,'exit');chrome.kill();await exited;}await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
