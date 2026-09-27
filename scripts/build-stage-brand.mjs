import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const {createServer}=await import('node:http');
const {readFile}=await import('node:fs/promises');
const app={server:createServer(async(req,res)=>{try{if(req.url==='/dj'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');return;}res.setHeader('Content-Type',req.url.endsWith('.svg')?'image/svg+xml':req.url.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(new URL('../public'+req.url,import.meta.url)));}catch{res.statusCode=404;res.end();}})};
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;

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



  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.readyState==='complete'");
  const runs=await evaluate(`(async()=>{
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
    const ctx=canvas.getContext('2d'),logo=new Image();
    const svg=new DOMParser().parseFromString(await (await fetch('/animatus-small.svg')).text(),'image/svg+xml');
    logo.src=svg.querySelector('image').getAttribute('href');await logo.decode();
    ctx.drawImage(logo,0,0,96,96);
    const data=ctx.getImageData(0,0,96,96).data,runs=[];
    const color=(x,y)=>{const i=(y*96+x)*4;return data[i+3]<100?null:'#'+[0,1,2].map(c=>Math.min(255,Math.round(data[i+c]/32)*32).toString(16).padStart(2,'0')).join('');};
    for(let y=0;y<96;y++)for(let x=0;x<96;){const c=color(x,y),start=x++;while(x<96&&color(x,y)===c)x++;if(c)runs.push([start,y,x-start,1,c]);}
    const merged=[],last=new Map();for(const r of runs){const key=[r[0],r[2],r[4]].join(),previous=last.get(key);if(previous&&previous[1]+previous[3]===r[1])previous[3]++;else{merged.push(r);last.set(key,r);}}
    return merged;
  })()`);
  await writeFile(new URL('../public/dmx-stage-brand-data.js',import.meta.url),'// Generated from the embedded A image in animatus-small.svg; no circle, wordmark or background. Regenerate with scripts/build-stage-brand.mjs.\nexport const stageBrandRects='+JSON.stringify(runs)+';\n');
  console.log('Logo rectangles:',runs.length);

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
