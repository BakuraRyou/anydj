// A source is navigable only while its existing client has a connection.
export function setProviderConnected(tab,connected){
 const wasSelected=tab.getAttribute('aria-selected')==='true';tab.hidden=!connected;
 if(!connected&&wasSelected)selectProvider('localLibrary');
 const bar=tab.closest('.provider-tabbar');if(bar)bar.hidden=![...bar.querySelectorAll('[role=tab]')].some(n=>n.id!=='localTab'&&!n.hidden);
}
export function selectProvider(id){
 const root=document.getElementById('libraryDrop');
 if(id!=='localLibrary'&&root.querySelector(`[role=tab][aria-controls="${id}"]`)?.hidden)id='localLibrary';
 if(id!=='localLibrary')document.getElementById('libraryImportPopover')?.hidePopover();
 for(const panel of root.querySelectorAll('.provider-panel'))panel.hidden=panel.id!==id;
 for(const tab of root.querySelectorAll('[role=tab]')){const active=tab.getAttribute('aria-controls')===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 root.querySelector('.dj-import-options').hidden=id!=='localLibrary';document.getElementById('trackCount').hidden=id!=='localLibrary';
 root.dispatchEvent(new CustomEvent('providerchange',{detail:id}));
}
export function providerKeys(e){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const tabs=[...e.currentTarget.parentElement.querySelectorAll('[role=tab]')].filter(tab=>!tab.hidden),index=tabs.indexOf(e.currentTarget);
 const next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length];next.click();next.focus();
}
