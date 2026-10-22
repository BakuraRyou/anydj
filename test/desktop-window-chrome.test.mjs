import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installWindowChrome,showAppWindow} from '../desktop/window-chrome.mjs';

function fixture(){
 const window=new EventEmitter(),ipc=new EventEmitter(),calls=[];
 const mainFrame={url:'http://127.0.0.1:36931/dj'};
 window.webContents={mainFrame,send:(...args)=>calls.push(args)};
 Object.assign(window,{isMaximized:()=>false,isFullScreen:()=>false,isFocused:()=>true,isDestroyed:()=>false,
  minimize:()=>calls.push('minimize'),maximize:()=>calls.push('maximize'),unmaximize:()=>calls.push('restore'),close:()=>calls.push('close')});
 ipc.handle=(_channel,handler)=>{ipc.readState=handler;};
 ipc.removeHandler=()=>{ipc.readState=null;};
 installWindowChrome(window,ipc,'http://127.0.0.1:36931');
 return {window,ipc,calls,event:{sender:window.webContents,senderFrame:mainFrame}};
}
test('window controls reject other windows, frames, origins and unsupported commands',()=>{
 const {window,ipc,calls,event}=fixture();
 for(const bad of [{...event,sender:{}},{...event,senderFrame:{...event.senderFrame}}]){
  ipc.emit('anydj:window-action',bad,'close');assert.equal(ipc.readState(bad),null);
 }
 window.webContents.mainFrame.url='https://example.com/';
 ipc.emit('anydj:window-action',event,'close');assert.equal(ipc.readState(event),null);
 window.webContents.mainFrame.url='http://127.0.0.1:36931/dj';
 ipc.emit('anydj:window-action',event,'quit');
 assert.deepEqual(calls,[]);
});
test('controls preserve restore and normal close behavior; listeners are released',()=>{
 const {window,ipc,calls,event}=fixture();
 ipc.emit('anydj:window-action',event,'minimize');
 ipc.emit('anydj:window-action',event,'maximize');
 window.isMaximized=()=>true;
 ipc.emit('anydj:window-action',event,'maximize');
 window.isFullScreen=()=>true;
 ipc.emit('anydj:window-action',event,'maximize');
 ipc.emit('anydj:window-action',event,'close');
 assert.deepEqual(calls,['minimize','maximize','restore','close']);
 window.emit('enter-full-screen');
 assert.equal(calls.at(-1)[1].fullscreen,true);
 window.emit('closed');
 assert.equal(ipc.listenerCount('anydj:window-action'),0);
 assert.equal(ipc.readState,null);
 assert.equal(window.listenerCount('focus'),0);
});

test('initial activation gives focus to the rendered page after showing the native window',()=>{
 const calls=[];
 const window={isDestroyed:()=>false,isMinimized:()=>false,show:()=>calls.push('show'),focus:()=>calls.push('window-focus'),webContents:{focus:()=>calls.push('renderer-focus')}};
 showAppWindow(window);
 assert.deepEqual(calls,['show','window-focus','renderer-focus']);
 calls.length=0;window.isMinimized=()=>true;window.restore=()=>calls.push('restore');
 showAppWindow(window);
 assert.deepEqual(calls,['restore','show','window-focus','renderer-focus']);
 calls.length=0;window.isDestroyed=()=>true;showAppWindow(window);assert.deepEqual(calls,[]);
});
