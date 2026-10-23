import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configureDesktopGraphics} from '../desktop/graphics.mjs';

test('NVIDIA preference is opt-in, trusted, persisted and applied before GPU startup',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'anydj-graphics-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const switches=[],env={},app={getPath:()=>directory,commandLine:{appendSwitch:(...args)=>switches.push(args)}};
 const graphics=configureDesktopGraphics(app,{argv:[],env,platform:'linux',nvidia:true});assert.deepEqual(switches,[]);
 const handlers=new Map(),mainFrame={url:'http://127.0.0.1:36931/dj'},owner={mainFrame},event={sender:owner,senderFrame:mainFrame};
 graphics.install({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},getWindow:()=>({webContents:owner}),origin:'http://127.0.0.1:36931'});
 await assert.rejects(handlers.get('anydj:graphics-set')({...event,sender:{}},'nvidia'));
 await assert.rejects(handlers.get('anydj:graphics-set')(event,'custom-driver'));
 const saved=await handlers.get('anydj:graphics-set')(event,'nvidia');assert.equal(saved.restartRequired,true);assert.deepEqual(switches,[]);
 assert.deepEqual(JSON.parse(await readFile(join(directory,'graphics.json'),'utf8')),{preference:'nvidia'});
 configureDesktopGraphics(app,{argv:[],env,platform:'linux',nvidia:true});
 assert.deepEqual(switches,[['use-angle','vulkan']]);assert.equal(env.__NV_PRIME_RENDER_OFFLOAD,'1');assert.equal(env.__VK_LAYER_NV_optimus,'NVIDIA_only');assert.equal(env.__GLX_VENDOR_LIBRARY_NAME,undefined);
});
test('high-performance CLI never forces NVIDIA on unsupported systems',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'anydj-graphics-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const switches=[],env={},app={getPath:()=>directory,commandLine:{appendSwitch:(...args)=>switches.push(args)}};
 configureDesktopGraphics(app,{argv:['--high-performance-gpu'],env,platform:'linux',nvidia:false});assert.deepEqual(switches,[]);assert.deepEqual(env,{});
 configureDesktopGraphics(app,{argv:['--high-performance-gpu'],env,platform:'linux',nvidia:true});assert.deepEqual(switches,[['use-angle','vulkan']]);
});

