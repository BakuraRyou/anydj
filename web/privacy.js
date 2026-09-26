import {measurementId} from './analytics-config.js';

const KEY='anydj-privacy-v1',VERSION=1,DAYS=180,LIFETIME=DAYS*86400_000;
const configured=/^G-[A-Z0-9]{6,}$/.test(measurementId);
const base=new URL('./',import.meta.url);
// Never load Analytics in the DJ app or OAuth callbacks, even with prior consent.
const pages=['','index.html','downloads.html','impressum.html','datenschutz.html'];
const analyticsPage=pages.some(page=>new URL(page,base).pathname===location.pathname);
const panel=document.getElementById('privacy-panel');
const accept=document.getElementById('privacy-accept'),reject=document.getElementById('privacy-reject');
const close=document.getElementById('privacy-close'),status=document.getElementById('privacy-status');
let choice=readChoice(),loaded=false,expiryTimer,previousFocus,storageBlocked=false;

function readChoice(){
  try{
    const value=JSON.parse(localStorage.getItem(KEY)),now=Date.now();
    if(value?.version===VERSION&&value.measurementId===measurementId&&typeof value.analytics==='boolean'
      &&Number.isFinite(value.savedAt)&&value.savedAt<=now&&value.expiresAt===value.savedAt+LIFETIME&&value.expiresAt>now)return value;
  }catch{ /* Blocked or corrupt storage never authorizes tracking. */ }
  return null;
}

function deleteAnalyticsCookies(){
  // Remove host-only and previously created parent-domain/path variants.
  const parts=location.hostname.split('.'),domains=[''];
  for(let i=0;i<parts.length;i++)domains.push(parts.slice(i).join('.'));
  const paths=new Set(['/']);let path='';
  for(const part of location.pathname.split('/').slice(1,-1)){path+='/'+part;paths.add(path);paths.add(path+'/');}
  for(const item of document.cookie.split(';')){
    const name=item.trim().split('=')[0];if(!/^_ga(?:_|$)/.test(name))continue;
    for(const domain of domains)for(const cookiePath of paths){
      document.cookie=`${name}=; Max-Age=0; Path=${cookiePath}; SameSite=Lax${domain?`; Domain=${domain}`:''}${location.protocol==='https:'?'; Secure':''}`;
    }
  }
}

function stopAnalytics(reload=true){
  if(configured)window[`ga-disable-${measurementId}`]=true;
  deleteAnalyticsCookies();
  if(loaded){
    // Unload Google's runtime as well as stopping collection. Do not send a
    // denied-consent update, which could produce cookieless consent pings.
    document.getElementById('anydj-google-tag')?.remove();
    if(reload)location.reload();
  }
}

function startAnalytics(){
  if(!configured||!analyticsPage||!choice?.analytics||loaded)return;
  loaded=true;window[`ga-disable-${measurementId}`]=false;
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag=gtag;
  gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('consent','update',{analytics_storage:'granted'});
  gtag('js',new Date());
  gtag('config',measurementId,{
    allow_google_signals:false,allow_ad_personalization_signals:false,
    cookie_domain:'none',cookie_path:base.pathname,cookie_expires:DAYS*86400,cookie_update:false,
    cookie_flags:location.protocol==='https:'?'SameSite=Lax;Secure':'SameSite=Lax',
    // Strip query/hash and referrer: no search terms, OAuth codes or email URLs.
    page_location:location.origin+location.pathname,page_referrer:'',page_title:document.title,
    send_page_view:true
  });
  const script=document.createElement('script');script.id='anydj-google-tag';script.async=true;
  script.referrerPolicy='no-referrer';script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

function scheduleExpiry(){
  clearTimeout(expiryTimer);
  if(choice)expiryTimer=setTimeout(refresh,Math.min(Math.max(1,choice.expiresAt-Date.now()),2147483647));
}

function show(focus=false){
  if(panel.hidden)previousFocus=document.activeElement;
  panel.hidden=false;
  accept.hidden=!configured;reject.hidden=!configured;
  close.hidden=configured&&!choice;
  status.textContent=!configured?'Google Analytics ist auf dieser Website derzeit deaktiviert.'
    :choice?.analytics?'Deine aktuelle Auswahl: Analytics erlaubt. Mit „Nur notwendige“ widerrufst du deine Einwilligung.'
    :choice?'Deine aktuelle Auswahl: nur notwendige Speicherung.':'';
  if(focus)(configured?reject:close).focus();
}

function hide(){panel.hidden=true;previousFocus?.focus?.();}

function save(analytics){
  const savedAt=Date.now(),resumeAfterFailure=loaded&&storageBlocked;
  const next={version:VERSION,measurementId,analytics,savedAt,expiresAt:savedAt+LIFETIME};
  try{localStorage.setItem(KEY,JSON.stringify(next));choice=next;storageBlocked=false;}
  catch{
    choice=null;storageBlocked=true;clearTimeout(expiryTimer);stopAnalytics(false);
    try{localStorage.removeItem(KEY);}catch{}
    status.textContent='Dein Browser kann die Auswahl nicht speichern. Analytics bleibt deaktiviert.';
    close.hidden=false;return;
  }
  hide();scheduleExpiry();
  if(analytics){if(resumeAfterFailure)location.reload();else startAnalytics();}else stopAnalytics();
}

function refresh(){
  if(storageBlocked)return;
  choice=readChoice();scheduleExpiry();
  if(choice?.analytics)startAnalytics();else stopAnalytics();
  if(!panel.hidden)show();
  else if(!choice&&configured&&analyticsPage)show();
}

accept.addEventListener('click',()=>save(true));reject.addEventListener('click',()=>save(false));
close.addEventListener('click',hide);
panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!close.hidden){event.preventDefault();hide();}});
for(const button of document.querySelectorAll('[data-privacy-settings]')){
  button.hidden=false;button.addEventListener('click',()=>{refresh();show(true);});
}
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)refresh();});
window.addEventListener('pageshow',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();
