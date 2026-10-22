import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreCutRanges,restoreTransitionPair,transitionCutChanges,cutTransitionFits,transitionCutTracks} from '../public/track-cuts.js';
import {timelineEdit} from '../public/transition-timeline.js';
import {saveTransitionCutChanges} from '../public/transition-cut-save.js';

function fixture(){
 const tracks=[{plan:{duration:100},audioCuts:[[30,50]],audioCutJoins:[]},{plan:{duration:80},audioCuts:[[0,20]],audioCutJoins:[]}];
 return {allowCutRestore:true,libraryTracks:tracks,from:{duration:100,rate:1,audioCuts:structuredClone(tracks[0].audioCuts),audioCutJoins:[]},to:{duration:80,rate:2,audioCuts:structuredClone(tracks[1].audioCuts),audioCutJoins:[]},plan:{time:70,cue:20,duration:8,style:'smooth'}};
}
test('restoration retains cut fragments and never extends past the original file',()=>{
 assert.deepEqual(restoreCutRanges([[30,50],[60,80]],100,[[35,43],[75,120]]),[[30,35],[43,50],[60,75]]);
 assert.deepEqual(restoreCutRanges([[0,100]],100,[[0,100]]),[]);
 assert.deepEqual(restoreCutRanges([[5,7]],100,[[5.0000003,6.9999997]]),[]);
});
test('transition drag restores its final overlap at both source rates, not its drag path',()=>{
 const pair=fixture(),first=restoreTransitionPair(pair,{...pair.plan,time:35,cue:4});
 assert.deepEqual(first.from.audioCuts,[[30,35],[43,50]]);assert.deepEqual(first.to.audioCuts,[[0,4]]);
 assert.ok(cutTransitionFits(first.plan,...transitionCutTracks(first),1,2));
 assert.deepEqual(transitionCutChanges(first).map(c=>c.restored),[[[35,43]],[[4,20]]]);
 const moved=restoreTransitionPair(first,{...first.plan,time:40,cue:24});
 assert.deepEqual(moved.from.audioCuts,[[30,40],[48,50]]);assert.deepEqual(moved.to.audioCuts,[[0,20]]);
 assert.deepEqual(restoreTransitionPair(moved,pair.plan).from.audioCuts,pair.from.audioCuts);
 assert.deepEqual(pair.libraryTracks[0].audioCuts,[[30,50]]);
 assert.equal(timelineEdit(first,'time',35),35);assert.equal(timelineEdit(first,'time',Infinity),92);
 assert.equal(timelineEdit(first,'duration',60),38);
 assert.equal(timelineEdit({...first,allowCutRestore:false},'time',36),35);
});
test('one title in both lanes restores the union, preserving unrelated internal joins',()=>{
 const pair=fixture();pair.libraryTracks[1]=pair.libraryTracks[0];pair.to={...pair.from,rate:1};
 const joined={cut:[60,70],duration:2,style:'smooth',points:null};
 pair.from.audioCuts=pair.to.audioCuts=[[30,50],[60,70]];pair.from.audioCutJoins=pair.to.audioCutJoins=[joined];
 const draft=restoreTransitionPair(pair,{...pair.plan,time:32,cue:42,duration:4});
 assert.deepEqual(draft.from.audioCuts,[[30,32],[36,42],[46,50],[60,70]]);
 assert.deepEqual(draft.from.audioCuts,draft.to.audioCuts);assert.deepEqual(draft.from.audioCutJoins,[joined]);
 const touching=restoreTransitionPair(draft,{...draft.plan,time:58,cue:42});
 assert.deepEqual(touching.from.audioCutJoins,[]);assert.equal(transitionCutChanges(touching)[0].removedJoins,1);
});
test('acceptance saves both restored titles together',async()=>{
 const pair=fixture(),draft=restoreTransitionPair(pair,{...pair.plan,time:35,cue:4}),calls=[];
 const result=await saveTransitionCutChanges(draft,{validate:()=>{},save:async tracks=>calls.push(tracks.length),changed:()=>{},accept:async()=>true});
 assert.equal(result,true);assert.deepEqual(calls,[2]);assert.deepEqual(pair.libraryTracks[0].audioCuts,[[30,35],[43,50]]);
});
test('failed storage and rejected transitions restore the previous cuts',async()=>{
 for(const failure of ['storage','rejected','throw']){
  const pair=fixture(),draft=restoreTransitionPair(pair,{...pair.plan,time:35,cue:4}),before=structuredClone(pair.libraryTracks);let writes=0;
  const operation=saveTransitionCutChanges(draft,{validate:()=>{},save:async()=>{writes++;if(failure==='storage')throw Error('disk full');},changed:()=>{},accept:async()=>{if(failure==='throw')throw Error('changed pair');return false;}});
  if(failure==='rejected')assert.equal(await operation,false);else await assert.rejects(operation);
  assert.deepEqual(pair.libraryTracks,before);assert.equal(writes,failure==='storage'?1:2);
 }
});
test('concurrent cuts and unavailable decks block saving before mutation',async()=>{
 for(const stale of [true,false]){
  const pair=fixture(),draft=restoreTransitionPair(pair,{...pair.plan,time:35,cue:4});if(stale)pair.libraryTracks[0].audioCuts=[[0,10]];
  const before=structuredClone(pair.libraryTracks);let writes=0;
  await assert.rejects(saveTransitionCutChanges(draft,{validate:()=>{throw Error('pause decks');},save:async()=>writes++,changed:()=>{},accept:async()=>true}),stale?/inzwischen geändert/:/pause decks/);
  assert.deepEqual(pair.libraryTracks,before);assert.equal(writes,0);
 }
});
