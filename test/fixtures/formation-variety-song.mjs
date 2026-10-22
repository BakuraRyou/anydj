import {planSongMovement} from '../../public/song-movement-plan.js';

export function varietySong(){
 const duration=64,beats=Array.from({length:128},(_,i)=>i*.5);
 const p={duration,showProfile:'strobe',step:.125,frames:Array.from({length:512},()=>({state:true,dimming:80,r:40,g:150,b:255})),
  sections:[{start:0,end:duration,look:'peak',motif:0}],beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)},beatTiming:{times:beats,minimum:5,maximum:100},
  arrangement:{step:.125,times:beats,accents:beats.map(()=>.8),decays:beats.map(()=>.2),eventSources:beats.map(()=>'onset'),bases:Array(512).fill(.5),
   patterns:{phrases:[{start:0,end:duration,kind:'bounce',energy:.7,tone:.5,movement:{driving:.7,character:'rhythmic'}}]},lookTrack:Array(512).fill('peak'),
   drama:{step:.125,intensity:Array(512).fill(.7),percussion:Array(512).fill(.7),vocalShare:Array(512).fill(.1)}}};
 p.songMovement=planSongMovement(p);return p;
}
