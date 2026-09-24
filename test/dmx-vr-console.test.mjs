import test from 'node:test';
import assert from 'node:assert/strict';
import {panelHit,moveVROrigin,createVRConsole} from '../public/dmx-vr-console.js';
const matrix=(x=0,y=1.7,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
test('ray hits use panel coordinates, rejecting backwards and outside rays',()=>{
 const panel={center:[0,1.7,-1],normal:[0,0,1],right:[1,0,0],up:[0,1,0],width:1,height:1};
 assert.deepEqual(panelHit(panel,matrix()).point,[0,1.7,-1]);assert.equal(panelHit(panel,matrix()).u,.5);
 assert.equal(panelHit(panel,matrix(2)),null);assert.equal(panelHit(panel,matrix(0,1.7,-2)),null);
});
test('walk follows headset yaw, deadzone prevents drift and snap preserves tracked head position',()=>{
 const origin={x:0,y:3,yaw:0},layout={width:8,depth:12},head=matrix(.5,1.7,.2);
 moveVROrigin(origin,head,layout,[.1,.1],0,.05);assert.deepEqual(origin,{x:0,y:3,yaw:0});
 moveVROrigin(origin,head,layout,[0,-1],0,.05);assert.ok(origin.y>3);const world=[origin.x+.5,origin.y-.2];
 moveVROrigin(origin,head,layout,[0,0],Math.PI/2,.05);assert.ok(Math.abs(origin.x+.2-world[0])<1e-10);assert.ok(Math.abs(origin.y+.5-world[1])<1e-10);
 for(let i=0;i<1000;i++)moveVROrigin(origin,matrix(),layout,[1,-1],0,.05);assert.ok(origin.x>=-3.8&&origin.x<=3.8);assert.ok(origin.y>=.2&&origin.y<=11.8);
});
test('fallback console selects deck, controls playback, and exits even when disconnected',async()=>{
 const commands=[];let exited=0;const ui=createVRConsole({command:c=>commands.push(c),exit:()=>exited++});
 const source={handedness:'right',targetRaySpace:{}},session={inputSources:[source]},scene={transport:{decks:[{id:'A',canPlay:true,canSeek:true,position:30,duration:100},{id:'B',canPlay:true}]},layout:{width:8,depth:12}};
 let ray=matrix();const frame={getPose:()=>({transform:{matrix:ray}})},origin={x:0,y:1,yaw:0};
 const overlay=ui.update(frame,{}, {transform:{matrix:matrix()}},session,scene,origin,1),p=overlay.panel;
 async function click(u,v){const point=p.center.map((n,i)=>n+(u-.5)*p.width*p.right[i]+(.5-v)*p.height*p.up[i]);ray=matrix(...point.map((n,i)=>n+p.normal[i]*.4));for(let i=0;i<3;i++)ray[8+i]=p.normal[i];await ui.select({inputSource:source,frame},{});}
 await click(.2,.60);assert.deepEqual(commands.pop(),{action:'playing',deck:'A',value:true});
 await click(.8,.60);assert.deepEqual(commands.pop(),{action:'seek',deck:'A',value:40});
 await click(.7,.25);assert.deepEqual(commands.pop(),{action:'select',deck:'B'});
 scene.controlsAvailable=false;await click(.2,.60);assert.equal(commands.length,0);await click(.8,.87);assert.equal(exited,1);
});

test('controller panel is half its original width and height, fallback remains readable',()=>{
 const ui=createVRConsole({command:()=>{},exit:()=>{}}),left={handedness:'left',gripSpace:{}},frame={getPose:()=>({transform:{matrix:matrix(-.25,1.2,-.4)}})},scene={layout:{width:8,depth:12}};
 const attached=ui.update(frame,{}, {transform:{matrix:matrix()}},{inputSources:[left]},scene,{x:0,y:1,yaw:0},1).panel;
 assert.equal(attached.width,.58/2);assert.equal(attached.height,.38/2);
 const fallback=ui.update(frame,{}, {transform:{matrix:matrix()}},{inputSources:[]},scene,{x:0,y:1,yaw:0},2).panel;assert.ok(fallback.width>attached.width);
});
