import test from 'node:test';
import assert from 'node:assert/strict';
import {alignedOrigin,applyRoomPlan,area,detectedRoomSurfaces,floorRay,insideRoom,newRoomPlan,roomFromFloor,roomFixtureHit,triangulateFloor,validateRoomPlan,xrToRoom} from '../public/dmx-ar-model.js';
import {worldToXR,createStageVR} from '../public/dmx-stage-vr.js';
import {createARControls} from '../public/dmx-ar-controls.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const close=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-7,`${actual} != ${expected}`));
const fixture={x:0,y:2,height:1,rotation:0,size:{width:.4,depth:.2,height:.3}};
const scene=()=>({layout:{width:8,depth:6,positions:{}},lights:[{id:'lamp',position:{x:1,y:2,height:3},target:{x:0,y:1},power:1,type:'moving',color:'#ffffff'}],crowd:[],motion:0});

test('AR calibration preserves metre scale, yaw and floor with round trips',()=>{
  const plan=newRoomPlan(4,5,3),left=[1,.4,-2],right=[1,.4,2],origin=alignedOrigin(plan,left,right);
  close(worldToXR([-2,0,0],origin),left);close(worldToXR([2,0,0],origin),right);
  close(xrToRoom(worldToXR([.3,2,1.2],origin),origin),[.3,2,1.2]);
  assert.throws(()=>alignedOrigin(plan,left,left),/25 cm/);
});

test('capture transforms scanned polygons to portable room coordinates without resizing',()=>{
  const points=[[2,.2,-1],[6,.2,-1],[6,.2,-6],[2,.2,-6]],walls=[{kind:'wall',points:[points[0],points[1],[6,3.2,-1],[2,3.2,-1]]}];
  const {plan,origin}=roomFromFloor(points,walls);
  assert.equal(plan.width,4);assert.equal(plan.depth,5);assert.equal(plan.height,3);
  plan.boundary.forEach((p,i)=>close(worldToXR([...p,0],origin),points[i]));
  assert.equal(plan.surfaces[0].kind,'wall');assert.equal(plan.surfaces[0].points[2][2],3);
});

test('concave floor triangulation keeps recesses empty and rejects invalid saved geometry',()=>{
  const plan=newRoomPlan(4,4,3);plan.boundary=[[-2,0],[2,0],[2,2],[0,2],[0,4],[-2,4]];
  const triangles=triangulateFloor(validateRoomPlan(plan).boundary);
  assert.equal(triangles.length,4);assert.equal(triangles.reduce((n,p)=>n+Math.abs(area(p)),0),12);
  assert.equal(insideRoom([1,3],plan.boundary),false);assert.equal(insideRoom([-1,3],plan.boundary),true);
  for(const changes of [{width:Infinity},{boundary:[[0,0],[1,1],[0,1],[1,0]]},{boundary:[[-2,0],[2,0],[2,4],[-2,0]]},{positions:{lamp:{...fixture,x:10}}},{surfaces:[{points:[[0,0,NaN],[1,0,0],[0,1,0]]}]}])assert.throws(()=>validateRoomPlan({...plan,...changes}));
});

test('room layout uses explicit positions without proportional scaling; bar cell offsets rotate rigidly',()=>{
  const plan=newRoomPlan(4,5,3);plan.positions.lamp={...fixture,rotation:90};
  const source=scene();source.lights=[{...source.lights[0],position:{x:.8,y:2,height:3}},{...source.lights[0],position:{x:1.2,y:2,height:3}}];
  const result=applyRoomPlan(source,plan,true);
  close([result.lights[0].position.x,result.lights[0].position.y,result.lights[0].position.height],[0,1.8,1]);
  close([result.lights[1].position.x,result.lights[1].position.y],[0,2.2]);
  assert.deepEqual(source.lights[0].position,{x:.8,y:2,height:3});assert.equal(result.layout.ar,true);
});

