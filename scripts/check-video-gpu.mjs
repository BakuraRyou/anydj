import {app,BrowserWindow} from 'electron';
import {configureDesktopGraphics} from '../desktop/graphics.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const profile=mkdtempSync(join(tmpdir(),'anydj-gpu-check-'));app.setPath('userData',profile);configureDesktopGraphics(app);
app.whenReady().then(async()=>{
 try{
  const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await window.loadURL('data:text/html,<html><body></body></html>');
  const result=await window.webContents.executeJavaScript(`(()=>{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{powerPreference:'high-performance',antialias:true});if(!gl)return {available:false};const ext=gl.getExtension('WEBGL_debug_renderer_info');const hardware=document.createElement('canvas').getContext('webgl',{powerPreference:'high-performance',failIfMajorPerformanceCaveat:true});return {available:true,hardwareContext:!!hardware,renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),vendor:gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)};})()`);
  console.log(JSON.stringify({webgl:result,status:app.getGPUFeatureStatus(),gpu:await app.getGPUInfo('basic')}));
  window.destroy();rmSync(profile,{recursive:true,force:true});app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
