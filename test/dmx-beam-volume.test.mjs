import test from 'node:test';
import assert from 'node:assert/strict';
import {beamVolume,sampleBeamVolume,volumeCorners} from '../public/dmx-beam-volume.js';
const layout={width:8,depth:6,height:3,room:true};
const source={id:'head',type:'moving',power:1,position:{x:0,y:4,height:1.5},target:{x:1,y:2,z:3},targetSurface:'ceiling'};
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
// Independent reference: uniform integration without analytic cone intersections.
function reference(v,eye,direction){
 const d=v.data,step=20/32768;let sum=0;
 for(let j=0;j<32768;j++){
  const t=.08+(j+.5)*step,p=eye.map((x,k)=>x+direction[k]*t);
  if(p.some((x,k)=>x<d[12+k]||x>d[16+k])||p.reduce((n,x,k)=>n+x*d[8+k],d[11])<0)continue;
  const r=p.map((x,k)=>x-d[k]),z=r.reduce((n,x,k)=>n+x*d[4+k],0);
  if(z<=0||z>d[7])continue;
  const r2=r.reduce((n,x,k)=>n+(x-d[4+k]*z)**2,0)/(d[3]*z)**2;
  sum+=Math.max(0,Math.exp(-4*r2)-Math.exp(-4))/(.12+z*z*.035)*step;
 }
 const along=direction.reduce((n,x,k)=>n+x*d[4+k],0);
 return 1-Math.exp(-sum*.24*(.65+.35*Math.max(0,-along)**2));
}
test('bounded volume integration agrees with independent dense sampling from several views',()=>{
 const v=beamVolume(source,layout);
 for(const eye of [[0,-2,1.6],[3,2,2],[.4,3.2,2.1],[1,2,2.9]])for(const fraction of [.2,.6,.98]){
  const p=v.origin.map((n,k)=>n+v.axis[k]*2*fraction),direction=unit(p.map((n,k)=>n-eye[k]));
  const expected=reference(v,eye,direction),actual=sampleBeamVolume(v.data,eye,direction);
  assert.ok(Math.abs(actual-expected)<.018,`${eye}: ${actual} versus ${expected}`);
 }
});
test('volume has no haze beyond the ceiling, wall or outside the cone',()=>{
 const v=beamVolume(source,layout);
 assert.equal(sampleBeamVolume(v.data,[0,2,3.2],[0,0,1]),0);
 assert.equal(sampleBeamVolume(v.data,[3,2,2],[1,0,0]),0);
 const wall=beamVolume({...source,target:{x:4,y:3,z:2},targetSurface:'wall',wallIndex:1},layout);
 assert.equal(sampleBeamVolume(wall.data,[4.1,3,2],[1,0,0]),0);
 assert.ok(volumeCorners(v).flat().every(Number.isFinite));
});
test('zero-length beams are omitted and looking along the axis stays finite',()=>{
 assert.equal(beamVolume({...source,target:{x:0,y:4,z:1.5}},layout),null);
 const v=beamVolume(source,layout);
 for(const direction of [v.axis,v.axis.map(x=>-x)])assert.ok(Number.isFinite(sampleBeamVolume(v.data,v.origin,direction)));
});
