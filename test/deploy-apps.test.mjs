import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseOptions,validateConfig,guestScript,withBuildVM,snapshotSources} from '../scripts/deploy-apps.mjs';
const config={name:'anydj-win11',host:'192.168.122.100',user:'anydj-build',buildRoot:'C:/AnyDjBuild'};
test('arguments and remote config reject ambiguous or executable inputs',()=>{
 assert.equal(parseOptions(['--reuse-analysis','--dry-run']).reuseAnalysis,true);
 assert.deepEqual(parseOptions(['--dry-run']).deployArgs,['--dry-run']);
 for(const args of [['--vm-config'],['--config','--check'],['--unknown']])assert.throws(()=>parseOptions(args));
 assert.equal(validateConfig(config).port,22);
 for(const change of [{host:'-oProxyCommand=bad'},{user:'user & bad'},{buildRoot:'C:/Build/../private'},{name:'vm;shutdown'},{port:0}])assert.throws(()=>validateConfig({...config,...change}));
});
for(const state of ['shut off','running']){
 for(const fails of [false,true]){
  test(`VM lifecycle: ${state}, build ${fails?'fails':'succeeds'}`,async()=>{
   const calls=[];
   const operation=withBuildVM({state,run:async()=>calls.push('start'),waitReady:async()=>calls.push('ready'),build:async()=>{calls.push('build');if(fails)throw Error('Windows compiler failed');return 'installer';},shutdown:async()=>calls.push('shutdown')});
   if(fails)await assert.rejects(operation,/Windows compiler failed/);else assert.equal(await operation,'installer');
   assert.deepEqual(calls,state==='shut off'?['start','ready','build','shutdown']:['ready','build']);
  });
 }
}
test('SSH readiness failure still shuts down a started VM',async()=>{
 let stopped=false;
 await assert.rejects(withBuildVM({state:'shut off',run:async()=>{},waitReady:async()=>{throw Error('SSH unavailable');},build:async()=>assert.fail(),shutdown:async()=>{stopped=true;}}),/SSH unavailable/);
 assert.equal(stopped,true);
});
test('shutdown failure preserves original Windows build error',async()=>{
 await assert.rejects(withBuildVM({state:'shut off',run:async()=>{},waitReady:async()=>{},build:async()=>{throw Error('compiler error');},shutdown:async()=>{throw Error('shutdown timeout');}}),error=>error instanceof AggregateError&&error.errors.length===2&&/compiler error.*shutdown timeout/.test(error.message));
});
test('guest uses native full release with isolated sources and prepared Windows environments',()=>{
 const script=guestScript(config,'build-123');
 assert.match(script,/npm\.cmd.*ci/);assert.match(script,/release-desktop\.mjs/);assert.match(script,/ItemType Junction/);
 assert.doesNotMatch(script,/--lite|--reuse-analysis/);
 assert.match(guestScript(config,'build-123',{reuseAnalysis:true}),/--reuse-analysis/);
});
test('source snapshot excludes private host directories and rejects symlinks',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'anydj-build-sources-'));
 try{
  const source=join(temp,'source'),dest=join(temp,'dest');await mkdir(source);
  for(const name of ['public','lib','desktop','scripts']){await mkdir(join(source,name));await writeFile(join(source,name,'source.js'),'source');}
  for(const name of ['package.json','package-lock.json','server.mjs'])await writeFile(join(source,name),'source');
  for(const name of ['.env','.aws','private.mp3'])await writeFile(join(source,name),'private');
  await writeFile(join(source,'scripts','.env'),'secret');
  await snapshotSources(source,dest);
  assert.equal(await readFile(join(dest,'scripts','source.js'),'utf8'),'source');
  for(const path of ['.env','.aws','private.mp3','scripts/.env'])await assert.rejects(readFile(join(dest,path)),{code:'ENOENT'});
  await symlink(join(source,'.env'),join(source,'scripts','secret.js'));
  await assert.rejects(snapshotSources(source,dest),/Symlink/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
