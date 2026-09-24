import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
const scene=()=>({layout:{width:8,depth:12,height:4,room:true,positions:{}},lights:[{id:'lamp',type:'spot',position:{x:0,y:5,height:3},target:{x:0,y:2},power:.8,color:'rgb(255,0,0)'}],crowd:[],motion:0,origin:{x:0,y:1,yaw:0,eyeHeight:1.7}});
async function setup(t,options={}){const app=await createApp({demo:true,token:'test-preview-authentication',previewPort:0,...options});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.closeAllConnections();return new Promise(r=>app.server.close(r));});const base=`http://127.0.0.1:${app.server.address().port}`;
const post=async(action,body)=>{const res=await fetch(base+'/api/vr-preview/'+action,{method:'POST',headers:{Authorization:'Bearer test-preview-authentication','Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};return {base,post};}
async function stream(base,id){const abort=new AbortController();const res=await fetch(base+'/api/vr-preview/stream?id='+id,{signal:abort.signal});assert.equal(res.status,200);const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';return {close(){abort.abort();},async next(){for(;;){const match=buffer.match(/data: (.+)\n\n/);if(match){buffer=buffer.slice(match.index+match[0].length);return JSON.parse(match[1]);}const {value,done}=await reader.read();if(done)throw Error('stream ended');buffer+=decoder.decode(value,{stream:true});}}};}
test('preview sends complete snapshots, reconnects with latest state, and isolates the LAN reader',async t=>{
 const {base,post}=await setup(t);const started=await post('start',{});assert.equal(started.status,200);const session=started.data;assert.ok(session.urls.length);const bridge=new URL(session.urls[0]);bridge.hostname='127.0.0.1';bridge.hash='';bridge.pathname='';
 const landing=await fetch(bridge.origin+'/');assert.equal(landing.status,200);assert.match(await landing.text(),/joinPreview/);
 assert.match(session.code,/^\d{6}$/);
 const paired=await fetch(bridge.origin+'/api/vr-preview/pair?code='+session.code);assert.equal(paired.status,200);const pairing=await paired.json();assert.equal(pairing.id,session.id);assert.match(pairing.control,/^[A-Za-z0-9_-]{24}$/);
 assert.equal((await fetch(bridge.origin+'/api/vr-preview/pair?code=abc')).status,400);
 assert.equal((await fetch(bridge.origin+'/vr-view/')).status,200);
 assert.equal((await fetch(bridge.origin+'/vr-view')).status,200);
 assert.equal((await fetch(bridge.origin+'/api/dmx/status')).status,403);
 assert.equal((await fetch(bridge.origin+'/api/vr-preview/start',{method:'POST'})).status,403);
 assert.equal((await fetch(base+'/api/dmx/status')).status,401);
 const data=scene();assert.equal((await post('frame',{id:session.id,owner:'wrong',scene:data})).status,403);
 assert.equal((await post('frame',{...session,scene:data})).status,200);
 let viewer=await stream(bridge.origin,session.id);t.after(()=>viewer.close());let frame=await viewer.next();assert.equal(frame.scene.layout.width,8);assert.equal(frame.scene.lights[0].power,.8);
 data.layout.width=10;data.lights[0].power=.2;await post('frame',{...session,scene:data});frame=await viewer.next();assert.equal(frame.seq,2);assert.equal(frame.scene.layout.width,10);
 viewer.close();viewer=await stream(bridge.origin,session.id);frame=await viewer.next();assert.equal(frame.seq,2);assert.equal(frame.scene.lights[0].power,.2);
 assert.equal((await post('stop',session)).status,200);viewer.close();assert.equal((await fetch(bridge.origin+'/api/vr-preview/pair?code='+session.code)).status,404);assert.equal((await fetch(bridge.origin+'/api/vr-preview/stream?id='+session.id)).status,404);
});
test('invalid geometry is rejected before relaying',async t=>{const {post}=await setup(t);const {data:session}=await post('start',{});const value=scene();value.layout.width=1e9;assert.equal((await post('frame',{...session,scene:value})).status,400);await post('stop',session);});

test('configured preview port remains stable and reports conflicts instead of silently changing',async t=>{
 const blocker=createServer();blocker.listen(0,'0.0.0.0');await once(blocker,'listening');const port=blocker.address().port;
 t.after(()=>{if(blocker.listening)blocker.close();});
 const {post}=await setup(t,{previewPort:port});const conflict=await post('start',{});assert.equal(conflict.status,409);assert.match(conflict.data.error.message,/bereits belegt/);
 await new Promise(r=>blocker.close(r));
 const first=await post('start',{});assert.equal(first.status,200);assert.equal(Number(new URL(first.data.urls[0]).port),port);
 await post('stop',first.data);const next=await post('start',{});assert.equal(new URL(next.data.urls[0]).origin,new URL(first.data.urls[0]).origin);await post('stop',next.data);
});

test('paired headset can queue limited commands, publisher acknowledges once, read link cannot control',async t=>{
 const {post}=await setup(t);const {data:session}=await post('start',{});const bridge=new URL(session.urls[0]);bridge.hostname='127.0.0.1';
 const pairing=await (await fetch(bridge.origin+'/api/vr-preview/pair?code='+session.code)).json();
 const send=async(control,command)=>fetch(bridge.origin+'/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id:session.id,control,command})});
 assert.equal((await fetch(bridge.origin+'/dmx-vr-console.js')).status,200);
 assert.equal((await send(undefined,{action:'playing',deck:'A',value:true})).status,403);
 assert.equal((await send(pairing.control,{action:'delete',deck:'A'})).status,400);
 assert.equal((await send(pairing.control,{action:'playing',deck:'A',value:'yes'})).status,400);
 const queued=await send(pairing.control,{action:'playing',deck:'B',value:true});assert.equal(queued.status,200);const {queued:id}=await queued.json();
 const first=await post('frame',{...session,scene:scene()});assert.equal(first.data.commands.length,1);assert.equal(first.data.commands[0].deck,'B');
 const retry=await post('frame',{...session,scene:scene()});assert.equal(retry.data.commands[0].id,id);
 const ack=await post('frame',{...session,scene:scene(),ack:[id]});assert.deepEqual(ack.data.commands,[]);
 await post('stop',session);assert.equal((await send(pairing.control,{action:'select',deck:'A'})).status,404);
});

test('fixed test path pairs latest active preview with controls and survives session replacement',async t=>{
 const {base,post}=await setup(t);
 assert.equal((await fetch(base+'/api/vr-preview/test-connect')).status,404);
 const {data:first}=await post('start',{}),bridge=new URL(first.urls[0]);bridge.hostname='127.0.0.1';
 for(const path of ['/vr-test','/vr-test/'])assert.equal((await fetch(bridge.origin+path)).status,200);
 const connect=async()=>{const res=await fetch(bridge.origin+'/api/vr-preview/test-connect');return {status:res.status,data:await res.json()};};
 const pairing=await connect();assert.equal(pairing.data.id,first.id);assert.ok(pairing.data.control);
 const res=await fetch(bridge.origin+'/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({...pairing.data,command:{action:'select',deck:'B'}})});assert.equal(res.status,200);
 assert.equal((await post('frame',{...first,scene:scene()})).data.commands[0].deck,'B');
 const {data:second}=await post('start',{});assert.equal((await connect()).data.id,second.id);
 await post('stop',second);assert.equal((await connect()).data.id,first.id);
 await post('stop',first);assert.equal((await connect()).status,404);
});
