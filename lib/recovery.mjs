import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SetupClient,pairingPayload} from './setup.mjs';
const execute=promisify(execFile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class AutoRecovery {
  constructor({dataDir,client,onReady,setup=new SetupClient(),run=async args=>(await execute('nmcli',args,{timeout:25000,maxBuffer:65536})).stdout,wait=sleep}) {
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
  async start(mac) {
    if(this.running)return this.status;
    const config=await this.config();
    if(this.running)return this.status;
    if(!config||config.mac.toLowerCase()!==mac?.toLowerCase())return null;
    if(Date.now()<this.retryAfter)return this.status;
    this.status={state:'recovering',message:'Einrichtungsmodus erkannt. WLAN-Verbindung wird automatisch wiederhergestellt.'};
    this.running=this.recover(config).catch(()=>{
      // Do not publish nmcli stderr or exception payloads: they may contain secrets.
      this.status={state:'failed',message:'Automatische WLAN-Wiederverbindung noch nicht bestätigt. Die App prüft weiter; Zugangsdaten werden nach unklarer Übertragung nicht erneut gesendet.'};
      this.retryAfter=Date.now()+120000;
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
  async recover(config) {
    const uuid=randomUUID(),ssid=`WiZConfig_${config.mac.slice(-4)}`,journal=join(this.dataDir,'recovery-pending.json');
    let created=false,previous='';
    try {
      previous=(await this.run(['-g','GENERAL.CON-UUID','device','show',config.interface])).trim();
      if(previous&&previous!=='--') {
        const name=(await this.run(['-g','connection.id','connection','show','uuid',previous])).trim();
        if(name.startsWith('wiz-auto-')){await this.run(['connection','delete','uuid',previous]);previous='';}
      }
      // Temporary AP route must never replace the existing Internet/home route.
      await this.run(['connection','add','type','wifi','ifname',config.interface,'con-name',`wiz-auto-${uuid}`,'connection.uuid',uuid,'ssid',ssid,'connection.autoconnect','no','ipv4.method','auto','ipv4.never-default','yes','ipv6.method','disabled']);created=true;
      await this.run(['--wait','20','connection','up','uuid',uuid]);
      let device=await this.setup.device();
      if(device.mac.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');
      let pending=null;
      try{const saved=JSON.parse(await readFile(journal,'utf8'));if(saved.mac===config.mac)pending=saved;}catch{}
      const pairOnce=async()=>{
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
      for(let round=0;round<2&&device.status!==5;round++) {
        for(let attempt=0;device.status!==5&&attempt<30;attempt++) {
          await this.wait(2000);
          try{device=await this.setup.device();}catch{}
          if(device.mac.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');
        }
        // Only a positively acknowledged request and a fresh idle status allow
        // one bounded retry. An HTTP timeout remains pending across restarts.
        if(round===0&&device.status===0&&pending?.acknowledged&&pending.attempt<2) {
          this.setup.pendingMac=null;
          await pairOnce();
        }else break;
      }
      if(device.status!==5)throw Error('Join not confirmed');
      this.status={state:'recovering',message:'Lampe ist im WLAN. Einrichtung wird abgeschlossen und Steuerung geprüft …'};
      await this.setup.complete(device.mac);
      await writeFile(journal,JSON.stringify({mac:config.mac,completed:true}),{mode:0o600});
      if(created){await this.run(['connection','delete','uuid',uuid]);created=false;}
      if(previous&&previous!=='--'){await this.run(['--wait','20','connection','up','uuid',previous]);previous='';}
      // Some firmware reboots after completion. Verify real UDP reachability,
      // not merely a successful AP provisioning response.
      let info;
      for(let attempt=0;attempt<10;attempt++) {
        try{info=await this.client.inspect(device.ip);if((info.pilot?.mac||info.system?.mac)?.toLowerCase()!==config.mac.toLowerCase())throw Error('Identity mismatch');break;}catch{info=null;await this.wait(2000);}
      }
      if(!info)throw Error('Home network unavailable');
      await this.onReady({ip:device.ip,...info,inspected:true});
      await rm(journal,{force:true});
      this.status={state:'ready',message:'Lampe automatisch wieder mit dem WLAN verbunden und geprüft.',ip:device.ip};
      this.retryAfter=Date.now()+30000;
    } finally {
      if(created)await this.run(['connection','delete','uuid',uuid]).catch(()=>{});
      if(previous&&previous!=='--')await this.run(['--wait','20','connection','up','uuid',previous]).catch(()=>{});
    }
  }
}
