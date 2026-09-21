import {app, BrowserWindow, dialog, session, shell} from 'electron';
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
  app.on('second-instance',()=>{if(window?.isMinimized())window.restore();window?.show();window?.focus();});
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
    backend=await createApp({...analysis,dataDir:join(app.getPath('userData'),'data'),token,demo:process.argv.includes('--demo')});
    await new Promise((resolve,reject)=>{backend.server.once('error',reject);backend.server.listen(isolatedTest?0:36931,'127.0.0.1',resolve);});
    if(isolatedTest)origin=`http://127.0.0.1:${backend.server.address().port}`;
    const browserSession=session.fromPartition('persist:anydj');
    browserSession.webRequest.onBeforeSendHeaders({urls:[`${origin}/*`]},(details,callback)=>{
      callback({requestHeaders:{...details.requestHeaders,Authorization:`Bearer ${token}`}});
    });
    window=new BrowserWindow({width:1440,height:960,minWidth:800,minHeight:600,title:'AnyDj',backgroundColor:'#12181c',
      webPreferences:{session:browserSession,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(({url})=>{
      const target=new URL(url);
      if(target.origin===origin&&target.pathname==='/spotify-callback.html')return {action:'allow',overrideBrowserWindowOptions:{width:520,height:760,autoHideMenuBar:true,webPreferences:{session:browserSession,contextIsolation:true,nodeIntegration:false,sandbox:true}}};
      if(target.protocol==='https:'&&['open.spotify.com','developer.spotify.com'].includes(target.hostname))void shell.openExternal(url);
      return {action:'deny'};
    });
    window.webContents.on('did-create-window',child=>{
      child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      child.webContents.on('will-navigate',(event,url)=>{
        const target=new URL(url);
        if(target.protocol!=='https:'&&!(target.origin===origin&&target.pathname==='/spotify-callback.html'))event.preventDefault();
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
