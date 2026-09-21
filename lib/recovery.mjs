import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SetupClient,pairingPayload} from './setup.mjs';
const execute=promisify(execFile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class AutoRecovery {
  constructor({dataDir,client,onReady,setup=new SetupClient(),run=async args=>(await execute('nmcli',args,{timeout:65000,maxBuffer:65536})).stdout,wait=sleep}) {
    Object.assign(this,{dataDir,client,onReady,setup,run,wait});
    this.running=null;this.status={state:'idle'};this.retryAfter=0;
  }
  async config() {
    try {
      const c=JSON.parse(await readFile(join(this.dataDir,'recovery.json'),'utf8'));
      if(!c.enabled)return null;
      pairingPayload(c.ssid,c.password);
      if(!/^[a-f0-9]{12}$/i.test(c.mac)||!/^[-a-zA-Z0-9_.]{1,30}$/.test(c.interface))return null;
      return c;
    }catch{return null;}
  }
  async configure(c) {
    if(this.running)throw Error('Wiederverbindung läuft bereits.');
    if(c.enabled!==false){pairingPayload(c.ssid,c.password);if(!/^[a-f0-9]{12}$/i.test(c.mac)||!/^[-a-zA-Z0-9_.]{1,30}$/.test(c.interface))throw Error('Ungültige Wiederverbindungs-Konfiguration.');}
    await mkdir(this.dataDir,{recursive:true,mode:0o700});
    const path=join(this.dataDir,'recovery.json');
    await writeFile(path+'.tmp',JSON.stringify(c.enabled===false?{enabled:false}:{enabled:true,ssid:c.ssid,password:c.password,mac:c.mac.toLowerCase(),interface:c.interface}),{mode:0o600});
    await rename(path+'.tmp',path);this.retryAfter=0;
    return {enabled:c.enabled!==false};
  }
  async resumeHome(mac, homeIP) {
    if(this.running)return this.status;
    const config=await this.config();
    if(this.running)return this.status;
    if(!config||config.mac.toLowerCase()!==mac?.toLowerCase()||Date.now()<this.retryAfter)return null;
    this.setup.homeIP=homeIP;this.setup.joined=true;
    let device;
    try{device=await this.setup.device();}catch{return null;}
    if(device.mac.toLowerCase()!==config.mac.toLowerCase()||device.status!==5||!device.ip)return null;
    return this.start(mac, homeIP, device);
  }
  async start(mac, homeIP = null, joinedDevice = null) {
    if(this.running)return this.status;
    const config=await this.config();
    if(this.running)return this.status;
    if(!config||config.mac.toLowerCase()!==mac?.toLowerCase())return null;
    if(Date.now()<this.retryAfter)return this.status;
    this.phase='connect';
    this.status={state:'recovering',message:'Einrichtungsmodus erkannt. WLAN-Verbindung wird automatisch wiederhergestellt.'};
    this.running=this.recover(config, homeIP, joinedDevice).catch(()=>{
      // Do not publish nmcli stderr or exception payloads: they may contain secrets.
      this.retryAfter=Date.now()+120000;
      const messages={
        connect:'Verbindung zum Einrichtungs-WLAN der Lampe fehlgeschlagen. Es wurden in diesem Schritt keine WLAN-Zugangsdaten übertragen.',
        identify:'Die Identität der Lampe konnte nicht bestätigt werden. Die Einrichtung wurde angehalten.',
        pairing:'Die Übertragung der WLAN-Einrichtung wurde nicht bestätigt. Die App prüft den Gerätestatus vor einem erneuten Versuch.',
        joining:'Die Lampe hat den Beitritt zum Heimnetz nicht bestätigt.',
        complete:'Der Abschluss der WLAN-Einrichtung wurde nicht bestätigt.',
        restore:'Die vorherige Netzwerkverbindung konnte nicht wiederhergestellt werden.',
        udp:'Die Einrichtung wurde abgeschlossen, aber die UDP-Steuerung antwortet noch nicht.'
      };
      this.status={state:'failed',phase:this.phase,retryAt:new Date(this.retryAfter).toISOString(),
        message:(messages[this.phase]||'Automatische Wiederverbindung fehlgeschlagen.')+' Die App versucht es nach zwei Minuten erneut.'};
    }).finally(()=>{this.running=null;});
    return this.status;
  }
  async observeReady(record) {
    if(this.running)return;
    const config=await this.config();
    const actual=record.pilot?.mac||record.system?.mac;
    if(!config||actual?.toLowerCase()!==config.mac.toLowerCase())return;
    this.setup.homeIP=record.ip;
    let pending;
    try{pending=JSON.parse(await readFile(join(this.dataDir,'recovery-pending.json'),'utf8'));}catch{}
    if(pending?.mac===config.mac&&!pending.completed) {
      // UDP can work before provisioning is committed. Finish the pending
      // setup over its verified home address before clearing the journal.
      try{await this.setup.complete(config.mac);}catch{return;}
    }
    await rm(join(this.dataDir,'recovery-pending.json'),{force:true});
    this.setup.pendingMac=null;
    this.status={state:'ready',message:'Lampe im Heimnetz erreichbar. Automatische Wiederverbindung ist aktiv.',ip:record.ip};
    this.retryAfter=0;
  }
  async finishRecovery(config, device, restore = async()=>{}) {
    const journal=join(this.dataDir,'recovery-pending.json');
    this.phase='complete';
    this.status={state:'recovering',message:'Lampe ist im WLAN. Einrichtung wird abgeschlossen und Steuerung geprüft …'};
    this.setup.homeIP=device.ip;this.setup.joined=true;
    await this.wait(2000);
    await this.setup.complete(device.mac);
    await writeFile(journal,JSON.stringify({mac:config.mac,completed:true}),{mode:0o600});
    this.phase='restore';await restore();
    this.phase='udp';
    let info;
    for(let attempt=0;attempt<10;attempt++) {
      try{info=await this.client.inspect(device.ip);if((info.pilot?.mac||info.system?.mac)?.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');break;}
      catch{info=null;await this.wait(2000);}
    }
    if(!info)throw Error('Home network unavailable');
    await this.onReady({ip:device.ip,...info,inspected:true});
    await rm(journal,{force:true});
    this.status={state:'ready',message:'Lampe automatisch wieder mit dem WLAN verbunden und geprüft.',ip:device.ip};
    this.retryAfter=Date.now()+30000;
  }
  async recover(config, homeIP = null, joinedDevice = null) {
    if(joinedDevice){await this.finishRecovery(config,joinedDevice);return;}
    const uuid=randomUUID(),ssid=`AnyDjConfig_${config.mac.slice(-4)}`,journal=join(this.dataDir,'recovery-pending.json');
    let created=false,previous='';
    try {
      // Resume using both addresses, as in the successful manual procedure.
      // The AP can disappear before it reports status 5. Identity is checked
      // again before any write; a saved home address is only a read candidate.
      this.setup.homeIP=homeIP;
      this.setup.joined=false;
      this.setup.pendingMac=null;
      previous=(await this.run(['-g','GENERAL.CON-UUID','device','show',config.interface])).trim();
      if(previous&&previous!=='--') {
        const name=(await this.run(['-g','connection.id','connection','show','uuid',previous])).trim();
        if(name.startsWith('wiz-auto-')){await this.run(['connection','delete','uuid',previous]);previous='';}
      }
      // Temporary AP route must never replace the existing Internet/home route.
      await this.run(['connection','add','type','wifi','ifname',config.interface,'con-name',`wiz-auto-${uuid}`,'connection.uuid',uuid,'ssid',ssid,'connection.autoconnect','no','ipv4.method','auto','ipv4.never-default','yes','ipv6.method','disabled']);created=true;
      this.status={state:'recovering',message:'Verbindung zum Lampen-WLAN wird aufgebaut. Warte auf die Netzwerkadresse …'};
      await this.run(['--wait','60','connection','up','uuid',uuid]);
      this.phase='identify';
      let device=await this.setup.device();
      if(device.mac.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');
      this.status={state:'recovering',message:'Lampe identifiziert. WLAN-Beitritt wird geprüft …'};
      let pending=null;
      try{const saved=JSON.parse(await readFile(journal,'utf8'));if(saved.mac===config.mac)pending=saved;}catch{}
      // A completed earlier setup must not block the next power cycle.
      if(pending?.completed&&device.status===0){pending=null;this.setup.pendingMac=null;}
      const pairOnce=async()=>{
        this.phase='pairing';
        pending={mac:config.mac,started:new Date().toISOString(),attempt:(pending?.attempt??0)+1,acknowledged:false};
        await writeFile(journal,JSON.stringify(pending),{mode:0o600});
        this.status={state:'recovering',message:'Lampe identifiziert. WLAN-Zugang wird eingerichtet …'};
        try {
          await this.setup.pair(config);
          pending.acknowledged=true;
          await writeFile(journal,JSON.stringify(pending),{mode:0o600});
        }catch(error){if(error.code!=='SETUP_TIMEOUT')throw error;}
      };
      if(device.status!==5&&!pending)await pairOnce();
      this.phase='joining';
      for(let round=0;round<2&&device.status!==5;round++) {
        let idleReadings=0;
        for(let attempt=0;device.status!==5&&attempt<30;attempt++) {
          await this.wait(2000);
          try{device=await this.setup.device();idleReadings=device.status===0?idleReadings+1:0;}
          catch{idleReadings=0;}
          if(device.mac.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');
        }
        // After the full join window, repeated fresh idle responses establish
        // that the lamp did not join, even if the pairing HTTP response was lost.
        // Stale status or failed reads never authorize another credential write.
        // Each recovery run permits one retry; the cooldown between failed
        // runs prevents flooding without permanently locking out this lamp.
        if(round===0&&idleReadings>=3&&pending) {
          this.phase='connect';
          this.status={state:'recovering',message:'WLAN-Beitritt ausgeblieben. Lampen-WLAN wird für einen neuen Versuch frisch verbunden …'};
          await this.run(['connection','down','uuid',uuid]);
          await this.run(['--wait','60','connection','up','uuid',uuid]);
          this.phase='identify';
          device=await this.setup.device();
          if(device.mac.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');
          if(device.status===5)break;
          if(device.status!==0)continue;
          this.setup.pendingMac=null;
          await pairOnce();
          this.phase='joining';
        }else break;
      }
      if(device.status!==5)throw Error('Join not confirmed');
      await this.finishRecovery(config,device,async()=>{
        if(created){await this.run(['connection','delete','uuid',uuid]);created=false;}
        if(previous&&previous!=='--'){await this.run(['--wait','20','connection','up','uuid',previous]);previous='';}
      });
    } finally {
      if(created)await this.run(['connection','delete','uuid',uuid]).catch(()=>{});
      if(previous&&previous!=='--')await this.run(['--wait','20','connection','up','uuid',previous]).catch(()=>{});
    }
  }
}