test('plane detection reads XRFrame planes and transforms all vertices through planeSpace',()=>{
  const plane={semanticLabel:'floor',orientation:'horizontal',planeSpace:{},polygon:[{x:0,y:0,z:0},{x:2,y:0,z:0},{x:0,y:0,z:-3}]};
  const surfaces=detectedRoomSurfaces({detectedPlanes:new Set([plane]),getPose:()=>({transform:{matrix:matrix(2,.1,4)}})},{});
  assert.equal(surfaces[0].kind,'floor');close(surfaces[0].points[2],[2,.1,1]);
  assert.deepEqual(detectedRoomSurfaces({},{}),[]);
});

test('floor rays reject backwards, parallel and distant intersections',()=>{
  const m=matrix(2,1,3);m[9]=1;m[10]=1;
  close(floorRay(m),[2,0,2]);m[9]=-1;assert.equal(floorRay(m),null);m[9]=0;assert.equal(floorRay(m),null);
});

test('AR renderer emits no opaque floor and renders measured device dimensions',()=>{
  const plan=newRoomPlan(4,5,3);plan.positions.lamp={...fixture,rotation:90};
  const value=applyRoomPlan(scene(),plan,true),polygons=[];
  drawStageGeometry(value.layout,value.lights,[],0,{polygon:(points,fill,alpha)=>polygons.push({points,fill,alpha})});
  assert.equal(polygons.some(p=>p.fill==='#182c3b'),false);
  const body=polygons.filter(p=>['#344454','#40566a','#263747','#2a3d50','#60788a'].includes(p.fill)).flatMap(p=>p.points);
  assert.ok(body.length);assert.ok(Math.abs(Math.max(...body.map(p=>p[0]))-.1)<1e-7);assert.ok(Math.abs(Math.max(...body.map(p=>p[1]))-2.2)<1e-7);
});

function controlsHarness({floorAvailable=true,sessionExtras={}}={}) {
  let plan=newRoomPlan(4,5,3);plan.positions.lamp=structuredClone(fixture);
  const planner={get plan(){return plan;},save(value){plan=validateRoomPlan(value);},use(value){this.save(value);},seed(){}};
  const reference=new EventTarget(),right={handedness:'right',targetRaySpace:{},gamepad:{axes:[0,0,1,1]}},session=Object.assign(new EventTarget(),{inputSources:[right],...sessionExtras});
  let ray=matrix(.3,1.3,0),surfaces=new Set(),time=0;
  const head=matrix(0,1.7,0),frame={getPose:space=>({transform:{matrix:space===right.targetRaySpace?ray:matrix()}}),get detectedPlanes(){return surfaces;}};
  const controls=createARControls({planner,session,reference,floorAvailable,exit(){},command:async()=>{}});
  const update=()=>controls.update(frame,reference,{transform:{matrix:head}},session,scene(),{},time+=600);
  const aim=point=>{const start=[.3,1.3,0],d=point.map((p,i)=>p-start[i]),n=Math.hypot(...d);ray=matrix(...start);ray[8]=-d[0]/n;ray[9]=-d[1]/n;ray[10]=-d[2]/n;};
  const select=()=>controls.select({frame,inputSource:right});
  const click=id=>{const overlay=update(),button=overlay.canvasState.buttons.find(b=>b[0]===id);assert.ok(button,id);const [,x,y,w,h]=button,p=overlay.panel;aim(p.center.map((n,i)=>n+(x+w/2-.5)*p.width*p.right[i]+(.5-y-h/2)*p.height*p.up[i]));select();};
  return {controls,planner,reference,frame,session,click,update,aim,select,setRay:value=>ray=value,setPlanes:value=>surfaces=value,grip(type){const event=new Event(type);Object.assign(event,{frame,inputSource:right});session.dispatchEvent(event);}};
}

