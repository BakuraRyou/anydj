import {writeFile,mkdir} from 'node:fs/promises';
import {FORMATION_CATALOG} from '../public/dmx-formation-catalog.js';
import {formationSpatialPose} from '../public/dmx-strobe-choreography.js';
const width=1600,cellWidth=160,cellHeight=126,rows=Math.ceil(FORMATION_CATALOG.length/10),height=rows*cellHeight+70;
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#071019"/><g font-family="sans-serif" fill="#e8f5ff"><text x="16" y="25" font-size="19">300 neue räumliche Grundformationen · je 6 Unterformen</text><text x="16" y="49" font-size="12">20 Konturen × 15 Strukturen · drei Montageebenen · Standbild bei 50 % · Linien zeigen Strahlrichtungen</text>`;
for(const [i,f]of FORMATION_CATALOG.entries()){
 const ox=i%10*cellWidth,oy=70+Math.floor(i/10)*cellHeight;
 svg+=`<g transform="translate(${ox},${oy})"><rect x="3" y="3" width="154" height="120" rx="5" fill="#0b1b29"/><title>${esc(f.name+' · '+f.id)}</title>`;
 for(let row=0;row<3;row++)for(let rank=0;rank<12;rank++){
  const p=formationSpatialPose(f.id,rank,12,row,3,.5),x=10+p.x*140,y=80-p.y*65,sx=12+rank/11*136,sy=83+row*2,color=['#ff9b63','#54d5ef','#c3a2ff'][row];
  svg+=`<path d="M${sx.toFixed(2)} ${sy}L${x.toFixed(2)} ${y.toFixed(2)}" stroke="${color}" opacity=".32" stroke-width=".55"/><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.1" fill="${color}"/>`;
 }
 const [structure,contour]=f.name.split(' · ');
 svg+=`<text x="9" y="102" font-size="10">${i+1}. ${esc(structure)}</text><text x="9" y="116" fill="#96aec2" font-size="9">${esc(contour)}</text></g>`;
}
svg+='</g></svg>';
await mkdir('reports/dmx-test-quality',{recursive:true});
await writeFile('reports/dmx-test-quality/formation-catalog-300.svg',svg);
console.log('Created reports/dmx-test-quality/formation-catalog-300.svg');
