import test from 'node:test';
import assert from 'node:assert/strict';
import {clubStageRoom,clubStageRoomWithoutQuietZones,largeClubRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan} from '../public/dmx-ar-model.js';
import {strobeScoreAt} from '../public/dmx-strobe-score.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';
import {strobeAreaTarget} from '../public/dmx-strobe-space.js';

const span=values=>Math.max(...values)-Math.min(...values);
function source(plan,time){
 const figure={...strobeScoreAt(plan,time),flicker:53};
 return {layout:{width:8,depth:6,positions:{}},lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},
  target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'strobe',power:1,color:'#ff0',movingShutter:1,
  movingPresenceBasePower:1,movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure}}]};
}
test('club formations keep moving inside their saved areas instead of pinning to an edge',()=>{
 const music=varietySong();
 for(const makeRoom of [clubStageRoom,clubStageRoomWithoutQuietZones,largeClubRoom]){
  const room=makeRoom(),saved=JSON.stringify(room),traces=new Map();let edge=0,total=0;
  for(let time=1;time<32;time+=.25){
   const mapped=applyRoomPlan(source(music,time),room);
   for(const light of mapped.lights.filter(l=>l.type==='moving')){
    const area=room.positions[light.id].motionArea;
    const left=(area.x-.5)*room.width,right=left+area.width*room.width,bottom=area.y*room.depth,top=bottom+area.depth*room.depth;
    assert.ok(light.target.x>=left-1e-8&&light.target.x<=right+1e-8&&light.target.y>=bottom-1e-8&&light.target.y<=top+1e-8);
    total++;if(Math.min(Math.abs(light.target.x-left),Math.abs(light.target.x-right),Math.abs(light.target.y-bottom),Math.abs(light.target.y-top))<1e-6)edge++;
    const trace=traces.get(light.id)??{x:[],y:[]};trace.x.push(light.target.x);trace.y.push(light.target.y);traces.set(light.id,trace);
   }
  }
  assert.ok(edge/total<.05,`${room.name}: ${(edge/total*100).toFixed(1)}% of targets are pinned to a boundary`);
  assert.ok([...traces.values()].filter(t=>span(t.y)>3).length>traces.size*.8,'depth movement must survive room fitting');
  assert.equal(JSON.stringify(room),saved,'saved fixture placement, areas, walls and quiet zones remain intact');
 }
});
test('older room positions without an explicit type still fit as one bounded formation',()=>{
 const area={x:.4,y:.2,width:.4,depth:.4},positions=Object.fromEntries([-4,0,4].map((x,i)=>['h'+i,{x,y:6,height:3,motionArea:area}]));
 const layout={width:10,depth:8,positions};
 const targets=Object.values(positions).map(position=>strobeAreaTarget({position,motionUV:{x:.5,y:.5,beamFocus:0}},layout,area));
 for(const target of targets)assert.ok(target.x>=-1&&target.x<=3&&target.y>=1.6&&target.y<=4.8);
 assert.ok(span(targets.map(t=>t.x))>2,'the cohort retains its relative layout instead of becoming one shared spot');
});
