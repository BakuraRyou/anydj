import {existsSync,readFileSync} from 'node:fs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';

// Must run before app.whenReady(), before Chromium creates its GPU process.
export function configureDesktopGraphics(app,{argv=process.argv,env=process.env,platform=process.platform,nvidia=existsSync('/proc/driver/nvidia/version')}={}){
 const directory=app.getPath('userData'),filename=join(directory,'graphics.json');
 let preference='auto';try{const saved=JSON.parse(readFileSync(filename,'utf8'));if(saved.preference==='nvidia')preference='nvidia';}catch{}
 let changed=false;
 const supported=platform==='linux'&&nvidia;
 const active=supported&&(preference==='nvidia'||argv.includes('--high-performance-gpu'))?'nvidia':'auto';
 if(active==='nvidia'){
  // GLX offload can fail on hybrid desktops. The explicit ANGLE/Vulkan path
  // was verified with the NVIDIA renderer, without changing driver settings.
  env.__NV_PRIME_RENDER_OFFLOAD='1';env.__VK_LAYER_NV_optimus='NVIDIA_only';
  app.commandLine.appendSwitch('use-angle','vulkan');
 }
 return {
  install({ipcMain,getWindow,origin}){
   const trusted=event=>{const owner=getWindow()?.webContents;return owner&&event.sender===owner&&event.senderFrame===owner.mainFrame&&new URL(event.senderFrame.url).origin===origin;};
   const state=()=>({preference,supported,active,restartRequired:changed&&preference!==active});
   ipcMain.handle('anydj:graphics-state',event=>{if(!trusted(event))throw Error('Unzulässige Grafikeinstellung.');return state();});
   ipcMain.handle('anydj:graphics-set',async(event,value)=>{
    if(!trusted(event)||!['auto','nvidia'].includes(value)||value==='nvidia'&&!supported)throw Error('Diese Grafikeinstellung ist nicht verfügbar.');
    await mkdir(directory,{recursive:true});await writeFile(filename+'.tmp',JSON.stringify({preference:value}));await rename(filename+'.tmp',filename);preference=value;changed=true;return state();
   });
  }
 };
}
