import {randomBytes} from 'node:crypto';
import {AppError} from './wiz.mjs';

export function dmxFrame(value){
  if(!Array.isArray(value)||value.length!==512||value.some(v=>!Number.isInteger(v)||v<0||v>255))throw new AppError('DMX benötigt genau 512 Kanalwerte von 0 bis 255.');
  return Uint8Array.from(value);
}
const networkPort=p=>/art.?net|sacn|e1[. -]?31|show.?net|esp.?net|kinet/i.test(`${p.device} ${p.description}`);
// The API stays on loopback: browser input never controls a server-side URL.
export class OlaTransport {
  constructor({base='http://127.0.0.1:9090',fetcher=fetch}={}){this.base=base;this.fetcher=fetcher;}
  async request(path,body){
    const res=await this.fetcher(this.base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(1200),...(body?{headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)}:{})});
    if(!res.ok)throw Error(`OLA antwortet mit HTTP ${res.status}.`);
    const text=await res.text();if(text.length>2e6)throw Error('OLA-Antwort zu groß.');
    let result;try{result=JSON.parse(text);}catch{if(text.trim()==='ok')return {ok:true};throw Error('Unerwartete OLA-Antwort.');}
    if(result?.ok===false||result?.error)throw Error(String(result.message||result.error||'OLA hat die Anfrage abgelehnt.'));
    return result;
  }
  async scan(){
    const [available,list]=await Promise.all([this.request('/json/get_ports'),this.request('/json/universe_plugin_list')]);
    if(!Array.isArray(available)||!Array.isArray(list.universes)||list.universes.length>128)throw Error('OLA-Geräteliste ist ungültig oder zu groß.');
    const universes=[];
    // Small batches avoid monopolizing the daemon when it has many universes.
    for(let i=0;i<list.universes.length;i+=8)universes.push(...await Promise.all(list.universes.slice(i,i+8).map(u=>{
      if(!Number.isInteger(u.id)||u.id<0)throw Error('Ungültiges OLA-Universum.');
      return this.request(`/json/universe_info?id=${u.id}`);
    })));
    const ports=new Map();
    const add=(p,u=null)=>{
      if(p.is_output!==true||typeof p.id!=='string'||!/^\d+-O-\d+$/.test(p.id))return;
      const exclusive=!u||u.output_ports?.length===1&&!u.input_ports?.length;
      ports.set(p.id,{id:`ola:${p.id}`,port:p.id,name:String(p.device||'OLA-Ausgang').slice(0,120),description:String(p.description||'').slice(0,160),kind:networkPort(p)?'lan':'usb',universe:u?.id??null,ready:exclusive,
        reason:exclusive?'': 'Dieses OLA-Universum enthält weitere Ein-/Ausgänge. Bitte einen separaten Ausgang in OLA zuordnen.'});
    };
    for(const p of available)add(p);
    for(const u of universes){if(!Array.isArray(u.output_ports)||!Array.isArray(u.input_ports))throw Error('OLA-Portliste ist ungültig.');for(const p of u.output_ports)add(p,u);}
    return {ports:[...ports.values()],universes};
  }
  async prepare(port,snapshot){
    if(port.universe!==null)return port.universe;
    const used=new Set(snapshot.universes.map(u=>u.id));let universe=100;
    while(used.has(universe))universe++;
    await this.request('/new_universe',{id:String(universe),name:'AnyDj',add_ports:port.port});
    const info=await this.request(`/json/universe_info?id=${universe}`);
    if(info.input_ports?.length||info.output_ports?.length!==1||info.output_ports[0].id!==port.port)throw Error('OLA-Ausgang konnte nicht eindeutig zugeordnet werden.');
    return universe;
  }
  async send(universe,frame){await this.request('/set_dmx',{u:String(universe),d:Array.from(frame).join(',')});}
}

