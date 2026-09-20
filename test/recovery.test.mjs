import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AutoRecovery} from '../lib/recovery.mjs';
const mac='a8bb5074d27c';
async function fixture(t,overrides={}){
 const dataDir=await mkdtemp(join(tmpdir(),'wiz-recovery-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));
 let joined=false,pairs=0,ready;
 const commands=[];
 const setup={device:async()=>({mac,status:joined?5:0,ip:joined?'192.168.178.53':undefined}),pair:async()=>{pairs++;joined=true;},complete:async()=>({completed:true})};
 Object.assign(setup,overrides);
 const recovery=new AutoRecovery({dataDir,setup,client:{inspect:async()=>({pilot:{mac,state:true}})},run:async args=>{commands.push(args);return args.includes('GENERAL.CON-UUID')?'--':'';},wait:async()=>{},onReady:async value=>{ready=value;}});
 await recovery.configure({enabled:true,mac,ssid:'TestHome',password:'test-password',interface:'wlo1'});
 return {recovery,dataDir,commands,get pairs(){return pairs;},get ready(){return ready;}};
}
test('Automatik prüft Identität, richtet einmal ein, bestätigt UDP und entfernt temporäres WLAN',async t=>{
 const f=await fixture(t);assert.equal((await stat(join(f.dataDir,'recovery.json'))).mode&0o777,0o600);
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(f.recovery.status.state,'ready');assert.equal(f.pairs,1);assert.equal(f.ready.ip,'192.168.178.53');
 assert.ok(f.commands.some(a=>a.includes('ipv4.never-default')));assert.ok(f.commands.some(a=>a.includes('delete')));
 await assert.rejects(readFile(join(f.dataDir,'recovery-pending.json')));
});
test('Fremde MAC erhält keine Zugangsdaten und die AP-Verbindung wird aufgeräumt',async t=>{
 const f=await fixture(t,{device:async()=>({mac:'112233445566',status:0})});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(f.pairs,0);assert.equal(f.recovery.status.state,'failed');assert.ok(f.commands.some(a=>a.includes('delete')));
});
test('Unklare Übertragung wird auch beim nächsten Versuch nicht erneut gesendet',async t=>{
 let writes=0;
 const f=await fixture(t,{pair:async()=>{writes++;throw Object.assign(Error('secret must not escape'),{code:'SETUP_TIMEOUT'});}});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,1);f.recovery.retryAfter=0;
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,1);assert.ok(!JSON.stringify(f.recovery.status).includes('secret'));
});
test('Nicht konfigurierte oder andere Lampe startet keine Netzumschaltung',async t=>{
 const f=await fixture(t);assert.equal(await f.recovery.start('112233445566'),null);
 await f.recovery.configure({enabled:false});assert.equal(await f.recovery.start(mac),null);assert.equal(f.commands.length,0);
});

test('Bestätigter Auftrag ohne Beitritt wird genau einmal wiederholt',async t=>{
 let writes=0;
 const f=await fixture(t,{pair:async()=>{writes++;},device:async()=>({mac,status:writes>=2?5:0,ip:'192.168.178.53'})});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,2);assert.equal(f.recovery.status.state,'ready');
});
test('Gleichzeitige Aufrufe starten nur einen Einrichtungsauftrag',async t=>{
 const f=await fixture(t);
 await Promise.all([f.recovery.start(mac),f.recovery.start(mac)]);await f.recovery.running;
 assert.equal(f.pairs,1);assert.equal(f.commands.filter(a=>a.includes('add')).length,1);
});

test('Bereits im Heimnetz erreichbarer Beitritt wird vor Journal-Löschung abgeschlossen',async t=>{
 let completed=0;
 const f=await fixture(t,{pair:async()=>{throw Object.assign(Error('timeout'),{code:'SETUP_TIMEOUT'});},complete:async()=>{completed++;}});
 await f.recovery.start(mac);await f.recovery.running;
 await f.recovery.observeReady({ip:'192.168.178.53',pilot:{mac,state:true}});
 assert.equal(completed,1);assert.equal(f.recovery.status.state,'ready');
 await assert.rejects(readFile(join(f.dataDir,'recovery-pending.json')));
});
