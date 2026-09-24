import {randomBytes,randomInt} from 'node:crypto';
import {AppError} from './wiz.mjs';
const key=()=>randomBytes(18).toString('base64url');
export function createVRPreviewRelay(){
  const sessions=new Map(),attempts=new Map();
  const find=id=>{const value=sessions.get(id);if(!value)throw new AppError('Diese Vorschau ist beendet. Am Rechner einen neuen Link erstellen.',404);return value;};
  const owner=(id,secret)=>{const s=find(id);if(s.owner!==secret)throw new AppError('Vorschau darf nur vom sendenden Fenster geändert werden.',403);return s;};
  function end(id){const s=sessions.get(id);if(!s)return;for(const res of s.clients){res.write('event: ended\ndata: {}\n\n');res.end();}sessions.delete(id);}
  const timer=setInterval(()=>{const now=Date.now();for(const [id,s] of sessions){if(now-s.updated>120000){end(id);continue;}for(const res of s.clients)if(!res.destroyed&&!res.writableNeedDrain)res.write(': keepalive\n\n');}},10000);timer.unref();
  return {
    start(){if(sessions.size>=4)throw new AppError('Maximal vier aktive Vorschauen. Bitte eine bestehende Übertragung beenden.',409);const id=key(),secret=key();let code;do{code=String(randomInt(1000000)).padStart(6,'0');}while([...sessions.values()].some(s=>s.code===code));sessions.set(id,{code,owner:secret,control:key(),commands:[],commandSeq:0,clients:new Set(),latest:null,seq:0,updated:Date.now()});return {id,owner:secret,code};},
    pairTest(){const match=[...sessions].reverse().find(([,s])=>Date.now()-s.updated<120000);if(!match)throw new AppError('Keine aktive VR-Übertragung. Am Rechner „Übertragung starten“ anklicken.',404);return {id:match[0],control:match[1].control};},
    pair(code,peer){const now=Date.now();for(const [key,value] of attempts)if(now-value.time>60000)attempts.delete(key);let entry=attempts.get(peer);if(!entry){if(attempts.size>=128)throw new AppError('Bitte in einer Minute erneut versuchen.',429);entry={time:now,count:0};attempts.set(peer,entry);}if(++entry.count>10)throw new AppError('Zu viele Versuche. Bitte eine Minute warten.',429);
      if(!/^\d{6}$/.test(code||''))throw new AppError('Bitte den sechsstelligen Code eingeben.',400);
      const match=[...sessions].find(([,s])=>s.code===code);if(!match)throw new AppError('Code nicht gefunden. Prüfe, ob die Übertragung am Rechner läuft.',404);return {id:match[0],control:match[1].control};},
    command(id,control,command){const s=find(id);if(s.control!==control)throw new AppError('Bitte die Brille erneut mit dem Zahlencode koppeln.',403);
      if(Date.now()-s.updated>3000)throw new AppError('Der Rechner ist gerade nicht erreichbar.',409);
      if(!command||!['select','playing','seek','rate'].includes(command.action)||!['A','B'].includes(command.deck)||command.action==='playing'&&typeof command.value!=='boolean'||['seek','rate'].includes(command.action)&&(!Number.isFinite(command.value)||Math.abs(command.value)>86400))throw new AppError('Ungültiger VR-Befehl.',400);
      s.commands=s.commands.filter(c=>Date.now()-c.time<3000);if(s.commands.length>=20)throw new AppError('Bitte kurz auf den Rechner warten.',429);
      const item={id:++s.commandSeq,time:Date.now(),action:command.action,deck:command.deck,...(command.value===undefined?{}:{value:command.value})};s.commands.push(item);return {queued:item.id};},
    publish(id,secret,snapshot,ack=[]){const s=owner(id,secret);
      if(!snapshot||typeof snapshot!=='object'||!snapshot.layout||!Array.isArray(snapshot.lights)||snapshot.lights.length>2048||!Array.isArray(snapshot.crowd)||snapshot.crowd.length>12)throw new AppError('Ungültige VR-Szene.',400);
      const finite=v=>Number.isFinite(v)&&Math.abs(v)<=10000;
      if(![snapshot.layout.width,snapshot.layout.depth].every(v=>finite(v)&&v>=2&&v<=60)||!snapshot.layout.positions||typeof snapshot.layout.positions!=='object'||Object.values(snapshot.layout.positions).some(p=>!p||![p.x,p.y,p.height].every(finite))||!snapshot.origin||![snapshot.origin.x,snapshot.origin.y,snapshot.origin.yaw,snapshot.origin.eyeHeight].every(finite)||snapshot.lights.some(l=>!l||![l.position?.x,l.position?.y,l.position?.height,l.target?.x,l.target?.y,l.power].every(finite)||typeof l.color!=='string'||l.color.length>80)||snapshot.crowd.some(p=>!p||![p.x,p.y].every(finite)))throw new AppError('VR-Szene enthält ungültige Geometrie.',400);
      const data=JSON.stringify({seq:++s.seq,scene:snapshot});if(data.length>1048576)throw new AppError('VR-Szene zu groß.',413);
      s.latest=data;s.updated=Date.now();for(const res of s.clients){if(res.destroyed||res.writableLength>1048576){res.destroy();s.clients.delete(res);}else if(!res.writableNeedDrain)res.write(`data: ${data}\n\n`);}s.commands=s.commands.filter(c=>Date.now()-c.time<3000&&!(Array.isArray(ack)&&ack.includes(c.id)));return {viewers:s.clients.size,commands:s.commands};},
    stream(id,req,res){const s=find(id);if(s.clients.size>=4)throw new AppError('Diese Vorschau hat bereits vier Zuschauer.',429);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 1500\n\n');if(s.latest)res.write(`data: ${s.latest}\n\n`);s.clients.add(res);res.on('close',()=>s.clients.delete(res));},
    stop(id,secret){owner(id,secret);end(id);},
    close(){clearInterval(timer);for(const id of sessions.keys())end(id);},
  };
}
