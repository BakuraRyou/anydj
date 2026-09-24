import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurfaceLighting} from '../public/dmx-surface-light.js';
const face=x=>[[x,0,1],[x,2,1],[x,2,3],[x,0,3]];
const light={power:1,color:'#ff0000',type:'spot',position:{x:0,y:0,height:3},target:{x:0,y:1}};
const red=c=>parseInt(c.slice(1,3),16);
test('fixture bounce illuminates surfaces in a dark room and decays with distance',()=>{
 const shade=createSurfaceLighting([light],0),near=shade(face(1),'#666666'),far=shade(face(10),'#666666');
 assert.ok(red(near)>red(far));assert.ok(red(far)>0);assert.equal(near.slice(3),'0000');
 assert.equal(createSurfaceLighting([{...light,power:0}],0)(face(1),'#666666'),'#000000');
});
test('material reflectance, mixed colors and master power affect bounce independently from ambient',()=>{
 const shade=createSurfaceLighting([light,{...light,color:'#0000ff'}],0);
 assert.ok(red(shade(face(1),'#888888'))>red(shade(face(1),'#222222')));
 assert.ok(parseInt(shade(face(1),'#888888').slice(5),16)>0);
 assert.ok(red(createSurfaceLighting([{...light,power:.2}],0)(face(1),'#888888'))<red(createSurfaceLighting([light],0)(face(1),'#888888')));
 assert.equal(createSurfaceLighting([],100)(face(1),'#445566'),'#445566');
});

test('shared scene illuminates walls and ceiling from fixtures without adding light in blackout',async()=>{
 const {drawStageGeometry}=await import('../public/dmx-stage-3d-renderer.js');
 const layout={width:8,depth:6,height:3,room:true,environmentBrightness:0};
 const capture=power=>{const faces=[];drawStageGeometry(layout,[{...light,power}],[],0,{eye:[0,2,1.7],polygon:(points,fill,alpha,stroke,width,emissive)=>{if(fill&&!emissive)faces.push({points,fill});}});return faces;};
 const lit=capture(1);assert.ok(lit.some(f=>f.points.every(p=>p[2]===3)&&red(f.fill)>0),'ceiling reflects the show');
 assert.ok(lit.some(f=>f.points.every(p=>p[0]===4)&&red(f.fill)>0),'walls reflect the show');
 assert.ok(capture(0).every(f=>f.fill==='#000000'),'no artificial room glow with lights off');
});

test('coplanar floor triangles and wall sections share illumination regardless of tessellation or winding',()=>{
 const shade=createSurfaceLighting([light,{...light,color:'#ff00ff',target:{x:3,y:5}}],0,[0,3,1.5]);
 const floorA=[[-4,0,0],[4,0,0],[4,6,0]],floorB=[[-4,0,0],[4,6,0],[-4,6,0]];
 assert.equal(shade(floorA,'#504035'),shade(floorB,'#504035'));
 assert.equal(shade(floorA,'#504035'),shade([...floorB].reverse(),'#504035'));
 const left=[[-4,6,0],[0,6,0],[0,6,3],[-4,6,3]],right=[[0,6,0],[4,6,0],[4,6,3],[0,6,3]];
 assert.equal(shade(left,'#66615b'),shade(right,'#66615b'));
});
