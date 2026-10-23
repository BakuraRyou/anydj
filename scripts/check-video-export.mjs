import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,copyFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const long=process.argv.includes('--long'),songDuration=long?16:2;
const fullHd=process.argv.includes('--1080'),hardware=process.argv.includes('--hardware'),largeRig=process.argv.includes('--large-rig')||process.argv.includes('--large-export'),largeExport=process.argv.includes('--large-export'),highPerformance=process.argv.includes('--high-performance-gpu');

if(!process.versions.electron){
 const profile=await mkdtemp(join(tmpdir(),'anydj-video-ui-'));
 try{
  const {default:electron}=await import('electron');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>{
   const child=spawn(hardware?electron:'xvfb-run',[...(hardware?[]:['-a',electron]),'--no-sandbox',...(hardware?[]:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']),...(process.env.ANYDJ_TEST_ANGLE?['--use-angle='+process.env.ANYDJ_TEST_ANGLE]:[]),fileURLToPath(import.meta.url),profile,...(process.argv.includes('--jpeg')?['--jpeg']:[]),...(process.argv.includes('--codecs')?['--codecs']:[]),...(long?['--long']:[]),...(fullHd?['--1080']:[]),...(hardware?['--hardware']:[]),...(process.argv.includes('--visible')?['--visible']:[]),...(highPerformance?['--high-performance-gpu']:[]),...(largeRig?['--large-rig']:[]),...(largeExport?['--large-export']:[])],{env,detached:true,stdio:['ignore','pipe','pipe']});let log='';
   const timer=setTimeout(()=>{process.kill(-child.pid,'SIGKILL');reject(Error('Video export timeout: '+log));},120000);
   child.stdout.on('data',data=>{log+=data;process.stdout.write(data);});child.stderr.on('data',data=>{log+=data;});
   child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0&&!/UnhandledPromiseRejectionWarning|Unzulässiger Videoexport/.test(log)?resolve():reject(Error(log));});
  });
 }finally{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}else{
 void (async()=>{
 const {app,dialog}=await import('electron');
 const entry=process.argv.findIndex(arg=>arg.endsWith('check-video-export.mjs')),profile=process.argv[entry+1],destination=join(profile,'playlist.mp4');
 app.setPath('userData',profile);process.argv.push('--demo','--isolated-test');
 dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});dialog.showErrorBox=(title,message)=>console.error(title,message);
 let main;const errors=[];
 app.on('browser-window-created',(_event,win)=>{if(!main)main=win;if(hardware&&!process.argv.includes('--visible')){win.show=()=>{};win.focus=()=>{};}win.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});});
 const evaluate=source=>main.webContents.executeJavaScript(source,true),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const wait=async(source,timeout=30000)=>{const deadline=Date.now()+timeout;let report=Date.now()+10000;while(Date.now()<deadline){if(Date.now()>report){report=Date.now()+10000;console.log(JSON.stringify({waiting:main?await evaluate("document.querySelector('.dj-export-dialog [data-status]')?.textContent"):null}));}if(main&&!main.webContents.isLoading()&&await evaluate(source))return;await pause(50);}throw Error('Timeout: '+source+' '+JSON.stringify(errors)+' '+(main?await evaluate("document.querySelector('.dj-export-dialog [data-status]')?.textContent"):''));};
 try{
  await import('../desktop/main.mjs');await wait("!!document.querySelector('[data-export-format=mp4]')");
  if(process.argv.includes('--codecs')){
   console.log(JSON.stringify(await evaluate(`(async()=>{const result={available:typeof VideoEncoder!=='undefined',codecs:[]};if(result.available)for(const hardwareAcceleration of ['prefer-hardware','prefer-software','no-preference'])try{result.codecs.push(await VideoEncoder.isConfigSupported({codec:'avc1.640028',width:1920,height:1080,bitrate:12000000,framerate:30,hardwareAcceleration,avc:{format:'annexb'}}));}catch(e){result.codecs.push({error:e.message});}return result;})()`)));app.quit();return;
  }
  if(process.argv.includes('--jpeg'))await evaluate('window.VideoEncoder=undefined');
  // Exercise the actual menu callback and its snapshot of the active room/camera.
  await evaluate("document.querySelector('[data-export-format=mp4]').click()");
  assert.equal(await evaluate("document.querySelector('.dj-export-dialog [data-format]').value"),'mp4');
  assert.equal(await evaluate("document.querySelector('.dj-export-dialog [data-video-size]').value"),'1080');
  await evaluate("document.querySelector('.dj-export-dialog [data-close]').click()");
  await wait("!document.querySelector('.dj-export-dialog')");
  const demo=(await readFile(new URL('../public/web-demo.js',import.meta.url),'utf8')).replace('export function','function').replace('duration=24','duration='+songDuration);
  await evaluate(`(async()=>{
   ${demo}
   const files=createDemoFiles(),{compileShow}=await import('/show-plan.js'),{openQueueExport}=await import('/queue-export-dialog.js'),{stageLayout}=await import('/dmx-layout-model.js'),{stageEquipment}=await import('/dmx-model.js'),{cleanStageSettings}=await import('/dmx-show.js'),{newRoomPlan,roomPlanLayout}=await import('/dmx-ar-model.js');
   const tracks=files.map((file,i)=>({id:'video-'+i,file,name:file.name,size:file.size,lastModified:file.lastModified,audioCuts:i===0?[[.5,.7]]:[],plan:compileShow(Array.from({length:${songDuration*50}},(_,j)=>({rms:.15+.1*Math.sin(j/5),bass:.04,beatSeq:Math.floor(j/25)})) ,${songDuration},{arrangement:'auto',mood:'auto',minimum:10,maximum:100,period:4,strength:80,palette:'auto'})}));
   const equipment=stageEquipment({unified:true,devices:[{id:'moving-0',type:'moving',cells:1},{id:'moving-1',type:'moving',cells:1},{id:'spot',type:'spot',cells:1}]}),config=cleanStageSettings(null,3);
   const {combinedFormationRoom,roomSpectatorView}=await import('/dmx-room-presets.js');const plan=${largeRig?'combinedFormationRoom()':'newRoomPlan(8,6,3)'};if(!${largeRig})plan.positions={'moving-0':{type:'moving',x:-2,y:5,height:2.5},'moving-1':{type:'moving',x:2,y:5,height:2.5},'fixture-spot':{type:'spot',x:0,y:5,height:2.5}};
   const videoSetup={equipment,config,layout:stageLayout(),view:{camera:${largeRig?'roomSpectatorView(roomPlanLayout(plan))':"{mode:'dancer',x:0,y:-2,eyeHeight:1.7,yaw:0,pitch:0,zoom:1}"},layout:roomPlanLayout(plan),roomPlan:plan,crowd:[],room:{enabled:false},zones:{zones:[],aims:{}}},flicker:100};
   window.videoOptions={entries:tracks.map(t=>({id:t.id,trackId:t.id})),tracks,options:{seconds:1,musical:false},ensureFile:async track=>track.file,videoSetup,format:'mp4',onVideoTiming:value=>{window.videoTimings=value}};
   if(${largeRig&&!largeExport}){
    window.rigBenchmark=(async()=>{
     const {createQueueVideoScene}=await import('/queue-video-scene.js'),{createStageGpuScene}=await import('/dmx-stage-gpu-scene.js'),{createWebGlStage}=await import('/dmx-stage-webgl.js'),{queueVideoStreams}=await import('/queue-video-timeline.js'),{planQueueExport}=await import('/queue-export-plan.js');
     const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
     const renderer=createWebGlStage(canvas,()=>{}),scene=createQueueVideoScene(videoSetup),geometry=createStageGpuScene(),schedule=planQueueExport(window.videoOptions.entries,tracks,window.videoOptions.options);
     const metrics={renderer:renderer.device,sceneMs:0,geometryMs:0,imageMs:0,frames:84,lights:0},start=performance.now();
     try{for(let i=0;i<84;i++){
      let at=performance.now();const sample=await scene.sample(queueVideoStreams(schedule,i/30),i/30);metrics.sceneMs+=performance.now()-at;metrics.lights=sample.lights.length;
      at=performance.now();const frame=geometry.build(1920,1080,sample.layout,sample.lights,scene.camera,sample.crowd,sample.motion);metrics.geometryMs+=performance.now()-at;frame.volumeScale=1;
      at=performance.now();renderer.render(frame);await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));metrics.imageMs+=performance.now()-at;
     }metrics.totalMs=performance.now()-start;return metrics;}finally{renderer.destroy();scene.destroy();}
    })();return;
   }
   openQueueExport(window.videoOptions);document.querySelector('.dj-export-dialog [data-video-size]').value='${fullHd?'1080':'720'}';document.querySelector('.dj-export-dialog [data-start]').click();
  })()`);
  if(largeRig&&!largeExport){console.log(JSON.stringify({largeRigBenchmark:await evaluate('window.rigBenchmark')}));app.exit(0);return;}
  await wait("document.querySelector('.dj-export-dialog [data-status]')?.textContent.startsWith('MP4 gespeichert:')",90000);
  console.log(JSON.stringify({timings:await evaluate('window.videoTimings')}));
  assert.equal(await evaluate('window.videoTimings.encoding'),process.argv.includes('--jpeg')?'jpeg':'h264');
  console.log(JSON.stringify({performance:await evaluate("document.querySelector('[data-video-performance]')?.textContent")}));
  assert.match(await evaluate("document.querySelector('[data-video-performance]').textContent"),/Grafik:.*Bilder\/s/);
  const {stdout}=await promisify(execFile)('ffprobe',['-v','error','-show_streams','-show_format','-of','json',destination]);const info=JSON.parse(stdout),video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
  assert.equal(video.codec_name,'h264');assert.equal(audio.codec_name,'aac');assert.equal(video.width,fullHd?1920:1280);assert.equal(video.height,fullHd?1080:720);assert.equal(video.r_frame_rate,'30/1');assert.equal(Number(video.nb_frames),Math.round((songDuration*2-1.2)*30));assert.ok(Math.abs(Number(info.format.duration)-(songDuration*2-1.2))<.05);
  await copyFile(destination,'/tmp/anydj-playlist-export-check.mp4');
  await promisify(execFile)('ffmpeg',['-v','error','-y','-ss','1','-i',destination,'-frames:v','1','/tmp/anydj-playlist-export-check.png']);
  // Cancelling while the video is being rendered must preserve the last export.
  const original=await readFile(destination);
  await evaluate("document.querySelector('.dj-export-dialog [data-start]').click()");
  await wait("document.querySelector('.dj-export-dialog [data-status]')?.textContent.includes('Lichtshow · Bild')");
  await evaluate("document.querySelector('.dj-export-dialog [data-cancel]').click()");await wait("document.querySelector('.dj-export-dialog [data-status]')?.textContent==='Export abgebrochen.'");
  assert.deepEqual(await readFile(destination),original);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mp4:true,video:video.codec_name,audio:audio.codec_name,pixels:[video.width,video.height],frames:video.nb_frames,duration:info.format.duration,cutsAndCrossfade:true,cancelPreservesPreviousFile:true}));
  app.quit();
 }catch(error){console.error(error,errors);app.exit(1);}
 })();
}