test('controller workflow aligns a saved room, places a device, edits height and disables artificial motion',()=>{
  const h=controlsHarness();assert.equal(h.controls.scene(scene()).lights.length,0);
  h.click('align');h.aim([-2,0,-1]);h.select();h.aim([2,0,-1]);h.select();
  assert.equal(h.controls.scene(scene()).lights.length,1);
  const origin={...h.controls.origin};h.click('details');h.click('place');h.aim([1,0,-3]);h.select();
  close([h.planner.plan.positions.lamp.x],[1]);close([h.planner.plan.positions.lamp.y],[2]);
  h.click('details');h.click('higher');assert.equal(h.planner.plan.positions.lamp.height,1.1);
  h.click('rotate-right');assert.equal(h.planner.plan.positions.lamp.rotation,15);
  h.update();assert.deepEqual(h.controls.origin,origin);
  h.reference.dispatchEvent(new Event('reset'));assert.equal(h.controls.scene(scene()).lights.length,0);h.controls.destroy();
});

test('controller manual capture stores arbitrary boundary and requires explicit floor calibration without local-floor',()=>{
  const h=controlsHarness();h.click('manual');for(const p of [[-2,0,-1],[2,0,-1],[2,0,-3],[0,0,-3],[0,0,-5],[-2,0,-5]]){h.aim(p);h.select();}
  h.click('finish');assert.equal(h.planner.plan.boundary.length,6);assert.equal(h.planner.plan.width,4);assert.equal(h.planner.plan.depth,4);h.controls.destroy();
  const missing=controlsHarness({floorAvailable:false});missing.click('manual');assert.match(missing.update().canvasState.title,/Bodenhöhe/);missing.controls.destroy();
});

test('detected room capture is reviewed before replacing the room and preserves the old plan until adoption',()=>{
  const h=controlsHarness(),id=h.planner.plan.id;
  h.setPlanes(new Set([{planeSpace:{},orientation:'horizontal',semanticLabel:'floor',polygon:[{x:-2,y:0,z:-1},{x:2,y:0,z:-1},{x:2,y:0,z:-6},{x:-2,y:0,z:-6}]}]));
  h.click('scan');assert.match(h.update().canvasState.lines[0],/Boden 1 von 1/);assert.equal(h.planner.plan.id,id);
  h.click('adopt');assert.notEqual(h.planner.plan.id,id);assert.equal(h.planner.plan.depth,5);h.controls.destroy();
});

test('AR session checks independent support, requests optional features, and recovers from denied permission',async()=>{
  const button={setAttribute(){}},arButton={setAttribute(){}},status={},requests=[];
  class Session extends EventTarget {environmentBlendMode='alpha-blend';async requestReferenceSpace(){return new EventTarget();}updateRenderState(){}requestAnimationFrame(fn){this.frame=fn;}async end(){this.dispatchEvent(new Event('end'));}}
  const session=new Session(),xr=new EventTarget();xr.isSessionSupported=async mode=>mode==='immersive-ar';xr.requestSession=async(...args)=>{requests.push(args);return session;};
  let rendered,destroyed=0;const graphics={layer:{},render(...args){rendered=args;},destroy(){destroyed++;}};
  const planner={plan:newRoomPlan(),active:false};
  const controller=createStageVR({button,arButton,planner,status,xr,secure:true,getScene:scene,getOrigin:()=>({x:0,y:0,yaw:0,eyeHeight:1.7}),createGraphics:async()=>graphics});
  await tick();assert.equal(button.disabled,true);assert.equal(arButton.disabled,false);
  arButton.onclick();await tick();assert.equal(requests[0][0],'immersive-ar');assert.deepEqual(requests[0][1].optionalFeatures,['local-floor','plane-detection','anchors']);
  session.frame(100,{getViewerPose:()=>({views:[],transform:{matrix:matrix(0,1.7,0)}}),getPose:()=>null});
  assert.equal(rendered[1].layout.ar,true);assert.equal(rendered[1].lights.length,0);
  await controller.stop();await tick();assert.equal(destroyed,1);assert.equal(arButton.disabled,false);
  xr.requestSession=async()=>{throw new DOMException('Denied','NotAllowedError');};arButton.onclick();await tick();await tick();assert.match(status.textContent,/nicht freigegeben/);assert.equal(arButton.disabled,false);controller.destroy();
});

