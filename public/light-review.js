import {automaticGroupScore} from './dmx-group-motion.js';
import {movingMoodForProfile} from './dj-show-profile.js';
import {planShowScore} from './show-score.js';
import {lightingScenes} from './dmx-light-scenes.js';
import {showFrameAt} from './show-plan.js';
import {songPaletteAt} from './song-palette.js';
import {movingDirections} from './dmx-moving-direction.js';
import {movingCues,movingCueAt} from './dmx-moving-cues.js';

// Offline review data, captured on request rather than on every playback tick.
// Export the active profile's prepared motion, before room routing/calibration.
export function lightReview(plan,{title='',time=0}={}){
 if(!Number.isFinite(plan?.duration)||!plan.frames?.length)throw Error('Vorbereitete Lichtshow fehlt.');
 const position=Math.max(0,Math.min(plan.duration,Number.isFinite(time)?time:0));
 const mood=movingMoodForProfile(plan.showProfile||'auto');
 const cues=movingCues(plan,'auto',mood);
 return structuredClone({format:'anydj-light-review',version:1,title,
  reference:{songTime:position,timeUnit:'seconds',movementMode:'auto',movementMood:mood,
   scope:'Prepared song and editor overrides; excludes room, fixture calibration, deck mix and live stage settings.'},
  snapshot:{frame:showFrameAt(plan,position),palette:songPaletteAt(plan,position),
   section:plan.sections?.find(s=>position>=s.start&&position<s.end)??null,
   pose:cues?movingCueAt(cues,position):null},
  decisions:{groupMotion:mood==='balanced'?automaticGroupScore(plan):null,showScore:plan.showProfile==='show'?(plan.showScore||planShowScore(plan)):null,scenes:lightingScenes(plan),colors:plan.colorDirection??null,movement:plan.showProfile==='show'?null:movingDirections(plan),cues},plan});
}

// Analysis plans may contain typed arrays. JSON arrays keep exported plans readable.
export const lightReviewJSON=review=>JSON.stringify(review,(_,value)=>ArrayBuffer.isView(value)?Array.from(value):value);
