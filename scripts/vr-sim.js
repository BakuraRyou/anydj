import {XRDevice,metaQuest3} from '/iwer.js';
import {DevUI} from '/devui.js';

try{
  const device=new XRDevice(metaQuest3,{stereoEnabled:false});
  device.installRuntime({forceInstall:true});
  device.installDevUI(DevUI);
  // Install the runtime before the receiver captures navigator.xr.
  await import('/vr-view.js');
  let started=false;
  const timer=setInterval(()=>{
    const button=document.querySelector('#enterVR');
    if(!started&&!button.disabled&&document.querySelector('#connection').textContent==='Live mit dem Rechner verbunden'){
      started=true;clearInterval(timer);button.click();
    }
  },100);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}catch(error){document.querySelector('#connection').textContent='VR-Simulation konnte nicht starten: '+error.message;console.error(error);}