test('persistent anchors retain calibration, hide fixtures while tracking is lost, and release on end',async t=>{
 const store=new Map(),oldStorage=globalThis.localStorage,oldTransform=globalThis.XRRigidTransform;
 globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.XRRigidTransform=class{constructor(position,orientation){this.position=position;this.orientation=orientation;}};
 t.after(()=>{if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;if(oldTransform===undefined)delete globalThis.XRRigidTransform;else globalThis.XRRigidTransform=oldTransform;});
 const h=controlsHarness(),space={};let deleted=0,anchorPose=matrix(-2,0,-1),created;
 const anchor={anchorSpace:space,delete(){deleted++;},async requestPersistentHandle(){return 'test-anchor';}};
 const getPose=h.frame.getPose;h.frame.getPose=s=>s===space?(anchorPose?{transform:{matrix:anchorPose}}:null):getPose(s);
 h.frame.createAnchor=async pose=>{created=pose;return anchor;};
 h.click('align');h.aim([-2,0,-1]);h.select();h.aim([2,0,-1]);h.select();h.update();await tick();
 close([created.position.x,created.position.y,created.position.z],[-2,0,-1]);assert.equal(store.get('anydj-ar-anchor-'+h.planner.plan.id),'test-anchor');
 h.update();assert.equal(h.controls.scene(scene()).lights.length,1);anchorPose=null;h.update();assert.equal(h.controls.scene(scene()).lights.length,0);
 anchorPose=matrix(-2,0,-1);h.update();assert.equal(h.controls.scene(scene()).lights.length,1);h.controls.destroy();assert.equal(deleted,1);
});

test('late anchor creation after session end cannot retain resources or persistent handles',async t=>{
 const oldTransform=globalThis.XRRigidTransform;globalThis.XRRigidTransform=class{};t.after(()=>{if(oldTransform===undefined)delete globalThis.XRRigidTransform;else globalThis.XRRigidTransform=oldTransform;});
 const h=controlsHarness();let ready,deleted=0;h.frame.createAnchor=()=>new Promise(resolve=>ready=resolve);
 h.click('align');h.aim([-2,0,-1]);h.select();h.aim([2,0,-1]);h.select();h.update();h.controls.destroy();ready({delete(){deleted++;}});await tick();assert.equal(deleted,1);
});

test('AR room drawing exposes only relevant actions and cannot finish before three corners',()=>{
 const h=controlsHarness();h.click('manual');let overlay=h.update();
 assert.deepEqual(overlay.canvasState.buttons.map(b=>b[0]),['finish','undo','cancel','exit']);
 assert.ok(overlay.canvasState.disabledButtons.includes('finish'));
 const original=h.planner.plan.id;h.click('finish');assert.equal(h.planner.plan.id,original);
 for(const p of [[-2,0,-1],[2,0,-1],[2,0,-5]]){h.aim(p);h.select();}
 overlay=h.update();assert.ok(!overlay.canvasState.disabledButtons.includes('finish'));assert.ok(overlay.worldLines.length>20,'corners have visible markers and numbers');
 h.click('cancel');assert.equal(h.planner.plan.id,original);assert.equal(h.controls.scene(scene()).lights.length,0);h.controls.destroy();
});

