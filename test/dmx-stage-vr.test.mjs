import test from 'node:test';
import assert from 'node:assert/strict';
import {createStageVR,worldToXR} from '../public/dmx-stage-vr.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(options={}){
 const button={setAttribute(k,v){this[k]=v;}},status={},events=[];
 class Session extends EventTarget{
  visibilityState='visible';async requestReferenceSpace(type){return {type};}
  updateRenderState(value){this.state=value;}requestAnimationFrame(fn){this.frame=fn;}
  async end(){this.dispatchEvent(new Event('end'));}
 }
 const session=new Session(),xr=new EventTarget();xr.isSessionSupported=async()=>true;xr.requestSession=async mode=>{assert.equal(mode,'immersive-vr');return session;};
 const graphics={layer:{},destroy(){events.push('destroy');},render(pose,scene,origin){events.push({pose,scene,origin});}};
 const controller=createStageVR({button,status,xr,secure:true,getOrigin:()=>({x:2,y:4,yaw:0,eyeHeight:1.7}),getScene:()=>({lights:['live']}),onActive:v=>events.push(v),createGraphics:async()=>graphics,...options});
 return {controller,button,status,session,xr,events};
}
test('world coordinates preserve meter scale, floor height and starting direction',()=>{
 assert.deepEqual(worldToXR([2,5,1.7],{x:2,y:4,yaw:0}),[0,1.7,-1]);
 const p=worldToXR([1,4,1.7],{x:2,y:4,yaw:Math.PI/2,floorOffset:1.7});assert.ok(Math.abs(p[0])<1e-10);assert.equal(p[1],0);assert.equal(p[2],-1);
});
test('shared geometry emits finite world polygons, beams, zones and guests',()=>{
 let polygons=0,glow=0;
 drawStageGeometry({width:8,depth:12,height:5,room:true,lightMin:0,zones:[{x:.1,y:.1,width:.1,depth:.1}]},[{position:{x:0,y:8,height:4},target:{x:0,y:4},power:1,type:'moving',color:'rgb(255,0,0)'}],[{x:.5,y:.5}],0,{polygon(points,fill,alpha){polygons++;if(alpha<1)glow++;assert.ok(points.flat().every(Number.isFinite));}});
 assert.ok(polygons>40);assert.ok(glow>10);
});
test('session renders both supplied eye poses with live scene and cleans up on end',async()=>{
 const s=setup();await tick();assert.equal(s.button.disabled,false);s.button.onclick();await tick();
 assert.equal(s.controller.active,true);assert.ok(s.session.state.baseLayer);
 const pose={views:[{eye:'left'},{eye:'right'}]};s.session.frame(1000,{getViewerPose:()=>pose});
 const rendered=s.events.find(v=>v?.pose);assert.equal(rendered.pose.views.length,2);assert.deepEqual(rendered.scene,{lights:['live']});assert.equal(rendered.origin.floorOffset,0);
 await s.controller.stop();assert.equal(s.controller.active,false);assert.ok(s.events.includes('destroy'));assert.ok(s.events.includes(false));s.controller.destroy();
});
test('insecure and unsupported browsers do not enable VR',async()=>{
 for(const options of [{secure:false},{xr:null}]){const s=setup(options);await tick();assert.equal(s.button.disabled,true);await s.controller.stop();assert.equal(s.button.disabled,true);s.controller.destroy();}
});
test('permission rejection permits retry, local reference fallback uses eye height',async()=>{
 const s=setup();await tick();s.xr.requestSession=async()=>{throw new DOMException('Denied','NotAllowedError');};s.button.onclick();await tick();assert.match(s.status.textContent,/nicht freigegeben/);assert.equal(s.button.disabled,false);
 s.xr.requestSession=async()=>s.session;s.session.requestReferenceSpace=async type=>{if(type==='local-floor')throw Error('unsupported');return {type};};s.button.onclick();await tick();
 s.session.frame(10,{getViewerPose:()=>({views:[]})});assert.equal(s.events.find(v=>v?.origin).origin.floorOffset,1.7);s.controller.destroy();
});
test('ending during async graphics initialization disposes late resources',async()=>{
 let ready,disposed=0;const s=setup({createGraphics:()=>new Promise(resolve=>ready=resolve)});await tick();s.button.onclick();await tick();await s.controller.stop();ready({destroy(){disposed++;}});await tick();assert.equal(s.controller.active,false);assert.equal(disposed,1);s.controller.destroy();
});
