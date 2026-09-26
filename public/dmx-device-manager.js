// Compact the room planner's device step without replacing its controls or map.
export function compactDeviceManager(root){
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./dmx-device-manager.css',import.meta.url).href;document.head.append(style);
 const q=key=>root.querySelector('[data-ar-'+key+']');
 const map=q('map-section'),mapHome=document.createComment('room-map-home');map.before(mapHome);
 const devicesPage=root.querySelector('[data-ar-page="2"]');
 const workspace=document.createElement('div');workspace.className='ar-device-workspace';workspace.hidden=true;map.before(workspace);workspace.append(devicesPage);
 root.querySelector('.ar-navigation').append(q('undo'));
 const nav=document.createElement('div');nav.className='ar-device-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Gerätemanager Bereiche');devicesPage.prepend(nav);
 const panels=new Map(),buttons=new Map();
 for(const [key,title] of [['devices','Geräte'],['position','Position'],['motion','Licht'],['size','Maße'],['zones','Ruhezonen'],['import','Übernehmen']]){
  const panel=document.createElement('div');panel.className='ar-device-tab-panel';panel.id='ar-device-panel-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ar-device-tab-'+key);devicesPage.append(panel);panels.set(key,panel);
  const button=document.createElement('button');button.type='button';button.id='ar-device-tab-'+key;button.dataset.deviceTab=key;button.textContent=title;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.onclick=()=>select(key);nav.append(button);buttons.set(key,button);
 }
 let active='devices';
 function select(key){active=key;chooser.hidden=['devices','zones','import'].includes(key);for(const [name,panel] of panels){panel.hidden=name!==key;buttons.get(name).setAttribute('aria-selected',String(name===key));buttons.get(name).tabIndex=name===key?0:-1;}}
 nav.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const enabled=[...buttons.values()].filter(b=>!b.disabled),index=enabled.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?enabled.length-1:(index+(event.key==='ArrowLeft'?-1:1)+enabled.length)%enabled.length;enabled[next].click();enabled[next].focus();};
 const list=panels.get('devices');list.append(q('empty'));
 const templates=root.querySelector('.ar-add-types');templates.hidden=true;list.append(templates);
 const add=document.createElement('div');add.className='ar-compact-add';const type=document.createElement('select');type.setAttribute('aria-label','Gerätetyp');
 for(const button of templates.children)type.add(new Option(button.textContent.replace(/^\+ /,''),button.dataset.arTemplate));
 const addButton=document.createElement('button');addButton.type='button';addButton.textContent='+ Hinzufügen';addButton.onclick=()=>templates.querySelector('[data-ar-template="'+type.value+'"]').click();add.append(type,addButton);list.append(add,q('devices'));
 const pager=document.createElement('div');pager.className='ar-device-pager';const prev=document.createElement('button'),next=document.createElement('button'),count=document.createElement('output');
 for(const [b,text,label] of [[prev,'‹','Vorherige Geräteseite'],[next,'›','Nächste Geräteseite']]){b.type='button';b.textContent=text;b.setAttribute('aria-label',label);}
 count.setAttribute('aria-live','polite');pager.append(prev,count,next);list.append(pager);
 const chosen=q('fixture');chosen.hidden=false;const chooser=document.createElement('label');chooser.className='ar-device-chooser';chooser.textContent='Ausgewähltes Gerät';chooser.append(chosen);nav.after(chooser);
 const editor=q('device-editor'),position=panels.get('position');
 position.append(q('device-name').closest('label'),q('place').closest('.ar-actions'),q('z').closest('.ar-fields'));
 const dimensions=q('size-width').closest('details');position.append(q('x').closest('.ar-fields'));
 const sizes=panels.get('size');sizes.append(q('size-width').closest('.ar-fields'));dimensions.remove();
 const motion=panels.get('motion');motion.append(q('motion-area'),q('rotation-help'));
 const wall=q('wall').closest('details');wall.open=true;
 const area=q('motion-area'),floor=document.createElement('div');floor.className='ar-motion-floor';floor.append(q('area-left').closest('.ar-fields'),q('area-reset'));area.append(floor,wall);
 const surfaceNav=document.createElement('div');surfaceNav.className='ar-motion-tabs';surfaceNav.setAttribute('role','group');surfaceNav.setAttribute('aria-label','Bewegungsfläche');
 for(const [target,label] of [[floor,'Boden'],[wall,'Wand']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{floor.hidden=target!==floor;wall.hidden=target!==wall;for(const other of surfaceNav.children)other.setAttribute('aria-pressed',String(other===b));};surfaceNav.append(b);}
 area.prepend(surfaceNav);surfaceNav.children[0].click();
 const zones=q('room-zones'),zonesHome=document.createComment('room-zones-home');zones.before(zonesHome);
 const imported=q('show-devices');imported.open=true;panels.get('import').append(imported);
 const importActions=document.createElement('div');importActions.className='ar-compact-add';
 const importChoice=document.createElement('select');importChoice.setAttribute('aria-label','Showgerät übernehmen');
 const importButton=document.createElement('button');importButton.type='button';importButton.textContent='Übernehmen';importButton.onclick=()=>q('available').children[Number(importChoice.value)]?.click();
 importActions.append(importChoice,importButton);q('available').before(importActions);q('available').hidden=true;
 const importZones=q('import-zones');if(importZones)panels.get('import').append(importZones);
 editor.hidden=true;
 // Long explanatory text is available on demand, outside the working layout.
 const help=document.createElement('div');help.className='ar-device-help';help.setAttribute('popover','auto');
 const helpButton=document.createElement('button');helpButton.type='button';helpButton.className='ar-device-help-button';helpButton.textContent='Bedienhilfe';helpButton.popoverTargetElement=help;
 for(const node of [root.querySelector('.ar-map-controls'),root.querySelector('.ar-map-legend'),zones.querySelector('small'),zones.querySelector('.ar-room-zones>p')])if(node)help.append(node);
 map.querySelector('.ar-map-tools').append(helpButton);root.append(help);
 let currentPage=0,lastFixture='',pageSize=5;
 function paginate(fixture,follow=true){
  const rows=[...q('devices').children],index=rows.findIndex(b=>b.dataset.selectDevice===fixture);
  if(follow&&fixture!==lastFixture&&index>=0)currentPage=Math.floor(index/pageSize);
  lastFixture=fixture;const total=Math.max(1,Math.ceil(rows.length/pageSize));currentPage=Math.min(currentPage,total-1);
  rows.forEach((row,i)=>row.hidden=Math.floor(i/pageSize)!==currentPage);count.textContent=rows.length?(currentPage*pageSize+1)+'–'+Math.min(rows.length,(currentPage+1)*pageSize)+' / '+rows.length:'Keine Geräte';prev.disabled=!currentPage;next.disabled=currentPage===total-1;
 }
 prev.onclick=()=>{currentPage--;paginate(lastFixture,false);};next.onclick=()=>{currentPage++;paginate(lastFixture,false);};
 const mobile=document.createElement('div');mobile.className='ar-device-mobile';mobile.setAttribute('aria-label','Gerätemanager Ansicht');
 for(const [key,label] of [['plan','Plan'],['tools','Geräte & Details']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{root.dataset.deviceArea=key;for(const other of mobile.children)other.setAttribute('aria-pressed',String(other===b));};mobile.append(b);}
 workspace.before(mobile);mobile.children[0].click();
 const resize=new ResizeObserver(()=>{const size=workspace.clientHeight<500?4:6;if(size!==pageSize){pageSize=size;paginate(lastFixture);}});resize.observe(workspace);
 select('devices');
 return {
  refresh({step,fixture,moving,mode}){
   root.dataset.plannerStep=String(step);workspace.hidden=step!==2;mobile.hidden=step!==2;
   if(step===2){workspace.prepend(map);panels.get('zones').append(zones);}else{mapHome.after(map);zonesHome.after(zones);}
   editor.hidden=true;root.dataset.placementMode=mode;if(['place','aim'].includes(mode))mobile.children[0].click();
   for(const key of ['position','motion','size'])buttons.get(key).disabled=!fixture||(key==='motion'&&!moving);
   if(buttons.get(active).disabled)select('devices');
   chooser.hidden=active==='devices'||active==='zones'||active==='import';
   const value=importChoice.value;importChoice.replaceChildren(...[...q('available').children].map((b,i)=>new Option(b.textContent.replace(/^\+ /,''),String(i))));if([...importChoice.options].some(o=>o.value===value))importChoice.value=value;importChoice.disabled=importButton.disabled=!importChoice.options.length;
   paginate(fixture);
  },
  destroy(){resize.disconnect();style.remove();}
 };
}
