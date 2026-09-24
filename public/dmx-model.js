import {fixtureProfile} from './dmx-fixture-library.js';
// Generic simulation profiles, not manufacturer-specific channel maps.
// Addresses are one-based; the universe buffer is zero-based.
export const STAGE_PATCH = Object.freeze([
  ...Array.from({length:4},(_,i)=>Object.freeze({name:`Scheinwerfer ${i+1}`,address:1+i*4,profile:'dimmer-rgb',cells:1,channels:4})),
  Object.freeze({name:'Lichtleiste',address:17,profile:'rgb-pixels',cells:8,channels:24}),
]);
export function stageEquipment(value){
  if(Array.isArray(value?.devices)){
    const ids=new Set();let channels=0;
    const devices=value.devices.map((d,i)=>{
      if(!d||!['spot','bar','moving'].includes(d.type))throw Error('Ungültiger Gerätetyp.');
      const cells=d.type==='bar'?d.cells:1;
      if(!Number.isInteger(cells)||cells<1||cells>170)throw Error('Eine Lichtleiste benötigt 1–170 Segmente.');
      const profile=fixtureProfile(d.modelId);if(d.modelId&&(!profile||d.type!==profile.type))throw Error('Unbekanntes oder unpassendes Geräteprofil.');
      channels+=profile?profile.map.length:d.type==='moving'?0:d.type==='spot'?4:cells*3;
      if(channels>512)throw Error('Diese Bühne überschreitet 512 DMX-Kanäle. Bitte Geräte oder Segmente reduzieren.');
      const id=typeof d.id==='string'&&d.id.length<100?d.id:`device-${i}`;
      if(ids.has(id))throw Error('Doppelte Gerätekennung.');ids.add(id);
      return {id,type:d.type,cells,...(profile?{modelId:profile.id}:{}),...(typeof d.name==='string'?{name:d.name.slice(0,60)}:{}),...([0,1,2].includes(d.group)?{group:d.group}:{}),...(Number.isFinite(d.gain)?{gain:Math.max(0,Math.min(100,d.gain))}:{}),...(Number.isFinite(d.motionRange)?{motionRange:Math.max(0,Math.min(1,d.motionRange))}:{})};
    });
    if(devices.length>256)throw Error('Maximal 256 Geräte pro Aufbau.');
    return {devices,...(value.unified?{unified:true}:{})};
  }
  const valid=(n,max,fallback)=>Number.isInteger(n)&&n>=1&&n<=max?n:fallback;
  return {devices:value?.type==='bar'?[{id:'legacy-bar',type:'bar',cells:valid(value.segments,8,8)}]:Array.from({length:valid(value?.spots,4,4)},(_,i)=>({id:`legacy-spot-${i}`,type:'spot',cells:1}))};
}
export function stagePatch(equipment){
  if(!equipment)return STAGE_PATCH;
  if(!equipment.devices)return stagePatch(stageEquipment(equipment));
  let address=1,spot=0,bar=0,moving=0;
  return equipment.devices.map(d=>{
    const model=fixtureProfile(d.modelId),channels=model?model.map.length:d.type==='moving'?0:d.type==='spot'?4:d.cells*3;
    const defaultName=d.type==='moving'?`Moving Head ${++moving}`:d.type==='spot'?`Scheinwerfer ${++spot}`:`Lichtleiste ${++bar}`;
    const fixture={...d,name:d.name||(model?`${model.manufacturer} ${model.model}`:defaultName),address,channels,cells:d.cells,...(model?{channelMap:model.map,mode:model.mode}:{}),profile:model?'manufacturer':d.type==='moving'?'moving-preview':d.type==='spot'?'dimmer-rgb':'rgb-pixels'};
    address+=channels;return fixture;
  });
}
export function activeStageCell(equipment,index,cell=0){
  return !!stagePatch(equipment)[index]&&cell<stagePatch(equipment)[index].cells;
}
const byte = value => Math.round(Math.max(0,Math.min(255,Number.isFinite(value)?value:0)));
export function encodeStage(frame,equipment) {
  const universe=new Uint8Array(512);
  const patch=stagePatch(equipment);
  const devices=Array.isArray(frame)?frame:patch.map(f=>Array.from({length:f.cells},()=>frame));
  for(const [index,fixture] of patch.entries())for(let cell=0;cell<fixture.cells;cell++){
    if(!fixture.channels)continue;
    const value=devices[index]?.[cell];if(!value||value.state===false)continue;
    const dimmer=byte((value.dimming??0)*255/100),rgb=['r','g','b'].map(key=>byte(value[key]));
    const offset=fixture.address-1;
    if(fixture.channelMap){const master=fixture.channelMap.includes('dimmer');universe.set(fixture.channelMap.map(key=>typeof key==='number'?key:key==='dimmer'?dimmer:byte(value[key]*(master?1:dimmer/255))),offset);}
    else if(fixture.profile==='dimmer-rgb')universe.set([dimmer,...rgb],offset);
    else universe.set(rgb.map(v=>byte(v*dimmer/255)),offset+cell*3);
  }
  return universe;
}
export function decodeStage(universe,equipment) {
  if(!(universe instanceof Uint8Array)||universe.length!==512)throw Error('Ein DMX-Universum muss 512 Kanalwerte enthalten.');
  return stagePatch(equipment).map(fixture=>{
    const offset=fixture.address-1;
    const cells=Array.from({length:fixture.cells},(_,i)=>!fixture.channels?[0,0,0]:fixture.channelMap?['r','g','b'].map(key=>byte(universe[offset+fixture.channelMap.indexOf(key)]*(fixture.channelMap.includes('dimmer')?universe[offset+fixture.channelMap.indexOf('dimmer')]/255:1))):fixture.profile==='dimmer-rgb'
      ? Array.from(universe.slice(offset+1,offset+4),v=>byte(v*universe[offset]/255))
      : Array.from(universe.slice(offset+i*3,offset+i*3+3)));
    return {...fixture,cells};
  });
}

export const fixtureKey=d=>d.type==='moving'?d.id:`fixture-${d.id}`;
