import {strobeMusicExposure} from './dmx-strobe-conductor.js';
// Legacy demo sentences. Prepared songs use measured conductor events and
// complete spatial units selected by strobeFormationBank below.
const event=(at,duration,bank,role='lead',release=.12)=>({at,duration,bank,role,release});
export const STROBE_MOTIFS=Object.freeze({
 space:{form:6,motion:'hold',order:'pairs',events:[event(0,2.6,0),event(3,1.2,1,'answer',.5),event(5,1.8,2),event(7,.65,0,'answer')]},
 ribbon:{form:19,motion:'sweep',order:'linear',events:[event(0,1.3,0),event(1,1.3,1),event(2,1.3,2),event(3.5,.6,3,'answer'),event(4,1.3,3),event(5,1.3,2),event(6,1.3,1),event(7.5,.4,0,'answer')]},
 exchange:{form:17,motion:'hold',order:'wings',events:[event(0,.7,0),event(1,.55,1),event(1.75,.25,0,'answer'),event(2.5,.8,0),event(3.5,.35,1,'answer'),event(4,.7,1),event(5,.55,0),event(5.75,.25,1,'answer'),event(6.5,.8,1),event(7.5,.35,0,'answer')]},
 zipper:{form:2,motion:'hold',order:'alternating',events:[event(0,.45,0),event(.75,.3,1),event(1.5,.45,0),event(2.5,.65,1),event(3.5,.3,0,'answer'),event(4,.45,1),event(4.75,.3,0),event(5.5,.45,1),event(6.5,.65,0),event(7.5,.3,1,'answer')]},
 unfold:{form:0,motion:'open',order:'pairs',events:[event(0,1.4,0),event(1.5,1.2,1),event(3,.8,2),event(4,.7,3),event(5,.45,2),event(5.75,.4,1),event(6.5,.35,0),event(7,.25,1,'answer'),event(7.5,.25,2,'answer')]},
 crown:{form:12,motion:'hold',order:'pairs',events:[event(0,.55,0),event(.5,.5,1),event(1,.5,2),event(1.5,.5,3),event(2.5,.8,1,'answer'),event(4,.55,3),event(4.5,.5,2),event(5,.5,1),event(5.5,.5,0),event(6.5,.8,2,'answer')]},
});
export function chooseStrobeMotif(scene,kind){
 if(['calm','outro','silence'].includes(kind)||scene.vocals>=.6)return 'space';
 if(kind==='build')return 'unfold';
 if(kind==='impact')return scene.drive>=.75?'crown':'exchange';
 if(kind==='flow'||scene.drive<.55)return 'ribbon';
 return scene.texture>.5?'zipper':'exchange';
}
export function strobeRole(rank,count,row=0,groups=1){
 // Physical rows take roles where available; smaller rigs share mirrored pairs.
 const slot=groups>1?row:Math.min(rank,count-1-rank);
 return slot%3===1?'answer':slot%3===2&&Math.max(groups,Math.ceil(count/2))>=3?'accent':'lead';
}
export function strobeRoleColor(rgb,role){
 // Preserve the track palette's hue for the lead. Answers have a stable
 // contrasting hue; accents are pale versions of the original color.
 if(role==='answer')return [rgb[2],rgb[0],rgb[1]];
 if(role==='accent'){const peak=Math.max(...rgb);return rgb.map(v=>v*.25+peak*.75);}
 return rgb;
}
// Select complete spatial units within a musical role. A fan needs its whole
// mirrored pairs; a crossing needs both rays; a travelling line needs neighbours.
// Event timing stays with the conductor, not with the geometry.
export function strobeFormationBank(form,rank,count){
 if(count<=1)return {bank:0,banks:1};
 if([0,1,2,5,6,10,11,12,15,16,17,18].includes(form)){
  const pairs=Math.ceil(count/2),banks=Math.min(4,pairs);
  return {bank:Math.floor(Math.min(rank,count-1-rank)*banks/pairs),banks};
 }
 // At least two adjacent rays make each visible line segment readable.
 const banks=Math.max(1,Math.min(3,Math.floor(count/2)));
 return {bank:Math.min(banks-1,Math.floor(rank*banks/count)),banks};
}
export function motifExposure(figure,rank,count,row=0,groups=1){
 const motif=STROBE_MOTIFS[figure.motifId];
 if(!motif||(!figure.music&&!Number.isFinite(figure.rhythmBeat)))return 1;
 const role=strobeRole(rank,count,row,groups);
 const hasAnswer=groups>1||count>=3;
 const members=groups>1?Array.from({length:count},(_,i)=>i):Array.from({length:count},(_,i)=>i).filter(i=>strobeRole(i,count)===role);
 rank=members.indexOf(rank);count=members.length;
 const pairs=Math.ceil(count/2),pair=Math.min(rank,count-1-rank);
 const banks=motif.order==='wings'||motif.order==='alternating'?Math.min(2,count):Math.min(4,motif.order==='pairs'?pairs:count);
 const bank=motif.order==='wings'?(rank<count/2?0:banks-1):motif.order==='alternating'?rank%banks:motif.order==='pairs'?Math.floor(pair*banks/pairs):Math.floor(rank*banks/count);
 if(figure.music){
  const unit=strobeFormationBank(figure.form,rank,count);
  return strobeMusicExposure(figure.music,role,unit.bank,unit.banks,hasAnswer);
 }
 let level=0;
 for(const e of motif.events){
  // Tiny rigs reuse the lead for answers. An answer row traverses the same
  // geometry in the opposite direction, on its own authored entrances.
  if(role==='accent'||(hasAnswer?e.role!==role:false))continue;
  const wanted=(role==='answer'?banks-1-e.bank%banks:e.bank%banks);
  if(bank!==wanted)continue;
  let at=Math.floor(figure.rhythmBeat/8)*8+e.at;
  if(at>figure.rhythmBeat+.22)at-=8;
  // Nudge an authored entrance to a nearby measured bass attack. Preserve
  // the sentence's rests and order instead of flashing on every detection.
  const attacks=figure.attackBeats||[];let lo=0,hi=attacks.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(attacks[mid]<at)lo=mid+1;else hi=mid;}
  const near=[attacks[lo-1],attacks[lo]].filter(Number.isFinite).sort((a,b)=>Math.abs(a-at)-Math.abs(b-at))[0];
  if(Number.isFinite(near)&&Math.abs(near-at)<=.22)at=near;
  const elapsed=figure.rhythmBeat-at;
  if(elapsed<0)continue;
  if(elapsed>=e.duration)continue;
  const attack=Math.min(.035,e.duration*.1),release=e.duration*e.release;
  level=Math.max(level,Math.min(1,elapsed/attack,(e.duration-elapsed)/Math.max(.001,release)));
 }
 // Accents follow measured salient events, never an invented flash per beat.
 if(role==='accent')level=figure.accentLevel??0;
 // A single lamp can articulate the sentence too; pauses remain intentional.
 return Math.max(0,Math.min(1,level));
}