test('AR adding a device takes one palette selection and one trigger, with no draft saved',()=>{
 const h=controlsHarness();h.click('align');h.aim([-2,0,-1]);h.select();h.aim([2,0,-1]);h.select();
 h.click('new-spot');assert.equal(Object.keys(h.planner.plan.positions).length,1);
 h.aim([1,0,-3]);const overlay=h.update();assert.match(overlay.canvasState.title,/Scheinwerfer 1/);assert.match(overlay.canvasState.lines[0],/Grüne Vorschau/);assert.ok(overlay.worldLines.length>=12);
 assert.equal(h.controls.scene(scene()).lights.length,2,'full fixture preview appears before saving');
 h.select();const id=Object.keys(h.planner.plan.positions).find(id=>id!=='lamp');assert.equal(h.planner.plan.positions[id].name,'Scheinwerfer 1');close([h.planner.plan.positions[id].x],[1]);close([h.planner.plan.positions[id].y],[2]);
 assert.ok(h.update().canvasState.buttons.some(b=>b[0]==='new-spot'),'returns directly to the palette');
 assert.ok(!h.update().canvasState.buttons.some(b=>b[0]==='higher'),'numeric adjustment is secondary');
 h.aim([-1,0,-4]);h.select();close([h.planner.plan.positions[id].x],[1]);
 h.click('new-spot');h.click('cancel');assert.equal(Object.keys(h.planner.plan.positions).length,2,'cancel does not leave an unplaced fixture');
 h.click('undo-edit');assert.equal(Object.keys(h.planner.plan.positions).length,1);h.controls.destroy();
});

test('detected floor adoption accepts a closed polygon with repeated edge vertices',()=>{
  const h=controlsHarness(),old=h.planner.plan.id;
  const polygon=[{x:-2,y:0,z:-1},{x:2,y:0,z:-1},{x:2,y:0,z:-1},{x:2,y:0,z:-6},{x:-2,y:0,z:-6},{x:-2,y:0,z:-1}];
  h.setPlanes(new Set([{planeSpace:{},orientation:'horizontal',semanticLabel:'floor',polygon}]));
  h.click('scan');assert.match(h.update().canvasState.lines[0],/Boden 1 von 1/);
  h.click('adopt');assert.notEqual(h.planner.plan.id,old,h.update().canvasState.lines.join(' '));
  assert.equal(h.planner.plan.boundary.length,4);
  assert.equal(h.planner.plan.surfaces[0].points.length,4);
  assert.equal(h.planner.plan.width,4);assert.equal(h.planner.plan.depth,5);
  h.controls.destroy();
});

test('manual floor capture accepts a repeated closing corner but still rejects crossing boundaries',()=>{
  const points=[[2,.2,-1],[6,.2,-1],[6,.2,-6],[2,.2,-6]];
  const {plan,origin}=roomFromFloor([...points,points[0]]);
  assert.equal(plan.boundary.length,4);
  plan.boundary.forEach((p,i)=>close(worldToXR([...p,0],origin),points[i]));
  assert.throws(()=>roomFromFloor([points[0],points[2],points[1],points[3],points[0]]));
});

function alignedControls(){const h=controlsHarness();h.click('align');h.aim([-2,0,-1]);h.select();h.aim([2,0,-1]);h.select();return h;}

test('direct grip moves a fixture in three dimensions, previews first and saves once on release',()=>{
 const h=alignedControls(),before=structuredClone(h.planner.plan.positions.lamp);
 // The fixture is at (0, 1, -3) in XR after A/B alignment.
 h.setRay(matrix(0,1.15,-1));h.update();h.grip('squeezestart');
 h.setRay(matrix(.7,1.65,-1.5));h.update();
 assert.deepEqual(h.planner.plan.positions.lamp,before,'moving is not persisted every frame');
 const preview=h.controls.scene(scene()).layout.positions.lamp;
 close([preview.x,preview.y,preview.height],[.7,2.5,1.5]);
 h.grip('squeeze');h.grip('squeezeend');
 close([h.planner.plan.positions.lamp.x,h.planner.plan.positions.lamp.y,h.planner.plan.positions.lamp.height],[.7,2.5,1.5]);
 h.click('undo-edit');assert.deepEqual(h.planner.plan.positions.lamp,before);h.controls.destroy();
});

