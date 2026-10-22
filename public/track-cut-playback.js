import {cleanCuts,cleanCutJoins,cutJoinPlan,nextKeptTime} from './track-cuts.js';
import {transitionAudioGains} from './transition-audio.js';
import {transitionBassDb} from './musical-transition.js';

// Mix both sides of an internal edit before the deck EQ and its outer crossfade.
// The primary media element keeps its original-file clock for lighting and cues.
export function createCutPlayback({context,audio,source,destination,getTrack,onError=()=>{},onSkip=()=>{}}){
 let other=null,incoming=null;
 const mainBass=context.createBiquadFilter(),otherBass=context.createBiquadFilter();
 for(const filter of [mainBass,otherBass]){filter.type='lowshelf';filter.frequency.value=250;}
 const mainGain=context.createGain(),otherGain=context.createGain();otherGain.gain.value=0;
 source.connect(mainBass);mainBass.connect(mainGain);mainGain.connect(destination);
 otherBass.connect(otherGain);otherGain.connect(destination);
 let url='',job=null,epoch=0,ownSeek=false,finishing,dead=false,cached=[],cuts=[],keys=[];
 const set=(param,value)=>{param.cancelScheduledValues(context.currentTime);param.setTargetAtTime(value,context.currentTime,.005);};
 const seekPastCut=next=>{onSkip({from:audio.currentTime,to:next});audio.currentTime=next;};
 function stop(){epoch++;job=null;ownSeek=false;clearTimeout(finishing);other?.pause();set(mainGain.gain,1);set(otherGain.gain,0);set(mainBass.gain,0);set(otherBass.gain,0);}
 const userSeek=()=>{if(!ownSeek)stop();};audio.addEventListener('seeking',userSeek);audio.addEventListener('pause',stop);audio.addEventListener('ended',stop);
 const finishSeek=()=>{
  if(!ownSeek||!job)return;ownSeek=false;job=null;
  set(mainGain.gain,1);set(otherGain.gain,0);set(mainBass.gain,0);set(otherBass.gain,0);
  finishing=setTimeout(()=>other.pause(),35);
 };
 async function start(join){
  const token=++epoch,plan=cutJoinPlan(join);job={join,plan,phase:'starting'};
  try{
   if(other.readyState<1)await new Promise((resolve,reject)=>{
    const done=()=>{clearTimeout(timer);other.removeEventListener('loadedmetadata',ready);other.removeEventListener('error',failed);};
    const ready=()=>{done();resolve();},failed=()=>{done();reject(Error('Schnittübergang konnte nicht geladen werden.'));};
    const timer=setTimeout(failed,5000);other.addEventListener('loadedmetadata',ready);other.addEventListener('error',failed);
   });
   if(token!==epoch||dead)return;
   other.playbackRate=audio.playbackRate;other.preservesPitch=audio.preservesPitch;
   other.currentTime=plan.cue+Math.max(0,audio.currentTime-plan.time);
   await other.play();if(token!==epoch||dead){other.pause();return;}job.phase='playing';
  }catch(error){if(token===epoch){stop();onError(error.message);}}
 }
 function tick(){
  if(dead)return;
  const track=getTrack(),nextURL=audio.currentSrc||audio.src;
  if(nextURL!==url){stop();url=nextURL;if(other){if(url)other.src=url;else{other.removeAttribute('src');other.load();}}}
  const nextKeys=[track?.audioCuts,track?.audioCutJoins,track?.plan?.duration];
  if(keys.length!==nextKeys.length||!nextKeys.every((key,i)=>key===keys[i])){stop();keys=nextKeys;cuts=cleanCuts(nextKeys[0],nextKeys[2]);cached=cleanCutJoins(nextKeys[1],cuts,nextKeys[2]);}
  if(cached.length&&!other){other=new Audio();other.preload='auto';incoming=context.createMediaElementSource(other);incoming.connect(otherBass);if(url)other.src=url;}
  if(audio.seeking)return;
  if(!job){
   // Every connected player enforces all cuts itself. Deck/preview UI timers
   // are not reliable playback clocks, especially in background windows.
   const time=audio.currentTime,next=nextKeptTime(cuts,track?.plan?.duration,time);
   if(cuts.length&&audio.readyState>=1&&next>time+.00001){seekPastCut(next);return;}
   if(audio.paused)return;
   const join=cached.find(j=>time>=j.cut[0]-j.duration&&time<j.cut[0]);if(join)void start(join);return;
  }
  if(audio.paused)return;
  if(ownSeek)return;
  const {join,plan}=job,time=audio.currentTime;
  if(time<plan.time-.05||time>join.cut[0]+.15){stop();tick();return;}
  if(time>=join.cut[0]){
   if(job.phase!=='playing'){stop();seekPastCut(join.cut[1]);return;}
   ownSeek=true;job.phase='handoff';set(mainGain.gain,0);set(otherGain.gain,1);
   seekPastCut(Math.max(join.cut[1],other.currentTime));return;
  }
  if(job.phase==='playing'){
   other.playbackRate=audio.playbackRate;other.preservesPitch=audio.preservesPitch;
   const progress=(time-plan.time)/join.duration,gains=transitionAudioGains(progress,plan);
   set(mainGain.gain,gains[0]);set(otherGain.gain,gains[1]);
   set(mainBass.gain,plan.style==='bass'?transitionBassDb(progress,false):0);
   set(otherBass.gain,plan.style==='bass'?transitionBassDb(progress,true):0);
  }
 }
 const seeked=()=>{finishSeek();tick();},events=['loadedmetadata','playing','timeupdate','ratechange'];
 audio.addEventListener('seeked',seeked);for(const event of events)audio.addEventListener(event,tick);
 const timer=setInterval(tick,10);tick();
 return {tick,handles:()=>Boolean(job),stop,destroy(){dead=true;clearInterval(timer);stop();audio.removeEventListener('seeking',userSeek);audio.removeEventListener('pause',stop);audio.removeEventListener('ended',stop);audio.removeEventListener('seeked',seeked);for(const event of events)audio.removeEventListener(event,tick);if(other){other.removeAttribute('src');other.load();}for(const node of [mainBass,otherBass,mainGain,otherGain,incoming])node?.disconnect();}};
}
