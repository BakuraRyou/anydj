// Deterministic geometry audit. Paths are normalized target coordinates, not
// photographs or a claim about the rendered light or physical motor speed.
import {writeFileSync,mkdirSync} from 'node:fs';
import {GROUP_COMPOSITIONS,groupComposition} from '../public/dmx-group-motion.js';
import {SHOW_FORMS,showScorePose} from '../public/show-score.js';
const output=process.argv[2]||'reports';mkdirSync(output,{recursive:true});
const forms=[...GROUP_COMPOSITIONS.map(name=>({name,kind:'group'})),...SHOW_FORMS.map(name=>({name,kind:'show'}))];
const colors=['#00b8d9','#e6b800','#9955ee','#e05283'];
const metrics=[],panels=[];
for(const [index,form] of forms.entries()){
 const paths=Array.from({length:8},()=>[]);let travel=0,maximumStep=0;
 for(let i=0;i<=240;i++){
  const t=i/240;
  const points=form.kind==='group'?paths.map((_,rank)=>groupComposition({composition:form.name,coordination:['opening-lines','rising-fan'].includes(form.name)?'build':undefined,progress:['opening-lines','rising-fan'].includes(form.name)?t:.4,phase:t*4*Math.PI,energy:.8,drive:.8,amount:1,intent:{symmetry:'paired'}},rank,8,0,3))
   :showScorePose({form:form.name,start:0,end:16,role:'groove',direction:1,energy:.8,scale:.8,movementIntent:{symmetry:'paired',pace:1.2,motionDrive:.8}},t*16).map(p=>({x:p.pan/76+.5,y:(p.tilt-.57)/.49}));
  points.forEach((p,k)=>{if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)throw Error(form.name+' invalid target');const last=paths[k].at(-1);if(last){const d=Math.hypot(p.x-last.x,p.y-last.y);travel+=d/8;maximumStep=Math.max(maximumStep,d);}paths[k].push(p);});
 }
 metrics.push({...form,meanNormalizedTravel:travel,maximumNormalizedStep:maximumStep});
 const x=index%3*340,y=Math.floor(index/3)*240;
 panels.push(`<g transform="translate(${x},${y})"><text x="15" y="23">${form.kind}: ${form.name}</text><rect x="15" y="35" width="300" height="180" fill="none" stroke="#ccc"/>${paths.map((path,k)=>`<polyline fill="none" stroke="${colors[k%4]}" opacity=".7" points="${path.map(p=>`${(15+p.x*300).toFixed(2)},${(35+p.y*180).toFixed(2)}`).join(' ')}"/>`).join('')}</g>`);
}
writeFileSync(output+'/motion-catalog.json',JSON.stringify(metrics,null,2)+'\n');
writeFileSync(output+'/motion-catalog.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="${Math.ceil(forms.length/3)*240}" style="background:white;font:14px sans-serif">${panels.join('')}</svg>`);
console.log(JSON.stringify(metrics,null,2));