test('invalid drops, tracking loss and reference reset do not overwrite a fixture',()=>{
 for(const abort of ['outside','pose','reset','disconnect','hidden']){
   const h=alignedControls(),before=structuredClone(h.planner.plan.positions.lamp);
   h.setRay(matrix(0,1.15,-1));h.update();h.grip('squeezestart');
   if(abort==='outside'){h.setRay(matrix(20,1.15,-1));assert.match(h.update().canvasState.lines[0],/Rot/);}
   if(abort==='pose'){const getPose=h.frame.getPose;h.frame.getPose=()=>null;h.update();h.frame.getPose=getPose;}
   if(abort==='reset')h.reference.dispatchEvent(new Event('reset'));
   if(abort==='disconnect'){h.session.inputSources=[];h.session.dispatchEvent(new Event('inputsourceschange'));}
   if(abort==='hidden'){h.session.visibilityState='hidden';h.session.dispatchEvent(new Event('visibilitychange'));}
   h.grip('squeezeend');assert.deepEqual(h.planner.plan.positions.lamp,before,abort);h.controls.destroy();
 }
});

test('trigger picks a fixture directly for click placement and the panel takes priority',()=>{
 const h=alignedControls();h.setRay(matrix(0,1.15,-1));h.update();h.select();
 h.aim([1,0,-4]);h.select();close([h.planner.plan.positions.lamp.x],[1]);close([h.planner.plan.positions.lamp.y],[3]);
 h.click('details');assert.ok(h.update().canvasState.buttons.some(b=>b[0]==='higher'));h.controls.destroy();
});

test('ray selection chooses the nearest rotated fixture and ignores misses and fixtures behind the ray',()=>{
 const plan=newRoomPlan();plan.positions={near:{...fixture,y:2,rotation:45},far:{...fixture,y:4},behind:{...fixture,y:0}};
 const ray=matrix(0,1.15,-1),origin={x:0,y:0,yaw:0};
 assert.equal(roomFixtureHit(ray,origin,plan).id,'near');
 assert.equal(roomFixtureHit(matrix(3,1.15,-1),origin,plan),null);
 assert.equal(roomFixtureHit(matrix(0,4,-1),origin,plan),null);
});


test('grip rotation follows the hand and a cancelled squeeze never commits',()=>{
 const h=alignedControls(),before=structuredClone(h.planner.plan.positions.lamp);
 h.setRay(matrix(0,1.15,-1));h.update();h.grip('squeezestart');
 const rotated=matrix(0,1.15,-1),a=Math.PI/6;rotated[0]=rotated[10]=Math.cos(a);rotated[2]=-Math.sin(a);rotated[8]=Math.sin(a);
 h.setRay(rotated);h.update();close([h.controls.scene(scene()).layout.positions.lamp.rotation],[30]);
 h.grip('squeezeend');assert.deepEqual(h.planner.plan.positions.lamp,before,'end without squeeze means cancellation');
 h.setRay(matrix(0,1.15,-1));h.update();h.grip('squeezestart');h.setRay(rotated);h.update();h.grip('squeeze');h.grip('squeezeend');
 close([h.planner.plan.positions.lamp.rotation],[30]);h.controls.destroy();
});

test('new fixture can be lifted before its first placement and disappears on cancel',()=>{
 const h=alignedControls();h.click('new-spot');h.aim([1,0,-3]);h.update();h.grip('squeezestart');
 h.setRay(matrix(0,2,-1));h.update();assert.equal(Object.keys(h.planner.plan.positions).length,1);
 h.grip('squeezeend');assert.equal(Object.keys(h.planner.plan.positions).length,1);assert.equal(h.controls.scene(scene()).lights.length,1);
 h.click('new-spot');h.aim([1,0,-3]);h.update();h.grip('squeezestart');h.grip('squeeze');h.grip('squeezeend');
 assert.equal(Object.keys(h.planner.plan.positions).length,2);h.controls.destroy();
});


