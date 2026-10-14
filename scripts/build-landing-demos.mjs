// Deterministic original demo audio and baked light timelines. No runtime analysis.
import {mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../web/demo-shows/',import.meta.url);await mkdir(root,{recursive:true});
const presets=[['neon','Neon Pulse',120,[70,240,195],[160,80,255],'Weite Bewegungen. Klare Beats.'],['sunset','Golden Hour',100,[255,165,65],[255,70,130],'Warme Farben. Ruhiger Groove.'],['electric','Electric Blue',132,[65,155,255],[215,100,255],'Kühle Strahlen. Dynamische Fächer.']];
const catalog={version:1,shows:[]};
for(const [variant,[id,title,bpm,c1,c2,description]] of presets.entries()){
  const duration=32*60/bpm,rate=22050,length=Math.ceil(duration*rate),buffer=Buffer.alloc(44+length*2);
  buffer.write('RIFF');buffer.writeUInt32LE(36+length*2,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
  let seed=42+variant;
  for(let i=0;i<length;i++){
    const t=i/rate,beat=t*bpm/60,phase=(beat%1)*60/bpm,step=Math.floor(beat),active=beat>=8&&beat<24;
    seed=(1664525*seed+1013904223)>>>0;const noise=seed/4294967296*2-1;
    const kick=Math.sin(2*Math.PI*(48*phase+7*(1-Math.exp(-phase*32))))*Math.exp(-phase*22);
    const bass=[55,65.406,73.416,49][Math.floor(beat/8)%4]*[1,.75,1.5][variant];
    const tone=Math.sin(2*Math.PI*bass*t)*Math.exp(-phase*6)*.22;
    const lead=Math.sin(2*Math.PI*bass*[4,5,6,8][step%4]*t)*Math.exp(-phase*12)*.1;
    const drums=(step%2?noise*Math.exp(-phase*35)*.2:0)+noise*Math.exp(-((beat*2)%1)*22)*.055;
    const sample=Math.min(1,t/1.5,(duration-t)/2)*((active?.45:.2)*kick+tone+(active?drums+lead:lead*.25));
    buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),44+i*2);
  }
  await writeFile(new URL(`${id}.wav`,root),buffer);
  const fixtures=Array.from({length:8},(_,i)=>({id:`${i<4?'head':'par'}-${i%4+1}`,type:i<4?'moving':'par',beamAngle:i<4?9:42,position:{x:(i%4-1.5)*2,y:i<4?6.5:5.8,height:i<4?3.2:2.8}}));
  const frames=[],count=Math.ceil(duration*20);
  for(let n=0;n<=count;n++){
    const time=n===count?duration:n/20,beat=time*bpm/60,energy=beat>=8&&beat<24?1:.5,fade=Math.min(1,time/.6,(duration-time)/1.2);
    frames.push({time,lights:fixtures.map((f,i)=>{
      const blend=(Math.sin(beat*Math.PI/8+i*.45)+1)/2,color=c1.map((v,j)=>Math.round(v+(c2[j]-v)*blend));
      const power=fade*(i<4?.5+.35*energy:.25+.4*Math.exp(-(beat%1)*5));
      const x=i<4?(variant===2?(i-1.5)*(1+.55*Math.sin(beat*Math.PI/4)):Math.sin(beat*Math.PI/(variant===1?8:4)+i*.7)*3):f.position.x;
      const y=i<4?2.7+1.5*Math.cos(beat*Math.PI/8+i*.8):2;
      return [...color,...[power,x,y].map(v=>Math.round(v*1000)/1000)];
    })});
  }
  await writeFile(new URL(`${id}.json`,root),JSON.stringify({version:1,duration,audio:`./demo-shows/${id}.wav`,layout:{width:10,depth:8,height:4},fixtures,frames})+'\n');
  catalog.shows.push({id,title,artist:`AnyDj · ${bpm} BPM`,description,show:`./demo-shows/${id}.json`});
}
await writeFile(new URL('catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log('Drei synthetische Demo-Tracks und vorberechnete Shows erstellt.');
