import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpotifyPlayback} from '../public/spotify-playback.js';
import {spotifyQueueEntry,copyQueueEntry,validQueueEntry} from '../public/provider-queue.js';
const id='a'.repeat(22);
function mock(){
 const calls=[];let player;
 class Player{
  listeners={};state=null;
  constructor(options){this.options=options;player=this;}
  addListener(name,fn){this.listeners[name]=fn;}
  connect(){this.listeners.ready({device_id:'device'});return Promise.resolve(true);}
  disconnect(){calls.push('disconnect');}
  activateElement(){return Promise.resolve();}setVolume(){return Promise.resolve();}
  getCurrentState(){return Promise.resolve(this.state);}
  resume(){calls.push('resume');return Promise.resolve();}pause(){calls.push('pause');return Promise.resolve();}
  seek(ms){calls.push(['seek',ms]);return Promise.resolve();}
  emit(state){this.state=state;this.listeners.player_state_changed(state);}
 }
 const client={canStream:true,access:async()=> 'access',request:async(path,options)=>{calls.push({path,options});}};
 return {client,calls,loadSDK:async()=>({Player}),get player(){return player;}};
}
test('single-track playback, pause, seek and cancellation address the SDK device',async t=>{
 const m=mock(),p=createSpotifyPlayback(m);t.after(()=>p.stop());
 await p.play(id);
 const request=m.calls.find(x=>x.path);
 assert.match(request.path,/device_id=device/);assert.deepEqual(request.options.body,{uris:['spotify:track:'+id]});
 m.player.emit({paused:false,position:500,duration:10000,track_window:{current_track:{id}}});
 await p.toggle();assert.ok(m.calls.includes('pause'));
 await p.seek(20);assert.deepEqual(m.calls.at(-1),['seek',10000]);
 p.stop();assert.equal(request.options.signal.aborted,true);assert.equal(p.state,null);
});
test('missing stream consent is actionable and does not initialize SDK',async()=>{
 let loaded=false,prompted=0;
 const p=createSpotifyPlayback({client:{canStream:false},onAuthorizationRequired:()=>prompted++,loadSDK:async()=>{loaded=true;}});
 await assert.rejects(p.play(id),/erneut verbinden/);assert.equal(loaded,false);assert.equal(prompted,1);
 assert.throws(()=>p.ensureAuthorized(),/Wiedergabefreigabe/);assert.equal(prompted,2);
});
test('late SDK initialization cannot restart playback after stop',async()=>{
 let complete,requests=0;
 const p=createSpotifyPlayback({client:{canStream:true,request:()=>requests++},loadSDK:()=>new Promise(r=>complete=r)});
 const pending=p.play(id);p.stop();complete({});await assert.rejects(pending,/abgebrochen/);assert.equal(requests,0);
});
test('confirmed end advances once; ordinary pause never advances',async t=>{
 const m=mock();let ended=0;const p=createSpotifyPlayback({...m,onEnded:()=>ended++});t.after(()=>p.stop());
 await p.play(id);const state={paused:false,position:2000,duration:10000,track_window:{current_track:{id}}};
 m.player.emit(state);m.player.emit({...state,paused:true});assert.equal(ended,0);
 m.player.emit({...state,position:9999});m.player.emit({...state,paused:true,position:0});assert.equal(ended,1);assert.equal(p.state,null);
});
test('mixed queues retain duplicates and provider metadata through saving and copying',()=>{
 const remote={id,name:'Song',artists:['Artist'],duration:5000};
 const list=[{id:'local',trackId:'file'},spotifyQueueEntry(remote,'one'),spotifyQueueEntry(remote,'two')];
 const restored=JSON.parse(JSON.stringify(list)).filter(validQueueEntry).map(e=>copyQueueEntry(e));
 assert.deepEqual(restored,list);assert.equal(copyQueueEntry(list[1],'new').remote.id,id);
 assert.equal(validQueueEntry({id:'bad',trackId:'spotify:'+id}),false);
 assert.equal(validQueueEntry({...list[1],remote:{id:'invalid'}}),false);
});