test('room light targets survive serialization and affect the scene without moving the fixture',()=>{
 const plan=newRoomPlan();plan.positions.lamp={...fixture,target:{x:-2,y:4}};
 const saved=validateRoomPlan(JSON.parse(JSON.stringify(plan)));
 assert.deepEqual(saved.positions.lamp.target,{x:-2,y:4});
 const before=scene(),result=applyRoomPlan(before,saved);
 assert.deepEqual(result.lights[0].target,{x:-2,y:4});
 assert.equal(result.lights[0].position.x,fixture.x);
 assert.deepEqual(before.lights[0].target,{x:0,y:1});
 assert.throws(()=>validateRoomPlan({...plan,positions:{lamp:{...fixture,target:{x:100,y:4}}}}));
 const legacy=validateRoomPlan({...plan,positions:{lamp:fixture}});assert.equal(legacy.positions.lamp.target,undefined);
});

test('planned light types reach the 3D scene even without a connected show device',()=>{
 const plan=newRoomPlan();plan.positions={head:{...fixture,type:'moving'},spot:{...fixture,type:'spot',x:1},bar:{...fixture,type:'bar',x:-1}};
 const result=applyRoomPlan({...scene(),lights:[]},plan);
 assert.deepEqual(result.lights.map(light=>[light.id,light.type]),[['head','moving'],['spot','spot'],['bar','bar']]);
});

test('target direction determines persisted yaw, including after moving the fixture',()=>{
 const plan=newRoomPlan();plan.positions.lamp={...fixture,type:'spot',target:{x:2,y:2}};
 assert.equal(validateRoomPlan(plan).positions.lamp.rotation,90);
 plan.positions.lamp.target={x:-2,y:2};assert.equal(validateRoomPlan(plan).positions.lamp.rotation,270);
 plan.positions.lamp.target={x:0,y:4};assert.equal(validateRoomPlan(plan).positions.lamp.rotation,180);
 plan.positions.lamp.x=-2;assert.equal(validateRoomPlan(plan).positions.lamp.rotation,135);
 plan.positions.lamp.target={x:-2,y:2};plan.positions.lamp.rotation=40;
 assert.equal(validateRoomPlan(plan).positions.lamp.rotation,40,'directly below retains a defined yaw');
});

test('unlit 3D fixtures turn and tilt with the target rather than only changing the beam',()=>{
 const geometry=target=>{
  const plan=newRoomPlan();plan.positions.lamp={...fixture,type:'spot',target};
  const rendered=applyRoomPlan({...scene(),lights:[]},plan),faces=[];
  drawStageGeometry(rendered.layout,rendered.lights,[],0,{polygon:(points,fill)=>{if(['#344454','#40566a','#263747','#2a3d50','#60788a'].includes(fill))faces.push(points);}});
  assert.equal(rendered.lights[0].power,0);return faces;
 };
 assert.notDeepEqual(geometry({x:2,y:2}),geometry({x:-2,y:2}),'housing rotates when target crosses sides');
 assert.notDeepEqual(geometry({x:1,y:2}),geometry({x:3,y:2}),'housing tilts when target distance changes');
});

test('new room fixtures follow live show color and intensity, including blackout and restart',()=>{
 const plan=newRoomPlan();plan.positions={head:{...fixture,type:'moving'},spot:{...fixture,type:'spot',x:1},support:{...fixture,type:'stand',x:-1}};
 const source={...scene(),lights:[{...scene().lights[0],id:'show-head',type:'moving',power:.8,color:'#ff0000'},{...scene().lights[0],id:'show-spot',type:'spot',power:.4,color:'#00ff00'}]};
 const before=structuredClone(source),frame=applyRoomPlan(source,plan);
 assert.equal(frame.lights.find(l=>l.id==='head').power,.8);assert.equal(frame.lights.find(l=>l.id==='spot').power,.4);
 assert.equal(frame.lights.find(l=>l.id==='head').color,'#ff0000');assert.equal(frame.lights.find(l=>l.id==='support').power,0);
 assert.deepEqual(source,before,'preview mapping does not modify the show');
 const next=applyRoomPlan({...source,lights:source.lights.map(l=>({...l,color:'#0000ff',power:.6}))},plan);
 assert.equal(next.lights.find(l=>l.id==='spot').color,'#0000ff');
 assert.ok(applyRoomPlan({...source,lights:source.lights.map(l=>({...l,power:0}))},plan).lights.every(l=>l.power===0));
 assert.equal(applyRoomPlan(source,validateRoomPlan(JSON.parse(JSON.stringify(plan)))).lights.find(l=>l.id==='head').power,.8);
 assert.ok(applyRoomPlan({...source,lights:[]},plan).lights.every(l=>l.power===0),'no source remains dark');
});

