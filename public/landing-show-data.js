// Public, versioned playback format shared by the player and publishing tools.
const fail=message=>{throw new Error(message);};
const num=(n,min,max,label)=>Number.isFinite(n)&&n>=min&&n<=max?n:fail(`${label}: ungültiger Wert`);
const label=(s,name)=>typeof s==='string'&&s.trim()&&s.length<=120?s:fail(`${name}: Text fehlt oder ist zu lang`);
export function assetPath(value){
  if(typeof value!=='string'||!/^\.\/demo-shows\/[a-zA-Z0-9_./-]+$/.test(value)||value.split('/').some(p=>p==='..'||p===''))fail('Datei muss unter ./demo-shows/ liegen');
  return value;
}
export function validateCatalog(value){
  if(value?.version!==1||!Array.isArray(value.shows)||value.shows.length!==3)fail('Der Katalog braucht Version 1 und genau drei Shows');
  const ids=new Set();
  return {version:1,shows:value.shows.map(s=>{
    if(typeof s?.id!=='string'||!/^[a-z0-9-]{1,40}$/.test(s.id)||ids.has(s.id))fail('Show-ID fehlt oder ist doppelt');ids.add(s.id);
    const show=assetPath(s.show);if(!show.endsWith('.json'))fail('Show muss JSON sein');
    return {id:s.id,title:label(s.title,'Titel'),artist:label(s.artist,'Interpret'),description:label(s.description,'Beschreibung'),show};
  })};
}
export function validateShow(value){
  if(value?.version!==1)fail('Unbekannte Show-Version');
  const duration=num(value.duration,1,300,'Dauer'),audio=assetPath(value.audio);
  if(!/\.(wav|mp3|ogg|m4a)$/.test(audio))fail('Unbekanntes Audioformat');
  const l=value.layout||{},width=num(l.width,4,20,'Breite'),depth=num(l.depth,4,20,'Tiefe'),height=num(l.height,2,8,'Höhe');
  const point=p=>({x:num(p?.x,-width/2,width/2,'X'),y:num(p?.y,0,depth,'Y'),height:num(p?.height,.1,height,'Gerätehöhe')});
  if(!Array.isArray(value.fixtures)||value.fixtures.length!==8)fail('Genau acht Geräte erforderlich');
  const ids=new Set(),fixtures=value.fixtures.map(f=>{
    if(typeof f?.id!=='string'||!/^[a-z0-9-]{1,40}$/.test(f.id)||ids.has(f.id))fail('Geräte-ID fehlt oder ist doppelt');ids.add(f.id);
    if(!['moving','par'].includes(f.type))fail('Unbekannter Gerätetyp');
    return {id:f.id,type:f.type,position:point(f.position),beamAngle:num(f.beamAngle,3,60,'Lichtkegel')};
  });
  if(fixtures.filter(f=>f.type==='moving').length!==4)fail('Vier Moving Heads und vier Scheinwerfer erforderlich');
  if(!Array.isArray(value.frames)||value.frames.length<2||value.frames.length>18001)fail('Ungültige Anzahl Zeitpunkte');
  let previous=-1;
  const frames=value.frames.map(frame=>{
    const time=num(frame?.time,0,duration,'Zeit');if(time<=previous)fail('Zeitpunkte müssen aufsteigend sein');previous=time;
    if(!Array.isArray(frame.lights)||frame.lights.length!==8)fail('Jeder Zeitpunkt braucht acht Lichtzustände');
    const lights=frame.lights.map(v=>{
      if(!Array.isArray(v)||v.length!==6)fail('Lichtzustand: [r,g,b,Helligkeit,Ziel-X,Ziel-Y] erwartet');
      return [num(v[0],0,255,'Rot'),num(v[1],0,255,'Grün'),num(v[2],0,255,'Blau'),num(v[3],0,1,'Helligkeit'),num(v[4],-width/2,width/2,'Ziel-X'),num(v[5],0,depth,'Ziel-Y')];
    });return {time,lights};
  });
  if(frames[0].time!==0||frames.at(-1).time!==duration)fail('Zeitverlauf muss bei 0 beginnen und bei der Dauer enden');
  return {version:1,duration,audio,fixtures,frames,layout:{width,depth,height,room:true,environmentBrightness:30,hazeDetail:false,positions:Object.fromEntries(fixtures.map(f=>[f.id,f.position]))}};
}
export function sampleShow(show,time){
  const frames=show.frames,t=Math.max(0,Math.min(show.duration,time));let lo=0,hi=frames.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(frames[mid].time<=t)lo=mid;else hi=mid;}
  const a=frames[lo],b=frames[hi],mix=(t-a.time)/(b.time-a.time);
  return show.fixtures.map((fixture,i)=>{
    const v=a.lights[i].map((n,j)=>n+(b.lights[i][j]-n)*mix),target={x:v[4],y:v[5]},p=fixture.position;
    return {...fixture,target,power:v[3],color:'#'+v.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join(''),aimed:true,aimRotation:Math.atan2(target.x-p.x,p.y-target.y)*180/Math.PI};
  });
}
export async function fetchShowJSON(url,limit=4*1024*1024,{signal}={}){
  const response=await fetch(url,{signal});if(!response.ok)throw Error('Die Show konnte nicht geladen werden.');
  if(Number(response.headers.get('content-length'))>limit)throw Error('Show-Datei ist zu groß.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Show-Datei ist zu groß.');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(data));
}
