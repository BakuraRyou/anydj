import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
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
const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--autoplay-policy=no-user-gesture-required','--mute-audio','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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


  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/export-check'});await wait("document.readyState==='complete'");
  await evaluate(`(async()=>{
    const {createQueueExportMenu}=await import('/queue-export-dialog.js'),{createLosslessEncoder}=await import('/lossless-audio-encoder.js');
    const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';document.head.append(viewport);
    for(const href of ['/style.css','/dj-edit-export.css']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
    document.body.replaceChildren();document.body.className='dj-page';
    const button=document.createElement('button');button.id='queueExport';button.style.cssText='position:fixed;top:30px;right:20px';document.body.append(button);
    const createURL=URL.createObjectURL.bind(URL);window.exportBlobs=new Map();URL.createObjectURL=blob=>{const url=createURL(blob);exportBlobs.set(url,blob);return url;};
    const total=489511,duration=total/44100,left=Float32Array.from({length:total},(_,i)=>.3*Math.sin(i*2*Math.PI*440/44100)),right=Float32Array.from({length:total},(_,i)=>.2*Math.sin(i*2*Math.PI*880/44100));
    const encoder=createLosslessEncoder('wav',{total}),file=new File([encoder.header,...encoder.encode(left,right),...encoder.finish()],'test.wav',{type:'audio/wav',lastModified:1});
    const track={id:'test',name:file.name,size:file.size,lastModified:1,file,plan:{duration},audioCuts:[[2,3]],audioCutJoins:[]};
    window.exportMenu=createQueueExportMenu(button,()=>({entries:[{id:'entry',trackId:'test'}],tracks:[track],ensureFile:async()=>file,options:{musical:false,seconds:2}}));
  })()`);
  const files=[];
  for(const format of ['mp3','wav','flac']){
    await evaluate(`document.querySelector('#queueExport').click();document.querySelector('[data-export-format=${format}]').click()`);
    await wait("document.querySelector('.dj-export-dialog[open]')");
    assert.equal(await evaluate("document.querySelector('[data-format]').value"),format);
    assert.equal(await evaluate("document.querySelector('[data-quality]').hidden"),format!=='mp3');
    await evaluate("document.querySelector('[data-start]').click()");
    await wait("!document.querySelector('[data-download]').hidden");
    const data=await evaluate(`(async()=>{const a=document.querySelector('[data-download]'),blob=exportBlobs.get(a.href),bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return {base64:btoa(binary),type:blob.type,name:a.download};})()`);
    assert.ok(data.name.endsWith('.'+format));assert.equal(data.type,format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':'audio/flac');
    const output=join(tmpdir(),`anydj-export-format.${format}`);await writeFile(output,Buffer.from(data.base64,'base64'));files.push(output);
    await evaluate("document.querySelector('[data-close]').click()");await wait("!document.querySelector('.dj-export-dialog')");
    assert.equal(await evaluate("document.activeElement.id"),'queueExport');
  }
  const run=promisify(execFile),decoded=[];
  for(const path of files){
    const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',path]);
    const info=JSON.parse(stdout),format=path.split('.').at(-1);assert.equal(info.streams[0].codec_name,format==='wav'?'pcm_s16le':format);assert.equal(info.streams[0].channels,2);assert.equal(Number(info.streams[0].sample_rate),44100);assert.ok(Math.abs(Number(info.format.duration)-445411/44100)<.1);
    if(format!=='mp3'){const {stdout:pcm}=await run('ffmpeg',['-v','error','-i',path,'-f','s16le','pipe:1'],{encoding:'buffer',maxBuffer:4*1024*1024});decoded.push(pcm);}
  }
  assert.deepEqual(decoded[0],decoded[1],'WAV and FLAC decode to identical rendered audio across chunk boundaries');
  for(const width of [1280,390]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
    await evaluate("document.querySelector('#queueExport').click()");await wait("document.querySelector('#queueExport').getAttribute('aria-expanded')==='true'");
    const bounds=await evaluate("(()=>{const r=document.querySelector('#queueExportMenu').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()");assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height,JSON.stringify(bounds));
    await writeFile(join(tmpdir(),`anydj-export-menu-${width}.png`),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("document.querySelector('#queueExport').getAttribute('aria-expanded')==='false'");
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({files,message:'Export menu passed: MP3/WAV/FLAC from shared renderer, cuts, file extension/MIME, focus return, Escape, desktop/mobile positioning.'}));

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
