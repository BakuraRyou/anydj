// Geometric atlas, not a renderer screenshot. node scripts/review-automatic-catalog.mjs
import {mkdirSync,writeFileSync} from 'node:fs';
import {AUTOMATIC_FORMATIONS,AUTO_FORMATIONS,GROUP_MOTIONS,GROUP_COMPOSITIONS} from '../public/song-movement-plan.js';
import {groupComposition} from '../public/dmx-group-motion.js';
const dir=new URL('../reports/automatic-150/',import.meta.url);mkdirSync(dir,{recursive:true});
const columns=10,w=185,h=170,rows=Math.ceil(AUTOMATIC_FORMATIONS.length/columns);
const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w*columns}" height="${rows*h+85}" viewBox="0 0 ${w*columns} ${rows*h+85}"><rect width="100%" height="100%" fill="#111a25"/><g font-family="sans-serif" fill="#e4edf8"><text x="20" y="30" font-size="22">Automatisch · 150 Formationen</text><text x="20" y="55" font-size="13">Zielbahnen in Draufsicht · 8 Geräte pro Reihe · 3 Reihen · sechs Bewegungsphasen · keine Lichtsimulation</text>`];
const metadata=[];
for(const [i,name] of AUTOMATIC_FORMATIONS.entries()){
 const extra=AUTO_FORMATIONS.find(f=>f.name===name),composition=extra?name:GROUP_COMPOSITIONS[GROUP_MOTIONS.indexOf(name)];
 const x=i%columns*w,y=85+Math.floor(i/columns)*h;
 out.push(`<g transform="translate(${x},${y})"><rect x="3" y="3" width="179" height="164" rx="5" fill="#1b2838"/><text x="9" y="18" font-size="9">${i+1}. ${name.replace('auto-','')}</text>`);
 for(let row=0;row<3;row++)for(let rank=0;rank<8;rank++){
  const points=[];
  for(let step=0;step<6;step++){
   const p=groupComposition({composition,progress:.5,phase:step*.8,energy:.65,drive:.55,amount:1,intent:{symmetry:'paired',surface:'floor'}},rank,8,row,3);
   points.push([14+p.x*157,32+p.y*122]);
  }
  const color=['#57d8ce','#f4bf65','#b89afa'][row];
  out.push(`<polyline points="${points.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="1"/><circle cx="${points[0][0]}" cy="${points[0][1]}" r="2" fill="${color}"/>`);
 }
 out.push('</g>');metadata.push({name,composition,...(extra?{family:extra.family,layout:extra.layout,gentle:extra.gentle,build:extra.build,affinity:extra.affinity}:{legacy:true})});
}
out.push('</g></svg>');writeFileSync(new URL('catalog.svg',dir),out.join(''));writeFileSync(new URL('catalog.json',dir),JSON.stringify(metadata,null,2));
console.log(`${metadata.length} formations exported`);
