import {cleanCuts,cleanCutJoins,transitionCutChanges} from './track-cuts.js';

// Commit both titles together; a rejected transition must not leave restored cuts.
export async function saveTransitionCutChanges(pair,{validate,save,changed,accept}){
 const changes=transitionCutChanges(pair).filter((change,i,all)=>!all.slice(0,i).some(c=>pair.libraryTracks[c.index]===pair.libraryTracks[change.index]));
 if(!changes.length)return accept();
 for(const change of changes){
  const track=pair.libraryTracks[change.index],duration=track.plan.duration;
  const current=[cleanCuts(track.audioCuts,duration),cleanCutJoins(track.audioCutJoins,track.audioCuts,duration)];
  if(JSON.stringify(current)!==JSON.stringify([change.beforeCuts,change.beforeJoins]))throw Error('Die Schnitte wurden inzwischen geändert. Paar bitte neu laden.');
 }
 validate(changes);
 const originals=changes.map(c=>{const track=pair.libraryTracks[c.index];return {track,cuts:track.audioCuts,joins:track.audioCutJoins};});
 let persisted=false;
 try{
  for(const c of changes){const track=pair.libraryTracks[c.index];track.audioCuts=structuredClone(c.cuts);track.audioCutJoins=structuredClone(c.joins);}
  await save(originals.map(o=>o.track));persisted=true;changed();
  const accepted=await accept();if(accepted)return accepted;
 }catch(error){
  await rollback();throw error;
 }
 await rollback();return false;
 async function rollback(){
  for(const {track,cuts,joins} of originals){track.audioCuts=cuts;track.audioCutJoins=joins;}
  if(persisted)await save(originals.map(o=>o.track));changed();
 }
}
