// Keep window operations scoped to the trusted main renderer, including IPC
// sent by subframes. Closing uses Electron's normal shutdown lifecycle.
export function installWindowChrome(window,ipcMain,origin){
 const trusted=event=>{
  if(event.sender!==window.webContents||!event.senderFrame||event.senderFrame!==window.webContents.mainFrame)return false;
  try{return new URL(event.senderFrame.url).origin===origin;}catch{return false;}
 };
 const state=()=>({maximized:window.isMaximized(),fullscreen:window.isFullScreen(),focused:window.isFocused(),platform:process.platform});
 const publish=()=>{if(!window.isDestroyed())window.webContents.send('anydj:window-state',state());};
 const action=(event,command)=>{
  if(!trusted(event))return;
  if(command==='minimize')window.minimize();
  else if(command==='maximize'&&!window.isFullScreen())window.isMaximized()?window.unmaximize():window.maximize();
  else if(command==='close')window.close();
 };
 ipcMain.on('anydj:window-action',action);
 ipcMain.handle('anydj:window-state',event=>trusted(event)?state():null);
 const events=['maximize','unmaximize','enter-full-screen','leave-full-screen','focus','blur'];
 for(const event of events)window.on(event,publish);
 window.once('closed',()=>{
  ipcMain.removeListener('anydj:window-action',action);
  ipcMain.removeHandler('anydj:window-state');
  for(const event of events)window.removeListener(event,publish);
 });
}

// Show the first painted page, then activate its renderer as well as the native
// window. Showing an empty BrowserWindow before navigation leaves initial input
// dependent on the window manager's activation order.
export function showAppWindow(window){
 if(window.isDestroyed())return;
 if(window.isMinimized())window.restore();
 window.show();
 window.focus();
 window.webContents.focus();
}
