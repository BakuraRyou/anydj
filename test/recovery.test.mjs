import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AutoRecovery} from '../lib/recovery.mjs';
import {SetupClient} from '../lib/setup.mjs';
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
 assert.ok(f.commands.some(a=>a[0]==='--wait'&&a[1]==='60'&&a.includes('up')));
 await assert.rejects(readFile(join(f.dataDir,'recovery-pending.json')));
});
test('Fremde MAC erhält keine Zugangsdaten und die AP-Verbindung wird aufgeräumt',async t=>{
 const f=await fixture(t,{device:async()=>({mac:'112233445566',status:0})});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(f.pairs,0);assert.equal(f.recovery.status.state,'failed');assert.ok(f.commands.some(a=>a.includes('delete')));
});

test('Nicht erreichbares Lampen-WLAN wird vor Pairing als Verbindungsfehler gemeldet',async t=>{
 const f=await fixture(t);const run=f.recovery.run;
 f.recovery.run=async args=>{if(args.includes('up'))throw Error('private diagnostic');return run(args);};
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(f.pairs,0);assert.equal(f.recovery.status.phase,'connect');
 assert.ok(Date.parse(f.recovery.status.retryAt)>Date.now());
 assert.equal(JSON.stringify(f.recovery.status).includes('private diagnostic'),false);
});

test('Erneuter Einrichtungsmodus nach erfolgreichem Pairing startet einen neuen vollständigen Ablauf',async t=>{
 let joined=false,pairs=0,completed=0;
 const f=await fixture(t,{
  device:async()=>({mac,status:joined?5:0,ip:joined?'192.168.178.53':undefined}),
  pair:async()=>{pairs++;joined=true;},complete:async()=>{completed++;}
 });
 for(let cycle=0;cycle<3;cycle++){
  joined=false;f.recovery.retryAfter=0;
  await f.recovery.start(mac);await f.recovery.running;
  assert.equal(f.recovery.status.state,'ready');
 }
 assert.equal(pairs,3);assert.equal(completed,3);
 assert.equal(f.commands.filter(a=>a.includes('delete')).length,3);
});
test('Unklare Übertragung ohne frischen Status wird auch beim nächsten Versuch nicht erneut gesendet',async t=>{
 let writes=0;
 let reads=0;
 const f=await fixture(t,{device:async()=>{if(reads++%31!==0)throw Error('offline');return {mac,status:0};},pair:async()=>{writes++;throw Object.assign(Error('secret must not escape'),{code:'SETUP_TIMEOUT'});}});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,1);f.recovery.retryAfter=0;
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,1);assert.ok(!JSON.stringify(f.recovery.status).includes('secret'));
});

test('Timeout mit wiederholt frisch bestätigtem Leerlauf erlaubt genau einen neuen Versuch',async t=>{
 let writes=0;
 const f=await fixture(t,{pair:async()=>{writes++;if(writes===1)throw Object.assign(Error('timeout'),{code:'SETUP_TIMEOUT'});},
  device:async()=>({mac,status:writes>=2?5:0,ip:'192.168.178.53'})});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,2);assert.equal(f.recovery.status.state,'ready');
});
test('Nicht konfigurierte oder andere Lampe startet keine Netzumschaltung',async t=>{
 const f=await fixture(t);assert.equal(await f.recovery.start('112233445566'),null);
 await f.recovery.configure({enabled:false});assert.equal(await f.recovery.start(mac),null);assert.equal(f.commands.length,0);
});

test('Gescheiterte Versuche sperren nach Abkühlzeit und frischer Leerlaufprüfung nicht dauerhaft',async t=>{
 let writes=0;
 const f=await fixture(t,{pair:async()=>{writes++;},device:async()=>({mac,status:writes>=3?5:0,ip:'192.168.178.53'})});
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,2);assert.equal(f.recovery.status.state,'failed');
 await f.recovery.start(mac);assert.equal(f.recovery.running,null);assert.equal(writes,2);
 f.recovery.retryAfter=0;
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,3);assert.equal(f.recovery.status.state,'ready');
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

test('Verlorene Status-5-Antwort am AP: bekannte Heimnetz-IP ermöglicht Abschluss und UDP',async t=>{
 const f=await fixture(t);let joined=false,completed=false;const writes=[];
 f.recovery.setup=new SetupClient({interfaces:()=>[
  {address:'192.168.56.100',network:'192.168.56.0',netmask:'255.255.255.0'},
  {address:'192.168.178.28',network:'192.168.178.0',netmask:'255.255.255.0'}
 ],fetcher:async(url,options)=>{
  const ap=url.startsWith('http://192.168.56.1');
  if(ap&&joined)throw Error('AP disappeared');
  if(url.endsWith('/device'))return Response.json({mac,name:'ESP03_SHRGB1C_01',fw:'1.32.0',status:joined?5:0,...(joined?{ip:'192.168.178.53'}:{})});
  writes.push(url);
  if(url.endsWith('/pairing')){joined=true;throw Error('response lost');}
  if(url.endsWith('/complete')){assert.equal(ap,false);completed=true;return new Response(null,{status:200});}
  throw Error('Unexpected request');
 }});
 f.recovery.client.inspect=async()=>{assert.equal(completed,true);return {pilot:{mac,state:true}};};
 await f.recovery.start(mac,'192.168.178.53');await f.recovery.running;
 assert.equal(f.recovery.status.state,'ready');
 assert.deepEqual(writes,['http://192.168.56.1/pairing','http://192.168.178.53/complete']);
});

test('Wiederholung verbindet das Lampen-WLAN neu und prüft die MAC vor erneutem Senden',async t=>{
 let writes=0,reconnected=false;
 const f=await fixture(t,{pair:async()=>{writes++;},device:async()=>({mac:reconnected?'112233445566':mac,status:0})});
 const run=f.recovery.run;
 f.recovery.run=async args=>{if(args.includes('down'))reconnected=true;return run(args);};
 await f.recovery.start(mac);await f.recovery.running;
 assert.equal(writes,1);assert.equal(f.recovery.status.state,'failed');
 const down=f.commands.findIndex(a=>a.includes('down'));
 assert.ok(down>=0);assert.ok(f.commands[down+1].includes('up'));
});

test('Ohne AP und UDP wird ein bestätigter HTTP-Heimnetz-Beitritt automatisch abgeschlossen',async t=>{
 let completed=0;
 const f=await fixture(t,{device:async()=>({mac,status:5,ip:'192.168.178.53'}),complete:async()=>{completed++;}});
 f.recovery.client.inspect=async()=>{assert.equal(completed,1);return {pilot:{mac,state:true}};};
 await f.recovery.resumeHome(mac,'192.168.178.53');await f.recovery.running;
 assert.equal(f.recovery.status.state,'ready');assert.equal(f.pairs,0);
 assert.equal(f.commands.length,0);assert.equal(completed,1);
});

test('Fremdes Gerät an der gespeicherten Heimnetz-IP erhält keinen Abschluss',async t=>{
 let completed=0;
 const f=await fixture(t,{device:async()=>({mac:'112233445566',status:5,ip:'192.168.178.53'}),complete:async()=>{completed++;}});
 assert.equal(await f.recovery.resumeHome(mac,'192.168.178.53'),null);
 assert.equal(completed,0);assert.equal(f.commands.length,0);
});
