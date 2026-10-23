import {installLocalAudio,installLocalReadPermissions} from './local-audio.mjs';
import {app, BrowserWindow, dialog, session, shell, ipcMain} from 'electron';
import {fileURLToPath} from 'node:url';
import {installWindowChrome,showAppWindow} from './window-chrome.mjs';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {bundledAnalysis} from './analysis.mjs';
import {readFile} from 'node:fs/promises';

// A stable origin preserves IndexedDB, folder handles and localStorage across launches.
let origin='http://127.0.0.1:36931';
const isolatedTest=process.argv.includes('--demo')&&process.argv.includes('--isolated-test');
let backend, window, quitting=false;
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(window)showAppWindow(window);});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{
    if(quitting||!backend)return;
    event.preventDefault();quitting=true;
    const timeout=setTimeout(()=>app.exit(0),6000);timeout.unref();
    void (async()=>{
      try {await backend.dmx.close();if(backend.music.session)await backend.music.stop(backend.music.session.id);}
      finally {backend.server.close(()=>app.exit(0));backend.server.closeAllConnections();}
    })();
  });
  void app.whenReady().then(async()=>{
  try {
    const token=randomBytes(32).toString('hex');
    const build=app.isPackaged?JSON.parse(await readFile(join(process.resourcesPath,'build-flavor.json'),'utf8')):{analysis:false};
    const analysis=build.analysis?await bundledAnalysis(join(process.resourcesPath,'analysis'),app.getPath('userData')):{};
    let previewTls=null;
    if(process.env.SSL_CERT_FILE||process.env.SSL_KEY_FILE){if(!process.env.SSL_CERT_FILE||!process.env.SSL_KEY_FILE)throw Error('Für die HTTPS-Vorschau SSL_CERT_FILE und SSL_KEY_FILE gemeinsam angeben.');const [cert,key]=await Promise.all([readFile(process.env.SSL_CERT_FILE),readFile(process.env.SSL_KEY_FILE)]);previewTls={cert,key};}
    backend=await createApp({...analysis,previewTls,dataDir:join(app.getPath('userData'),'data'),token,demo:process.argv.includes('--demo')});
    await new Promise((resolve,reject)=>{backend.server.once('error',reject);backend.server.listen(isolatedTest?0:36931,'127.0.0.1',resolve);});
    if(isolatedTest)origin=`http://127.0.0.1:${backend.server.address().port}`;
    const browserSession=session.fromPartition('persist:anydj');
    installLocalReadPermissions(browserSession,{origin,getWindow:()=>window});
    await installLocalAudio({ipcMain,origin,getWindow:()=>window,directory:join(app.getPath('userData'),'data')});
    browserSession.webRequest.onBeforeSendHeaders({urls:[`${origin}/*`]},(details,callback)=>{
      callback({requestHeaders:{...details.requestHeaders,Authorization:`Bearer ${token}`}});
    });
    const appIcon=fileURLToPath(new URL('./icons/icon.png',import.meta.url));
    if(process.platform==='darwin')app.dock?.setIcon(appIcon);
    window=new BrowserWindow({show:false,icon:appIcon,width:1440,height:960,minWidth:800,minHeight:600,title:'AnyDj',backgroundColor:'#0b0c10',
      frame:process.platform==='darwin',
      ...(process.platform==='darwin'?{titleBarStyle:'hidden',trafficLightPosition:{x:12,y:10}}:{}),
      webPreferences:{preload:fileURLToPath(new URL('./titlebar.cjs',import.meta.url)),session:browserSession,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    installWindowChrome(window,ipcMain,origin);
    window.once('ready-to-show',()=>showAppWindow(window));
    window.webContents.on('will-prevent-unload',event=>{
      const response=dialog.showMessageBoxSync(window,{type:'question',title:'AnyDj verlassen?',message:'Es läuft noch eine Wiedergabe oder es gibt eine ungesicherte Aufnahme bzw. einen Export.',detail:'Beim Verlassen wird die Wiedergabe beendet. Nicht heruntergeladene Aufnahmen oder Exporte können verloren gehen.',buttons:['In AnyDj bleiben','Trotzdem verlassen'],defaultId:0,cancelId:0,noLink:true});
      if(response===1)event.preventDefault();
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(({url})=>{
      const target=new URL(url);
      if(target.origin===origin&&target.pathname==='/dj-detached.html')return {action:'allow',overrideBrowserWindowOptions:{title:'AnyDj · Warteschlange',minWidth:420,minHeight:320,autoHideMenuBar:true,backgroundColor:'#0b0c10',webPreferences:{session:browserSession,contextIsolation:true,nodeIntegration:false,sandbox:true}}};
      if(target.origin===origin&&target.pathname==='/spotify-callback.html')return {action:'allow',overrideBrowserWindowOptions:{width:520,height:760,autoHideMenuBar:true,webPreferences:{session:browserSession,contextIsolation:true,nodeIntegration:false,sandbox:true}}};
      if(target.protocol==='https:'&&['open.spotify.com','developer.spotify.com'].includes(target.hostname))void shell.openExternal(url);
      return {action:'deny'};
    });
    window.webContents.on('did-create-window',(child,details)=>{
      const detached=new URL(details.url).pathname==='/dj-detached.html';
      child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      child.webContents.on('will-navigate',(event,url)=>{
        const target=new URL(url);
        if(detached?target.origin!==origin||target.pathname!=='/dj-detached.html':target.protocol!=='https:'&&!(target.origin===origin&&target.pathname==='/spotify-callback.html'))event.preventDefault();
      });
    });
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
    await window.loadURL(`${origin}/dj`);
  } catch(error) {
    dialog.showErrorBox('AnyDj konnte nicht starten',error.code==='EADDRINUSE'
      ? 'Der lokale Port 36931 wird bereits verwendet. Bitte die andere Anwendung schließen und AnyDj erneut starten.' : error.message);
    app.quit();
  }
  });
}