export class DmxConnection {
  constructor({transport=new OlaTransport(),demo=false,pollMs=2500,leaseMs=1800,clock=Date.now}={}){
    this.transport=transport;this.demo=demo;this.pollMs=pollMs;this.leaseMs=leaseMs;this.clock=clock;
    this.ports=new Map();this.session=null;this.snapshot=null;this.available=false;this.error='';this.lastOutputError='';this.lock=Promise.resolve();this.closed=false;
  }
  startMonitoring(){
    if(this.demo||this.pollTimer||this.closed)return;
    void this.scan();this.pollTimer=setInterval(()=>void this.scan(),this.pollMs);this.pollTimer.unref?.();
    this.tickTimer=setInterval(()=>void this.tick(),50);this.tickTimer.unref?.();
  }
  async scan(){
    if(this.demo||this.closed)return this.status();
    if(this.scanning)return this.scanning;
    this.scanning=(async()=>{
      try{
        const snapshot=await this.transport.scan();if(this.closed)return this.status();
        this.snapshot=snapshot;this.available=true;this.error='';const now=this.clock(),ids=new Set();
        for(const p of snapshot.ports){ids.add(p.id);this.ports.set(p.id,{...p,online:true,lastSeen:now});}
        for(const [id,p] of this.ports)if(!ids.has(id))p.online=false;
        while(this.ports.size>256){const key=[...this.ports].find(([,p])=>!p.online)?.[0];if(!key)break;this.ports.delete(key);}
      }catch{this.available=false;this.snapshot=null;this.error='OLA-Dienst nicht erreichbar oder inkompatibel. Lokalen Dienst auf Port 9090 und USB-Treiber prüfen.';for(const p of this.ports.values())p.online=false;}
      const s=this.session,p=s&&this.ports.get(s.target);
      if(s&&(!p?.online||!p.ready||p.name!==s.name||p.description!==s.description||p.universe!==s.universe))void this.stopInternal('DMX-Schnittstelle getrennt oder Zuordnung geändert. Ausgabe erneut einschalten.');
      return this.status();
    })().finally(()=>{this.scanning=null;});return this.scanning;
  }
  status(){return {demo:this.demo,available:this.available,error:this.error,outputError:this.lastOutputError,outputs:[...this.ports.values()],active:Boolean(this.session&&!this.session.stopping),target:this.session?.target||null,sent:this.session?.sent||0};}
  exclusive(task){const result=this.lock.then(task);this.lock=result.catch(()=>{});return result;}
  async enable(target){return this.exclusive(async()=>{
    if(this.demo)throw new AppError('Echte DMX-Ausgabe ist im Demo-Modus deaktiviert.',409);
    if(this.closed)throw new AppError('DMX-Dienst wurde beendet.',409);
    if(this.session)throw new AppError('Eine DMX-Ausgabe läuft bereits. Zuerst ausschalten.',409);
    await this.scan();const p=this.ports.get(target);
    if(!p?.online||!p.ready)throw new AppError(p?.reason||'DMX-Ausgang ist nicht verfügbar.',409);
    let universe;
    try {
      universe=await this.transport.prepare(p,this.snapshot);
      // Do not show an active session until a complete black frame was accepted.
      await this.transport.send(universe,new Uint8Array(512));
    } catch {throw new AppError('OLA-Ausgabe konnte nicht gestartet werden. Dienst und Ausgangszuordnung prüfen.',503);}
    if(this.closed)throw new AppError('DMX-Dienst wurde beendet.',409);
    p.universe=universe;
    this.session={id:randomBytes(20).toString('hex'),target:p.id,name:p.name,description:p.description,universe,frame:new Uint8Array(512),touched:this.clock(),sent:0};this.lastOutputError='';
    return {id:this.session.id,...this.status()};
  });}
  frame(id,channels){
    const s=this.session;if(!s||s.id!==id||s.stopping)throw new AppError('DMX-Ausgabe ist nicht mehr aktiv.',409);
    s.frame=dmxFrame(channels);s.touched=this.clock();
  }
  async tick(){
    const s=this.session;if(!s||s.stopping)return;
    if(this.clock()-s.touched>this.leaseMs){void this.stopInternal('Keine Wiedergabedaten. DMX-Ausgabe ausgeschaltet.');return;}
    if(s.inFlight)return;
    s.inFlight=this.transport.send(s.universe,s.frame).then(()=>{s.sent++;}).catch(()=>{
      void this.stopInternal('DMX-Übertragung fehlgeschlagen. Ausgabe erneut einschalten.');
    }).finally(()=>{s.inFlight=null;});await s.inFlight;
  }
  stop(id){if(!this.session)return Promise.resolve(this.status());if(this.session.id!==id)throw new AppError('Diese DMX-Ausgabe gehört zu einer anderen Sitzung.',409);return this.stopInternal('');}
  stopInternal(reason){
    const s=this.session;if(!s)return Promise.resolve(this.status());
    if(s.stopPromise)return s.stopPromise;s.stopping=true;
    s.stopPromise=(async()=>{
      await s.inFlight;
      try{await this.transport.send(s.universe,new Uint8Array(512));this.lastOutputError=reason;}
      catch{this.lastOutputError=`${reason} Abschaltbild konnte nicht übertragen werden.`.trim();}
      if(this.session===s)this.session=null;return this.status();
    })();return s.stopPromise;
  }
  async close(){this.closed=true;clearInterval(this.pollTimer);clearInterval(this.tickTimer);await this.lock;await this.stopInternal('');}
}
