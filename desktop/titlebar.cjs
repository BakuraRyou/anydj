// Sandboxed preload: only these window actions cross into the main process.
// No Node API or general-purpose IPC bridge is exposed to the page.
const {ipcRenderer,contextBridge,webUtils}=require('electron');
contextBridge.exposeInMainWorld('anydjFiles',{
 remember:(id,file)=>{const path=webUtils.getPathForFile(file);return path?ipcRenderer.invoke('anydj:remember-audio',{id,path}):Promise.resolve(false);},
 read:id=>ipcRenderer.invoke('anydj:read-audio',id),
 forget:id=>ipcRenderer.invoke('anydj:forget-audio',id)
});
window.addEventListener('DOMContentLoaded',()=>{
 if(window!==window.top)return;
 const style=document.createElement('style');
 style.textContent=`
 html.anydj-desktop {--desktop-titlebar-height:34px}
 html.anydj-desktop body {padding-top:var(--desktop-titlebar-height)}
 html.anydj-desktop .dj-page>.shell {height:calc(100dvh - var(--desktop-titlebar-height));min-height:0}
 .desktop-titlebar {position:fixed;inset:0 0 auto;height:var(--desktop-titlebar-height);z-index:2147483647;display:flex;align-items:center;gap:8px;padding-left:14px;background:var(--surface-base,#0b0c10);color:var(--content-secondary,#a6a9b6);border-bottom:1px solid var(--border-subtle,#2b2e38);box-sizing:border-box;font:12px system-ui,sans-serif;user-select:none;-webkit-app-region:drag}
 .desktop-titlebar img {width:17px;height:19px;pointer-events:none}
 .desktop-titlebar strong {font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--content-primary,#f4f5f7)}
 html.anydj-desktop .desktop-titlebar>.topbar {display:flex;flex:1;min-width:0;min-height:0;height:100%;margin:0 0 0 20px;padding:0;gap:10px;justify-content:flex-end;flex-wrap:nowrap;background:transparent;border:0;-webkit-app-region:drag}
 html.anydj-desktop .desktop-titlebar>.topbar>:is(.brand,nav) {display:none}
 html.anydj-desktop .desktop-titlebar>.topbar :is(button,a,details,select,input) {-webkit-app-region:no-drag}
 html.anydj-desktop .desktop-titlebar>.topbar .button {min-height:26px;height:26px;padding:0 10px;font-size:11px}
 html.anydj-desktop .desktop-titlebar>.topbar .dj-settings {position:relative;font-size:11px;margin-right:10px}
 html.anydj-desktop .desktop-titlebar>.topbar .dj-settings>div {top:calc(100% + 10px);right:0}
 .desktop-titlebar[data-modal=true]>.topbar {visibility:hidden}
 .desktop-window-controls {display:flex;margin-left:auto;height:100%;-webkit-app-region:no-drag}
 .desktop-window-controls button {display:grid;place-items:center;width:44px;height:100%;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:inherit;cursor:default;-webkit-app-region:no-drag}
 .desktop-window-controls button:hover {background:var(--surface-raised,#1c1e26);color:var(--content-primary,#f4f5f7)}
 .desktop-window-controls button:focus-visible {outline:2px solid var(--brand-accent,#c4f567);outline-offset:-3px}
 .desktop-window-controls button[data-action=close]:hover {background:#c43c48;color:#fff}
 .desktop-window-controls svg {width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.3;pointer-events:none}
 .desktop-titlebar[data-focused=false] :is(img,strong) {opacity:.5}
 .desktop-titlebar[data-platform=darwin] {padding-left:82px}
 .desktop-titlebar[data-platform=darwin] .desktop-window-controls {display:none}
 html.anydj-desktop .stage-show-shell {top:var(--desktop-titlebar-height)!important;height:calc(100dvh - var(--desktop-titlebar-height))!important}
 html.anydj-desktop.desktop-fullscreen {--desktop-titlebar-height:0px}
 html.desktop-fullscreen .desktop-titlebar {display:none}
 `;
 document.head.append(style);
 const bar=document.createElement('header');
 bar.className='desktop-titlebar';bar.setAttribute('aria-label','Fensterleiste');
 bar.innerHTML=`<img src="/animatus-small.svg" alt=""><strong>AnyDj</strong><div class="desktop-window-controls">
 <button type="button" data-action="minimize" aria-label="Minimieren" title="Minimieren"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5h10"/></svg></button>
 <button type="button" data-action="maximize" aria-label="Maximieren" title="Maximieren"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z"/></svg></button>
 <button type="button" data-action="close" aria-label="Schließen" title="Schließen"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9"/></svg></button></div>`;
 // Move the existing controls, preserving their listeners and settings state.
 const toolbar=document.querySelector('.dj-page>.shell>.topbar');
 if(toolbar)bar.insertBefore(toolbar,bar.querySelector('.desktop-window-controls'));
 document.body.prepend(bar);
 document.documentElement.classList.add('anydj-desktop');
 // A modal makes DOM outside it inert. Keep window controls operable while
 // editing/export dialogs are open, then return the bar to the document.
 const place=()=>{
  const modal=[...document.querySelectorAll('dialog:modal')].at(-1),parent=modal||document.body;
  bar.dataset.modal=String(!!modal);
  if(toolbar)toolbar.inert=!!modal;
  if(bar.parentElement!==parent)parent.prepend(bar);
 };
 for(const name of ['toggle','close'])document.addEventListener(name,event=>{
  if(event.target instanceof HTMLDialogElement)place();
 },true);
 bar.addEventListener('click',event=>{
  const action=event.target.closest('button[data-action]')?.dataset.action;
  if(action)ipcRenderer.send('anydj:window-action',action);
 });
 const update=state=>{
  if(!state)return;
  bar.dataset.platform=state.platform;bar.dataset.focused=String(state.focused);
  document.documentElement.classList.toggle('desktop-fullscreen',state.fullscreen);
  const button=bar.querySelector('[data-action=maximize]'),label=state.maximized?'Wiederherstellen':'Maximieren';
  button.title=label;button.setAttribute('aria-label',label);
  button.querySelector('path').setAttribute('d',state.maximized?'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7':'M3.5 3.5h9v9h-9z');
 };
 ipcRenderer.on('anydj:window-state',(_event,state)=>update(state));
 void ipcRenderer.invoke('anydj:window-state').then(update);
});