test('live moving head targets animate around the planned aim while fixed spots stay fixed',async()=>{
 const {projectMovingHeads,stageLayout}=await import('../public/dmx-layout-model.js');
 const plan=newRoomPlan();plan.positions={head:{...fixture,type:'moving',target:{x:0,y:3}},spot:{...fixture,type:'spot',x:1,target:{x:0,y:3}}};
 const before=structuredClone(plan),layout=stageLayout();
 const frame=pan=>{const head={...projectMovingHeads(layout,[{pan,tilt:.8}],[{id:'source',motionRange:1}])[0],type:'moving',power:.7,color:'#ffffff'};return applyRoomPlan({layout,lights:[head,{...head,id:'fixed',type:'spot'}],crowd:[]},plan);};
 const left=frame(-10),right=frame(10),a=left.lights.find(l=>l.id==='head'),b=right.lights.find(l=>l.id==='head');
 assert.ok(a.target.x<0&&b.target.x>0);assert.equal(a.target.y,3);assert.notEqual(a.aimRotation,b.aimRotation);
 assert.deepEqual(a.position,b.position);assert.equal(a.rotation,b.rotation,'mount rotation stays fixed');
 assert.deepEqual(left.lights.find(l=>l.id==='spot').target,right.lights.find(l=>l.id==='spot').target);
 const geometry=scene=>{const faces=[];drawStageGeometry(scene.layout,scene.lights,[],0,{polygon:(points,fill)=>{if(['#344454','#40566a','#263747','#2a3d50','#60788a'].includes(fill))faces.push(points);}});return faces;};
 assert.notDeepEqual(geometry(left),geometry(right),'head geometry moves even with identical color and brightness');
 assert.deepEqual(plan,before);
});

test('room light footprints illuminate only the ground inside a concave boundary',()=>{
 const plan=newRoomPlan(4,4,3);plan.boundary=[[-2,0],[2,0],[2,2],[0,2],[0,4],[-2,4]];plan.positions.lamp={...fixture,type:'spot',x:-1,y:1,height:2,target:{x:0,y:2}};
 const source={...scene(),lights:[{...scene().lights[0],id:'lamp',type:'spot',power:1,color:'#ff6600'}]};
 const footprints=[];const value=applyRoomPlan(source,plan);
 drawStageGeometry(value.layout,value.lights,[],0,{polygon:(points,fill,alpha,stroke,width,emissive)=>{if(emissive&&points.every(p=>Math.abs(p[2]-.012)<1e-8))footprints.push({points,alpha});}});
 assert.ok(footprints.length>=10,'soft layers illuminate the room floor');
 for(const {points,alpha} of footprints){assert.ok(alpha>0&&alpha<1);for(const p of points)assert.ok(insideRoom(p,plan.boundary),'no light in the missing room corner');}
 for(const ar of [false,true]){const result=applyRoomPlan({...source,lights:source.lights.map(l=>({...l,power:ar?1:0}))},plan,ar),ground=[];
 drawStageGeometry(result.layout,result.lights,[],0,{polygon:(points,fill,alpha,stroke,width,emissive)=>{if(emissive&&points.every(p=>Math.abs(p[2]-.012)<1e-8))ground.push(points);}});
 assert.equal(ground.length,0,ar?'AR does not paint over the real floor':'blackout emits no floor light');}
});
