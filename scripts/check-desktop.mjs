import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'anydj-desktop-'));
const executable=resolve(process.argv[2]||'dist/linux-unpacked/anydj');
const songIndex=process.argv.indexOf('--song');
const song=songIndex>=0?resolve(process.argv[songIndex+1]):null;
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,['--demo','--isolated-test','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`],{env,stdio:['ignore','ignore','pipe']});
let ws,log='';child.stderr.on('data',chunk=>{log+=chunk;});
const deadline=setTimeout(()=>{console.error(log);child.kill('SIGKILL');process.exitCode=1;},song?300000:60000);
try {
  const endpoint=await new Promise((resolve,reject)=>{
    child.stderr.on('data',()=>{const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1]);});
    child.once('error',reject);child.once('exit',code=>reject(Error(`Desktop exited ${code}: ${log}`)));
  });
  ws=new WebSocket(endpoint);await once(ws,'open',{signal:AbortSignal.timeout(10000)});let id=0;const pending=new Map();
  ws.onclose=()=>{for(const callback of pending.values())callback.reject(Error('Desktop debugger closed'));pending.clear();};
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const callback=pending.get(message.id);pending.delete(message.id);message.error?callback.reject(Error(JSON.stringify(message.error))):callback.resolve(message.result);};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
  let target;
  for(let i=0;i<100;i++){
    const {targetInfos}=await send('Target.getTargets');target=targetInfos.find(t=>t.type==='page'&&t.url.endsWith('/dj'));
    if(target)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!target)throw Error('DJ window did not open');
  const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const evaluate=async expression=>{
    const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(reply.exceptionDetails)throw Error(JSON.stringify(reply.exceptionDetails));return reply.result.value;
  };
  let ready=false;
  for(let i=0;i<100;i++){
    ready=await evaluate("Boolean(document.querySelector('#djLamp')?.options.length>1)");
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw Error('Demo lamp/UI did not initialize');
  const result=await evaluate(`(async()=>({url:location.href,decks:document.querySelectorAll('.dj-deck').length,nodeExposed:typeof process!=='undefined'||typeof require!=='undefined',status:(await fetch('/api/devices')).status}))()`);
  if(result.decks!==2||result.nodeExposed||result.status!==200)throw Error(JSON.stringify(result));
  const analysis=await evaluate(`Promise.all(['beats','style','structure'].map(async name=>({name,...await (await fetch('/api/analysis/'+name)).json()})))`);
  if(!process.argv.includes('--lite')&&analysis.some(engine=>!engine.available))throw Error('Packaged analysis unavailable: '+JSON.stringify(analysis));
  let songStatus=null;
  if(song){
    const started=Date.now();
    const {result:input}=await send('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"},sessionId);
    await send('DOM.setFileInputFiles',{objectId:input.objectId,files:[song]},sessionId);
    while(Date.now()-started<240000){
      songStatus=await evaluate("(()=>{const s=document.querySelector('#trackList small');return s?{text:s.textContent,detail:s.title,kind:s.dataset.analysis}:null})()");
      if(songStatus?.kind==='warning')throw Error('Song analysis incomplete: '+JSON.stringify(songStatus));
      if(songStatus?.text.includes('Vollständig berechnet'))break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!songStatus?.text.includes('Vollständig berechnet'))throw Error('Song analysis did not finish: '+JSON.stringify(songStatus));
    songStatus.seconds=Math.round((Date.now()-started)/100)/10;
  }
  console.log(JSON.stringify({desktopSmoke:true,...result,analysis,songStatus},null,2));
  await send('Runtime.evaluate',{expression:'window.close()'},sessionId).catch(()=>{});
} finally {
  clearTimeout(deadline);ws?.close();
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}
  await rm(profile,{recursive:true,force:true});
}
