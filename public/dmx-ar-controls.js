import {createVRConsole,panelHit} from './dmx-vr-console.js';
import {deviceName,planningDevice,roomFixtureHit,area,alignedOrigin,detectedRoomSurfaces,floorRay,insideRoom,roomFromFloor,xrToRoom,applyRoomPlan} from './dmx-ar-model.js';

const anchorKey=id=>'anydj-ar-anchor-'+id;
export function createARControls({planner,session,reference,floorAvailable,exit,command}) {
  const base=createVRConsole({command,exit,locomotion:false});
  let overlay=null,scene=null,origin={x:0,y:0,yaw:0,floorOffset:0,eyeHeight:1.7},aligned=false,floorReady=floorAvailable,floor=0;
  let mode='idle',points=[],surfaces=[],floorIndex=0,fixtureIndex=0,lastPlanes=-Infinity,notice='Zeige mit dem rechten Controller auf eine Schaltfläche. Drücke kurz den Zeigefinger-Trigger.';
  let buttons=[],labels={},anchor=null,anchorWanted=false,anchorBusy=false,captureUsed=false,pending=false,disposed=false,planId=planner.plan?.id;
  let restoreToken=0,page='room',lastMessage='',groundPoint=null,groundValid=false,afterFloor='room';
  let grab=null,newDevice=null,hovered=null,previewFixture=null,undoPlan=null;
  const position=()=>newDevice?.position||planner.plan?.positions[selected()];
  function cancelMove(){grab=null;newDevice=null;previewFixture=null;hovered=null;if(mode==='place'||mode==='grab')mode='idle';}
  function clearAnchor(){restoreToken++;anchor?.delete?.();anchor=null;}
  function resetAlignment(){cancelMove();clearAnchor();aligned=false;mode='align';points=[];notice='A: vorne links am Begrenzungsrechteck auf dem Boden markieren.';}
  const reset=()=>{cancelMove();if(!anchor){clearAnchor();anchorWanted=false;aligned=false;mode='idle';notice='Tracking-Ursprung geändert. Raum erneut mit A/B ausrichten.';}};
  reference.addEventListener?.('reset',reset);
  async function restore() {
    const own=++restoreToken,id=planner.plan?.id;let handle;
    try{handle=localStorage.getItem(anchorKey(id));}catch{}
    if(!handle||!session.restorePersistentAnchor)return;
    try{const value=await session.restorePersistentAnchor(handle);if(disposed||own!==restoreToken){value.delete();return;}anchor=value;notice='Raumanker geladen. Auf Tracking warten; Ausrichtung am Raum prüfen.';}catch{notice='Raumanker nicht verfügbar. Bitte A/B neu ausrichten.';}
  }
  void restore();
  function choices(){return surfaces.filter(s=>s.kind==='floor'||s.horizontal&&s.points.reduce((v,p)=>v+p[1],0)/s.points.length<floor+.3).sort((a,b)=>(b.kind==='floor')-(a.kind==='floor')||Math.abs(area(b.points.map(p=>[p[0],p[2]])))-Math.abs(area(a.points.map(p=>[p[0],p[2]]))));}
  const fixtureIds=()=>Object.keys(planner.plan?.positions||{});
  const selected=()=>{if(newDevice)return newDevice.id;const ids=fixtureIds();fixtureIndex=ids.length?((fixtureIndex%ids.length)+ids.length)%ids.length:0;return ids[fixtureIndex];};
  function savePosition(id,p){const before=structuredClone(planner.plan),plan=structuredClone(before);plan.positions[id]=p;planner.save(plan);undoPlan=before;fixtureIndex=Object.keys(plan.positions).indexOf(id);}
  function changeFixture(changes){const id=selected();if(!id)throw Error('Zuerst Geräte aus der Show übernehmen.');savePosition(id,{...position(),...changes});}
  const rayPoint=(m,d)=>[m[12]-m[8]*d,m[13]-m[9]*d,m[14]-m[10]*d];
  const yaw=m=>Math.atan2(m[8],m[10]);
  const validPosition=p=>p&&Number.isFinite(p.height)&&p.height>=0&&p.height<=planner.plan.height&&insideRoom([p.x,p.y],planner.plan.boundary);
  function updateGrab(frame){
    if(!grab)return;
    const m=input(frame,grab.source),g=grab.source.gripSpace?frame.getPose(grab.source.gripSpace,reference)?.transform.matrix:m;
    if(!m||!g||!aligned||!Array.from(session.inputSources||[]).includes(grab.source)){cancelMove();notice='Greifen unterbrochen. Der gespeicherte Standort bleibt erhalten.';return;}
    const p=xrToRoom(rayPoint(m,grab.distance),origin),height=p[2]+grab.offset[2];
    grab.preview={...grab.original,x:p[0]+grab.offset[0],y:p[1]+grab.offset[1],height:height>=-.05&&height<.06?0:height,rotation:((grab.original.rotation+(yaw(g)-grab.yaw)*180/Math.PI)%360+360)%360};
    grab.valid=validPosition(grab.preview);previewFixture={id:grab.id,position:grab.preview,valid:grab.valid};
  }
  function squeezeStart(event){
    if(disposed||grab||pending||!aligned||event.inputSource.handedness==='left'||['music','scan'].includes(page)||!['idle','place'].includes(mode))return;
    const m=input(event.frame,event.inputSource);if(!m||panelHit(overlay?.panel,m))return;
    const hit=mode==='place'&&previewFixture?.valid?{id:selected(),distance:Math.hypot(...rayPoint(m,0).map((n,i)=>n-groundPoint[i]))}:mode==='idle'&&roomFixtureHit(m,origin,planner.plan);
    if(!hit)return;
    const original=mode==='place'?previewFixture.position:planner.plan.positions[hit.id];
    const g=event.inputSource.gripSpace?event.frame.getPose(event.inputSource.gripSpace,reference)?.transform.matrix:m;if(!g)return;
    const point=xrToRoom(rayPoint(m,hit.distance),origin);
    fixtureIndex=fixtureIds().indexOf(hit.id);grab={id:hit.id,source:event.inputSource,original:structuredClone(original),distance:hit.distance,offset:[original.x-point[0],original.y-point[1],original.height-point[2]],yaw:yaw(g),preview:original,valid:true};
    mode='grab';page='devices';notice='Trigger: abbrechen · Greiftaste loslassen: abstellen.';updateGrab(event.frame);
  }
  function squeeze(event){
    if(!grab||event.inputSource!==grab.source)return;
    updateGrab(event.frame);if(!grab)return;
    const current=grab;grab=null;previewFixture=null;
    if(!current.valid){mode=newDevice?'place':'idle';notice='Außerhalb des Raums. Der Standort wurde nicht gespeichert.';return;}
    try{savePosition(current.id,current.preview);newDevice=null;mode='idle';page='devices';notice='Abgestellt und gespeichert. Greife eine Leuchte zum Verschieben.';}
    catch(error){mode=newDevice?'place':'idle';notice=error.message;}
  }
  const squeezeEnd=event=>{if(grab?.source===event.inputSource){cancelMove();notice='Greifen abgebrochen. Der gespeicherte Standort bleibt erhalten.';}};
  const interrupt=()=>{if(grab||newDevice){cancelMove();notice='Platzierung unterbrochen. Gespeicherte Geräte bleiben erhalten.';}};
  const visibility=()=>{if(session.visibilityState&&session.visibilityState!=='visible')interrupt();};
  const sourcesChanged=()=>{if(grab&&!Array.from(session.inputSources||[]).includes(grab.source))interrupt();};
  const listeners=[['squeezestart',squeezeStart],['squeeze',squeeze],['squeezeend',squeezeEnd],['visibilitychange',visibility],['inputsourceschange',sourcesChanged],['end',interrupt]];
  for(const [name,handler] of listeners)session.addEventListener?.(name,handler);
  function menu() {
    let items;
    if(mode==='boundary')items=[['finish','Raumform fertig'],['undo','Letzte Ecke zurück'],['cancel','Abbrechen'],['exit','AR beenden']];
    else if(mode==='align')items=[['undo','Punkt zurück'],['cancel','Abbrechen'],['exit','AR beenden']];
    else if(mode==='floor')items=[['cancel','Abbrechen'],['exit','AR beenden']];
    else if(mode==='place'||mode==='grab')items=[['cancel','Platzierung beenden'],['exit','AR beenden']];
    else if(page==='scan')items=[['adopt','Diesen Boden verwenden'],['floor-next','Andere Bodenfläche'],['manual','Ecken selbst setzen'],['room','Zurück'],['exit','AR beenden']];
    else if(page==='add')items=[['new-moving','+ Moving Head'],['new-spot','+ Scheinwerfer'],['new-bar','+ LED-Bar'],['add','Showgeräte übernehmen'],['devices','Zurück'],['exit','AR beenden']];
    else if(page==='details')items=fixtureIds().length?[
      ['place','Standort wählen'],['choose-add','+ Gerät hinzufügen'],['previous','Vorheriges Gerät'],['next','Nächstes Gerät'],['lower','Höhe −10 cm'],['higher','Höhe +10 cm'],['rotate-left','Drehen −15°'],['rotate-right','Drehen +15°'],['devices','Zurück zur Platzierung'],['room','Raum / Ausrichten'],['exit','AR beenden']]:[['choose-add','Erstes Gerät hinzufügen'],['room','Zurück zum Raum'],['exit','AR beenden']];
    else if(page==='devices')items=[['new-moving','+ Moving Head'],['new-spot','+ Scheinwerfer'],['new-bar','+ LED-Bar'],['details','Weitere Einstellungen'],...(undoPlan?[['undo-edit','Rückgängig']]:[]),['done','Fertig / Senden'],['exit','AR beenden']];
    else if(page==='done')items=[['send','An Rechner senden'],['devices','Geräte weiter bearbeiten'],['room','Raum neu ausrichten'],['music','Musik steuern'],['exit','AR beenden']];
    else items=aligned?[
      ['devices','Weiter: Geräte aufstellen'],['align','Aufstellung neu ausrichten'],['scan','Neuen Raum erkennen'],['manual','Neue Raumecken setzen'],['exit','AR beenden']]:[
      ...(planner.plan?[['align','Gespeicherten Raum ausrichten']]:[]),['scan','Raum automatisch erkennen'],['manual','Raumecken selbst setzen'],...(!floorReady?[['floor','Bodenhöhe festlegen']]:[]),['exit','AR beenden']];
    labels=Object.fromEntries(items);const columns=items.length>8?3:2,rows=Math.ceil(items.length/columns),height=Math.min(.135,.52/rows);
    buttons=items.map(([id],i)=>[id,.025+(i%columns)*(.95/columns),.43+Math.floor(i/columns)*(height+.012),.95/columns-.015,height]);
  }
  function instruction(){
    if(mode==='boundary')return {title:'1 · Setze die Raumecken',lines:[points.length?`${points.length} Ecken gesetzt · Folge den Wänden der Reihe nach.`:'Zeige auf die erste Ecke am Boden, vorne links.', 'Zeigefinger-Trigger kurz drücken = eine Ecke setzen.',points.length>=3?'Fertig? Wähle unten „Raumform fertig“.':'Setze mindestens drei Ecken.',notice]};
    if(mode==='align')return {title:'1 · Richte den Raum aus',lines:[points.length?'Jetzt Punkt B: vorne rechts auf dem Boden.':'Zuerst Punkt A: vorne links auf dem Boden.',`A und B liegen ${planner.plan.width.toFixed(2)} m auseinander.`, 'Zeigen und den rechten Zeigefinger-Trigger kurz drücken.',notice]};
    if(mode==='floor')return {title:'Zuerst die Bodenhöhe festlegen',lines:['Halte den rechten Controller direkt an den Boden.','Drücke dort den rechten Zeigefinger-Trigger.','Danach geht es mit deinem Raum weiter.',notice]};
    const id=selected(),p=position(),name=deviceName(id,p,fixtureIndex);
    if(mode==='grab')return {title:`${name} · in deiner Hand`,lines:[grab?.valid?'Grün: Loslassen stellt die Leuchte ab.':'Rot: Bewege die Leuchte zurück in den Raum.','Controller bewegen = Standort und Höhe.','Controller drehen = Leuchte drehen.',notice]};
    if(mode==='place')return {title:`2 · ${name} aufstellen`,lines:[groundPoint?(groundValid?'Grüne Vorschau: Hier kannst du das Gerät abstellen.':'Rote Vorschau: Wähle einen Punkt innerhalb des Raumes.'):'Zeige mit dem rechten Controller nach unten auf den Boden.', 'Bewege die Vorschau zum gewünschten Standort.', 'Trigger: abstellen · Greiftaste halten: frei anheben und drehen.',notice]};
    if(page==='scan'){const list=choices(),candidate=list[floorIndex%list.length];return {title:'1 · Prüfe den erkannten Boden',lines:[candidate?`Boden ${floorIndex%list.length+1} von ${list.length} · ${Math.abs(area(candidate.points.map(p=>[p[0],p[2]]))).toFixed(1)} m²`:'Noch keine Bodenfläche erkannt.', 'Die grüne Umrandung zeigt die ausgewählte Fläche.','Passt sie zu deinem Raum? Dann „Diesen Boden verwenden“.',notice]};}
    if(page==='add')return {title:'2 · Füge ein Gerät hinzu',lines:['Wähle einen Gerätetyp oder deine Showgeräte.','Danach zeigst du auf seinen Standort am Boden.','Gerätemaße kannst du später im Raumeditor anpassen.',notice]};
    if(page==='devices')return {title:'Leuchten direkt platzieren',lines:[hovered?`${deviceName(hovered,planner.plan.positions[hovered])} · Greiftaste halten`:'Leuchte anvisieren und seitliche Greiftaste halten.','Bewegen, anheben, drehen. Loslassen speichert.','Neue Leuchte: Typ wählen, zeigen, Trigger drücken.',notice]};
    if(page==='details')return {title:p?`2 · ${name}`:'2 · Dein erstes Gerät',lines:[p?`Gerät ${fixtureIndex+1} von ${fixtureIds().length} · Höhe ${p.height.toFixed(2)} m · ${p.rotation}°`:'Dein Raum ist bereit. Füge jetzt ein Gerät hinzu.',p?'Das ausgewählte Gerät ist gelb umrandet.':'Du brauchst dafür noch keine angeschlossene Lampe.',p?'Wähle „Standort wählen“, um es am Boden zu platzieren.':'Nach der Auswahl führt dich eine Vorschau zum Standort.',notice]};
    if(page==='done')return {title:'3 · Deine Aufstellung ist gespeichert',lines:[`${fixtureIds().length} Geräte in ${planner.plan?.name||'deinem Raum'}.`,'Zum Weiterarbeiten am PC: „An Rechner senden“.','Du kannst die Geräte jederzeit weiter bearbeiten.',notice]};
    return {title:aligned?'1 · Dein Raum ist bereit':'1 · Beginne mit deinem Raum',lines:[aligned?planner.plan.name:planner.plan?`Gespeichert: ${planner.plan.name}`:'Raum automatisch erkennen oder Ecken selbst setzen.',aligned?'Weiter geht es mit den Geräten.':'Wir führen dich anschließend durch die Platzierung.','Rechter Controller: zeigen · Zeigefinger-Trigger: wählen.',notice]};
  }
  const target=hit=>hit&&buttons.find(([,x,y,w,h])=>hit.u>=x&&hit.u<=x+w&&hit.v>=y&&hit.v<=y+h)?.[0];
  const input=(frame,source)=>source?.targetRaySpace?frame.getPose(source.targetRaySpace,reference)?.transform.matrix:null;
  async function act(action) {
    if(action==='exit'){exit();return;}
    if(action==='cancel'){cancelMove();mode='idle';points=[];groundPoint=null;page=aligned?'devices':'room';notice='Abgebrochen. Die gespeicherte Aufstellung bleibt erhalten.';return;}
    if(pending)return;
    try {
      if(action==='scan') {
        page='scan';mode='idle';if(choices().length){notice='Prüfe die grün markierte Bodenfläche.';return;}
        if(captureUsed)throw Error('Raumeinrichtung bereits geöffnet. Flächen prüfen oder AR neu starten.');
        if(!session.initiateRoomCapture)throw Error('Raumscan hier nicht verfügbar. Brillen-Raumeinrichtung oder manuelle Grenzen verwenden.');
        captureUsed=true;pending=true;await session.initiateRoomCapture();notice='Raumflächen werden geladen. Boden prüfen und „Flächen übernehmen“ wählen.';
      } else if(action==='floor-next'){floorIndex++;notice='Markierten Boden prüfen. Erst danach übernehmen.';}
      else if(action==='adopt') {
        const candidates=choices(),chosen=candidates[floorIndex%candidates.length];
        if(!chosen)throw Error('Noch keine Bodenfläche. Raum einrichten oder Grenzen manuell markieren.');
        const captured=roomFromFloor(chosen.points,surfaces,planner.plan);planner.use(captured.plan);planId=captured.plan.id;origin=captured.origin;floor=-origin.floorOffset;floorReady=true;aligned=true;mode='idle';clearAnchor();anchorWanted=true;page='devices';notice='Raum gespeichert. Wähle jetzt dein erstes Gerät.';
      } else if(action==='manual'){if(!floorReady){afterFloor='manual';mode='floor';notice='Die Brille kennt die Bodenhöhe noch nicht. Lege sie zuerst fest.';return;}mode='boundary';points=[];notice='Ecken nacheinander am Boden markieren. Danach „Grenzen fertig“.';}
      else if(action==='undo'){points.pop();notice=`${points.length} Bodenpunkte markiert.`;}
      else if(action==='finish') {
        const captured=roomFromFloor(points,[],planner.plan);planner.use(captured.plan);planId=captured.plan.id;origin=captured.origin;aligned=true;clearAnchor();anchorWanted=true;mode='idle';points=[];page='devices';notice='Deine Raumecken sind gespeichert. Jetzt kannst du Geräte hinzufügen.';
      } else if(action==='align'){if(!planner.plan)throw Error('Zuerst einen Raum anlegen oder erfassen.');if(!floorReady){afterFloor='align';mode='floor';notice='Die Brille kennt die Bodenhöhe noch nicht. Lege sie zuerst fest.';return;}resetAlignment();}
      else if(action==='floor'){afterFloor='room';mode='floor';notice='Rechten Controller zum Boden halten und dort Trigger drücken.';}
      else if(action==='devices'){page='devices';mode='idle';notice='Leuchte anvisieren und mit der seitlichen Greiftaste bewegen.';}
      else if(action==='details'){page='details';mode='idle';}
      else if(action==='undo-edit'){if(undoPlan&&undoPlan.id===planner.plan.id){planner.save(undoPlan);undoPlan=null;notice='Letzte Platzierung rückgängig gemacht.';}}
      else if(action==='room'){page='room';mode='idle';}
      else if(action==='choose-add'){page='add';notice='Wähle den Gerätetyp. Danach platzierst du ihn am Boden.';}
      else if(action==='done'){page='done';mode='idle';notice='Alles auf diesem Gerät gespeichert.';}
      else if(action.startsWith('new-')){if(!planner.plan)throw Error('Lege zuerst deinen Raum an.');if(!aligned)throw Error('Richte zuerst deinen Raum aus.');newDevice=planningDevice(planner.plan,action.slice(4));page='devices';mode='place';notice='Zeige auf den Boden. Die Vorschau folgt deinem Controller.';}
      else if(action==='previous')fixtureIndex--;
      else if(action==='next')fixtureIndex++;
      else if(action==='place'){if(!aligned)throw Error('Raum zuerst mit A/B ausrichten oder erfassen.');if(!selected())throw Error('Zuerst Showgeräte übernehmen.');mode='place';groundPoint=null;notice='Auf die gewünschte Bodenposition zeigen und Trigger drücken.';}
      else if(action==='add'){planner.seed(scene);page='devices';notice='Geräte übernommen. Wähle ein Gerät und seinen Standort.';}
      else if(action==='higher'||action==='lower'){const p=planner.plan?.positions[selected()];if(!p)throw Error('Kein Gerät ausgewählt.');changeFixture({height:Math.round((p.height+(action==='higher'?.1:-.1))*100)/100});}
      else if(action==='rotate-left'||action==='rotate-right'){const p=planner.plan?.positions[selected()];if(!p)throw Error('Kein Gerät ausgewählt.');changeFixture({rotation:(p.rotation+(action==='rotate-left'?-15:15)+360)%360});}
      else if(action==='send'){if(!planner.plan)throw Error('Kein Raum vorhanden.');pending=true;await command({action:'room-plan',plan:planner.plan});notice='Raum gesendet. Übernahme am Rechner in der Live-Vorschau prüfen.';}
      else if(action==='music'){page='music';notice='Mit linkem Trigger zum AR-Raumplan zurückkehren.';}
    } catch(error){notice=error.message;} finally{pending=false;}
  }
  async function rememberAnchor(frame) {
    anchorWanted=false;
    if(!frame.createAnchor || !globalThis.XRRigidTransform)return;
    const plan=planner.plan,own=++restoreToken,c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
    const x=-plan.width/2-origin.x,y=-origin.y;
    const position={x:x*c+y*s,y:-origin.floorOffset,z:x*s-y*c};
    anchorBusy=true;
    try {
      const next=await frame.createAnchor(new XRRigidTransform(position,{x:0,y:-Math.sin(origin.yaw/2),z:0,w:Math.cos(origin.yaw/2)}),reference);
      if(disposed||own!==restoreToken){next.delete();return;}anchor=next;
      if(next.requestPersistentHandle) {
        const handle=await next.requestPersistentHandle();
        if(disposed||own!==restoreToken){await session.deletePersistentAnchor?.(handle);return;}
        try {const old=localStorage.getItem(anchorKey(plan.id));localStorage.setItem(anchorKey(plan.id),handle);if(old&&old!==handle)await session.deletePersistentAnchor?.(old);}catch{notice='Anker gilt für diese Sitzung. Beim nächsten Start A/B ausrichten.';}
      }
    } catch {notice='Aufstellung gespeichert. Raum beim nächsten Start mit A/B ausrichten.';}finally{anchorBusy=false;}
  }
  return {
    update(frame,ref,pose,own,value,unused,time) {
      scene=value;const messageKey=String(value.controlMessageId)+value.controlMessage;if(value.controlMessage&&messageKey!==lastMessage){lastMessage=messageKey;notice=value.controlMessage;}
      if(planId!==planner.plan?.id){cancelMove();undoPlan=null;planId=planner.plan?.id;aligned=false;clearAnchor();void restore();}
      if(anchor){const p=frame.getPose(anchor.anchorSpace,reference);if(p&&planner.plan){const m=p.transform.matrix,left=[m[12],m[13],m[14]],right=[m[12]+m[0],m[13],m[14]+m[2]];origin=alignedOrigin(planner.plan,left,right);floor=-origin.floorOffset;floorReady=true;aligned=true;}else{aligned=false;interrupt();}}
      if(anchorWanted&&!anchorBusy)void rememberAnchor(frame);
      if(time-lastPlanes>500){lastPlanes=time;surfaces=detectedRoomSurfaces(frame,reference);}
      overlay=base.update(frame,ref,pose,own,value,origin,time);
      if(!overlay)return null;
      const source=Array.from(own.inputSources||[]).find(s=>s.handedness==='right')||own.inputSources?.[0],matrix=input(frame,source);
      if(page==='music'){overlay.canvasState.notice='Linker Trigger: zurück zum AR-Raumplan';return overlay;}
      overlay.panel.width=.52;overlay.panel.height=.36;
      updateGrab(frame);menu();const hit=panelHit(overlay.panel,matrix),hover=target(hit);
      hovered=aligned&&mode==='idle'&&!hit?roomFixtureHit(matrix,origin,planner.plan)?.id:null;
      const ground=matrix&&floorReady?floorRay(matrix,floor):null;
      if(matrix)overlay.ray=[[matrix[12],matrix[13],matrix[14]],hit?.point||ground||[matrix[12]-matrix[8]*2,matrix[13]-matrix[9]*2,matrix[14]-matrix[10]*2]];
      groundPoint=!hit?ground:null;groundValid=!!groundPoint&&!!planner.plan&&insideRoom(xrToRoom(groundPoint,origin),planner.plan.boundary);
      if(mode==='place'){const p=position(),point=groundPoint&&xrToRoom(groundPoint,origin);previewFixture=p&&point?{id:selected(),position:{...p,x:point[0],y:point[1]},valid:groundValid}:null;}
      const candidates=choices(),candidate=candidates[floorIndex%candidates.length],guide=instruction();
      const disabled=buttons.filter(([id])=>id!=='exit'&&(pending||id==='finish'&&points.length<3||id==='undo'&&!points.length||id==='adopt'&&!candidate||id==='floor-next'&&candidates.length<2)).map(b=>b[0]);
      overlay.canvasState={ar:true,...guide,buttons,labels,hover,disabledButtons:disabled,primary:buttons[0]?.[0],notice:'',position:0,duration:0};
      overlay.worldLines=[];
      const outline=(pts,color)=>pts.forEach((p,i)=>overlay.worldLines.push({points:[p,pts[(i+1)%pts.length]],color}));
      if(page==='scan'){for(const surface of surfaces)outline(surface.points,surface===candidate?[.4,1,.6]:[.2,.55,.65]);}
      if(points.length){for(let i=1;i<points.length;i++)overlay.worldLines.push({points:[points[i-1],points[i]],color:[1,.8,.2]});if(mode==='boundary'&&groundPoint)overlay.worldLines.push({points:[points.at(-1),groundPoint],color:[1,.8,.2]});points.forEach((point,index)=>{const radius=.065;outline(Array.from({length:16},(_,i)=>[point[0]+Math.cos(i*Math.PI/8)*radius,point[1]+.015,point[2]+Math.sin(i*Math.PI/8)*radius]),[1,.8,.2]);});}
      if(points.length){
        const segments=[[[0,1],[1,1]],[[1,1],[1,.5]],[[1,.5],[1,0]],[[0,0],[1,0]],[[0,.5],[0,0]],[[0,1],[0,.5]],[[0,.5],[1,.5]]],digits=['012345','12','01643','01236','1256','02563','023456','012','0123456','012356'],head=pose.transform.matrix;
        points.forEach((point,index)=>{const label=String(index+1);[...label].forEach((digit,k)=>{const project=([x,y])=>point.map((n,i)=>n+(i===1?.14:0)+head[i]*((x+k*1.4-label.length*.6)*.065)+head[4+i]*y*.12);for(const segment of digits[Number(digit)])overlay.worldLines.push({points:segments[Number(segment)].map(project),color:[1,.9,.6]});});});
      }
      const marked=previewFixture||(hovered?{id:hovered,position:planner.plan.positions[hovered],valid:true}:null);
      if(marked){const p=marked.position,color=marked.valid?[.35,1,.6]:[1,.25,.2],a=p.rotation*Math.PI/180,c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
        const corner=(x,y,z)=>{const dx=p.x+x*Math.cos(a)-y*Math.sin(a)-origin.x,dy=p.y+x*Math.sin(a)+y*Math.cos(a)-origin.y;return [dx*c+dy*s,p.height+z-(origin.floorOffset||0),dx*s-dy*c];};
        const bottom=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>corner(x*p.size.width/2,y*p.size.depth/2,0)),top=bottom.map(q=>[q[0],q[1]+p.size.height,q[2]]);
        outline(bottom,color);outline(top,color);bottom.forEach((p,i)=>overlay.worldLines.push({points:[p,top[i]],color}));
        overlay.rayColor=color;
      }
      if(groundPoint&&mode!=='idle') {overlay.worldLines.push({points:[[ground[0]-.08,floor+.01,ground[2]],[ground[0]+.08,floor+.01,ground[2]]],color:[1,.8,.2]},{points:[[ground[0],floor+.01,ground[2]-.08],[ground[0],floor+.01,ground[2]+.08]],color:[1,.8,.2]});}
      return overlay;
    },
    select(event) {
      if(page==='music'){if(event.inputSource.handedness==='left'){page='room';return;}void base.select(event,reference);return;}
      if(event.inputSource.handedness==='left')return;
      if(grab){interrupt();notice='Greifen abgebrochen. Der bisherige Standort bleibt erhalten.';return;}
      const matrix=input(event.frame,event.inputSource),hit=panelHit(overlay?.panel,matrix),action=target(hit);
      if(hit){if(action&&!overlay.canvasState.disabledButtons?.includes(action))void act(action);return;}
      if(aligned&&mode==='idle'&&page!=='scan'){const fixture=roomFixtureHit(matrix,origin,planner.plan);if(fixture){fixtureIndex=fixtureIds().indexOf(fixture.id);page='devices';mode='place';notice='Auf den Standort zeigen und Trigger drücken. Greiftaste: frei bewegen.';return;}}
      try {
        if(mode==='floor') {
          const grip=event.inputSource.gripSpace&&event.frame.getPose(event.inputSource.gripSpace,reference)?.transform.matrix;
          if(!grip)throw Error('Controllerposition nicht verfügbar.');floor=grip[13];floorReady=true;aligned=false;clearAnchor();mode='idle';notice='Bodenhöhe gespeichert.';const next=afterFloor;afterFloor='room';if(next!=='room')void act(next);return;
        }
        const point=floorReady&&floorRay(matrix,floor);if(!point){if(['boundary','place','align'].includes(mode))notice='Zeige weiter nach unten, bis die Markierung auf dem Boden erscheint.';return;}
        if(mode==='boundary'){if(points.length>=128)throw Error('Maximal 128 Eckpunkte.');if(points.length&&Math.hypot(...point.map((n,i)=>n-points.at(-1)[i]))<.05)throw Error('Punkte liegen zu dicht zusammen.');points.push(point);notice=`${points.length} Punkte · weitere Ecken markieren oder Grenzen fertig.`;}
        else if(mode==='align') {points.push(point);if(points.length===1)notice='B: vorne rechts auf dem Boden markieren.';else{origin=alignedOrigin(planner.plan,points[0],point);const measured=Math.hypot(point[0]-points[0][0],point[2]-points[0][2]);aligned=true;anchorWanted=true;mode='idle';page='devices';points=[];notice=`Ausgerichtet. A–B ${measured.toFixed(2)} m, Plan ${planner.plan.width.toFixed(2)} m. Bei Abweichung neu ausrichten.`;}}
        else if(mode==='place') {const p=xrToRoom(point,origin);if(!insideRoom(p,planner.plan.boundary))throw Error('Position liegt außerhalb des Grundrisses.');changeFixture({x:p[0],y:p[1]});newDevice=null;previewFixture=null;mode='idle';page='devices';groundPoint=null;notice='Standort gespeichert. Zum Verschieben direkt anvisieren und greifen.';}
      }catch(error){notice=error.message;if(mode==='align'&&points.length>1)points.pop();}
    },
    scene(value){if(!aligned||!planner.plan)return {...value,layout:{...value.layout,ar:true},lights:[],crowd:[]};const plan=previewFixture?{...planner.plan,positions:{...planner.plan.positions,[previewFixture.id]:previewFixture.position}}:planner.plan;const result=applyRoomPlan(value,plan,true);result.layout.selectedFixture=hovered||selected();return result;},
    squeezeStart,squeeze,squeezeEnd,
    get origin(){return origin;},
    destroy(){disposed=true;cancelMove();clearAnchor();reference.removeEventListener?.('reset',reset);for(const [name,handler] of listeners)session.removeEventListener?.(name,handler);}
  };
}
