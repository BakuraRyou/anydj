import {exportGainAt} from './queue-audio-export.js';
import {showFrameAt} from './show-plan.js';
import {sectionPlanAt} from './section-lighting.js';
import {beatPosition} from './dmx-show.js';
import {stageMotionAt} from './stage-motion.js';
import {songPaletteAt} from './song-palette.js';
import {stageAccentStrength,stageWashDimming} from './stage-motifs.js';

// Output timestamps map through the exact audio clips, including internal cuts.
export function queueVideoSources(schedule,time){
 return schedule.clips.filter(clip=>time>=clip.start&&time<clip.end).map(clip=>({
  track:schedule.rows[clip.index].track,source:`export:${clip.index}`,songTime:clip.sourceStart+time-clip.start,weight:exportGainAt(clip,time)
 }));
}
export function queueVideoStreams(schedule,time,flicker=100){
 return queueVideoSources(schedule,time).map(({track,source,songTime,weight})=>{
  const plan=sectionPlanAt(track.plan,songTime),section=plan.sections?.find(s=>songTime>=s.start&&songTime<s.end);
  const grid=plan.beatGrid?.beats||plan.beatTiming?.times,beat=beatPosition(grid,songTime);
  const motif=track.stageMotifs?.[plan.sections?.indexOf(section)],startBeat=motif?beatPosition(grid,motif.start):null;
  return {source,songTime,weight,playing:true,frame:showFrameAt(track.plan,songTime,flicker),movingPlan:plan,flicker,beat,
   motionCharacter:stageMotionAt(plan,songTime),palette:songPaletteAt(plan,songTime),motifColor:motif?.color,motionBeat:beat!==null&&startBeat!==null?beat-startBeat:null,
   look:section?.look,sectionProgress:section?(songTime-section.start)/Math.max(.001,section.end-section.start):0,
   accentStrength:stageAccentStrength(plan,songTime),washDimming:stageWashDimming(plan,songTime),sectionKey:section?`${track.id}:${section.start}`:null};
 });
}
