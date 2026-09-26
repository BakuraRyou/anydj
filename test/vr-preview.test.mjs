import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
const scene=()=>({layout:{width:8,depth:12,height:4,room:true,positions:{}},lights:[{id:'lamp',type:'spot',position:{x:0,y:5,height:3},target:{x:0,y:2},power:.8,color:'rgb(255,0,0)'}],crowd:[],motion:0,origin:{x:0,y:1,yaw:0,eyeHeight:1.7}});
async function setup(t,options={}){const temp=await mkdtemp(join(tmpdir(),'anydj-preview-test-'));t.after(()=>rm(temp,{recursive:true,force:true}));const app=await createApp({demo:true,dataDir:temp,token:'test-preview-authentication',previewPort:0,...options});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.closeAllConnections();return new Promise(r=>app.server.close(r));});const base=`http://127.0.0.1:${app.server.address().port}`;
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
 for(const asset of ['dmx-vr-renderer.js','dmx-vr-scene.js','dmx-vr-quality.js']){const response=await fetch(bridge.origin+'/'+asset);assert.equal(response.status,200,asset);assert.match(response.headers.get('content-type'),/javascript/);}
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

test('room plans cross the paired headset bridge, validate geometry and are acknowledged once',async t=>{
 const {newRoomPlan}=await import('../public/dmx-ar-model.js');
 const {base,post}=await setup(t),{data:session}=await post('start',{});
 await post('frame',{...session,scene:scene()});
 const pairing=await (await fetch(base+'/api/vr-preview/pair?code='+session.code)).json();
 const bridge=new URL(session.urls[0]);bridge.hostname='127.0.0.1';
 for(const path of ['/dmx-ar-model.js','/dmx-ar-controls.js','/dmx-ar-planner.js','/dmx-ar.css'])assert.equal((await fetch(bridge.origin+path)).status,200,path);
 const plan=newRoomPlan(4,5,3);plan.surfaces=Array.from({length:100},()=>({kind:'wall',points:[[-2,0,0],[2,0,0],[2,0,3],[-2,0,3]]}));
 for(let i=0;i<30;i++)plan.positions['fixture-'+i]={x:0,y:2,height:1,rotation:0,size:{width:.4,depth:.3,height:.2}};
 assert.ok(JSON.stringify(plan).length>8192);
 const send=async(control,plan)=>{const res=await fetch(bridge.origin+'/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id:session.id,control,command:{action:'room-plan',plan}})});return {status:res.status,data:await res.json()};};
 assert.equal((await send('not-paired',plan)).status,403);
 assert.equal((await send(pairing.control,{...plan,boundary:[[0,0],[0,0],[1,1]]})).status,400);
 const accepted=await send(pairing.control,plan);assert.equal(accepted.status,200);
 const published=await post('frame',{...session,scene:{...scene(),roomPlan:plan}});assert.equal(published.data.commands.length,1);assert.equal(published.data.commands[0].plan.positions['fixture-0'].size.width,.4);
 const ack=await post('frame',{...session,scene:scene(),ack:[accepted.data.queued]});assert.deepEqual(ack.data.commands,[]);
});

test('imported GLB geometry survives the headset stream and return transfer',async t=>{
 const {importRoomModel}=await import('../public/dmx-room-mesh.js');
 const {newRoomPlan,validateRoomPlan,roomPlanLayout}=await import('../public/dmx-ar-model.js');
 const {roomGLB}=await import('./room-model-fixture.mjs');
 const imported=importRoomModel(roomGLB(),'Raum.glb'),plan=validateRoomPlan({...newRoomPlan(imported.width,imported.depth,imported.height),mesh:imported.mesh,representation:'model'});
 const {base,post}=await setup(t),{data:session}=await post('start',{}),bridge=new URL(session.urls[0]);bridge.hostname='127.0.0.1';
 assert.equal((await fetch(bridge.origin+'/dmx-room-mesh.js')).status,200);
 const snapshot={...scene(),layout:roomPlanLayout(plan),roomPlan:plan};
 assert.equal((await post('frame',{...session,scene:snapshot})).status,200);
 const viewer=await stream(bridge.origin,session.id);t.after(()=>viewer.close());
 const frame=await viewer.next();assert.deepEqual(frame.scene.roomPlan.mesh,plan.mesh);assert.equal(frame.scene.roomPlan.representation,'model');
 const pairing=await (await fetch(base+'/api/vr-preview/pair?code='+session.code)).json();
 const response=await fetch(bridge.origin+'/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({...pairing,command:{action:'room-plan',plan}})});
 assert.equal(response.status,200);const update=await post('frame',{...session,scene:snapshot});assert.deepEqual(update.data.commands[0].plan.mesh,plan.mesh);
 const invalid=structuredClone(plan);invalid.mesh.triangles[0][0]=999999;
 assert.equal((await post('frame',{...session,scene:{...snapshot,roomPlan:invalid}})).status,400);
});

test('LAN preview serves the full recursive module graph, including room and zone dependencies',async t=>{
 const {post}=await setup(t),{data:session}=await post('start',{}),url=new URL(session.urls[0]);url.hostname='127.0.0.1';
 const pending=['/vr-view-boot.js'],visited=new Set();
 while(pending.length){const path=pending.pop();if(visited.has(path))continue;visited.add(path);
  const response=await fetch(url.origin+path);assert.equal(response.status,200,`Preview dependency blocked: ${path}`);
  const source=await response.text();for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g))pending.push(new URL(match[1],url.origin+path).pathname);
 }
 assert.ok(visited.has('/dmx-zone-plan.js'));assert.ok(visited.has('/dmx-zone-motion.js'));assert.ok(visited.has('/dmx-light-geometry.js'));
 await post('stop',session);
});

test('remembered preview token survives a new server instance and changed session code',async t=>{
 const dataDir=await mkdtemp(join(tmpdir(),'anydj-vr-auth-test-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));
 const first=await setup(t,{dataDir}),{data:one}=await first.post('start',{});
 const pairing=await (await fetch(first.base+'/api/vr-preview/pair?code='+one.code)).json();assert.ok(pairing.token);
 await first.post('stop',one);
 const second=await setup(t,{dataDir});const resume=async token=>{const response=await fetch(second.base+'/api/vr-preview/resume',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({token})});return {status:response.status,data:await response.json()};};
 assert.equal((await resume(pairing.token)).status,404,'valid token waits when no show is active');
 assert.equal((await resume(pairing.token+'invalid')).status,401);
 const {data:two}=await second.post('start',{}),restored=await resume(pairing.token);assert.equal(restored.status,200);assert.equal(restored.data.id,two.id);assert.ok(restored.data.control);assert.notEqual(restored.data.control,pairing.control);
 const bridge=new URL(two.urls[0]);bridge.hostname='127.0.0.1';assert.equal((await fetch(bridge.origin+'/api/vr-preview/resume',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({token:pairing.token})})).status,200);
 assert.equal((await second.post('stop',{id:two.id,owner:pairing.token})).status,403,'preview token is not publisher permission');
 await second.post('stop',two);
});
