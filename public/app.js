'use strict';
const $ = id => document.getElementById(id);
const readStorage = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
const saveStorage = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* Storage can be disabled. */ } };
const state = {
  devices: [], selected: readStorage('localStorage', 'wiz-selected'),
  token: readStorage('sessionStorage', 'wiz-web-token') || '', meta: null,
  mode: null, sending: false, pending: null, timer: null, dragging: false,
  reading: new Set(), scanning: false, authenticated: false,
};
const PRESETS = [
  { name: 'Abendlicht', detail: 'Warm & gedimmt', color: '#e6b273', params: { state: true, dimming: 30, temp: 2700 } },
  { name: 'Lesen', detail: 'Hell & angenehm', color: '#f2ddaa', params: { state: true, dimming: 85, temp: 3500 } },
  { name: 'Fokus', detail: 'Klares Weiß', color: '#c8e3ef', params: { state: true, dimming: 100, temp: 5000 } },
  { name: 'Ozean', detail: 'Ruhiges Blau', color: '#70a6d2', params: { state: true, dimming: 55, r: 30, g: 120, b: 255 } },
  { name: 'Sonnenuntergang', detail: 'Warmes Orange', color: '#e28b68', params: { state: true, dimming: 60, r: 255, g: 75, b: 15 } },
  { name: 'Violett', detail: 'Ein wenig Farbe', color: '#b699d5', params: { state: true, dimming: 50, r: 155, g: 35, b: 255 } },
];
const selectedDevice = () => state.devices.find(d => d.ip === state.selected);
const text = (id, value) => { $(id).textContent = value; };
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function notice(message, kind = '') {
  $('notice').hidden = !message;
  $('notice').className = `notice ${kind}`;
  text('notice', message || '');
}
function openLogin() {
  state.authenticated = false;
  $('discover').disabled = true;
  if (!$('loginDialog').open) $('loginDialog').showModal();
}
async function api(path, { method = 'GET', data } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ['/api/connection','/api/discover'].includes(path)?30000:14000);
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (method !== 'GET') { headers['X-AnyDj-Local'] = '1'; headers['Content-Type'] = 'application/json'; }
  try {
    const response = await fetch(path, { method, headers, signal: controller.signal,
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401) openLogin();
      const error = new Error(body.error?.message || `HTTP-Fehler ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Die Webanfrage hat zu lange gedauert. Ein gesendeter Befehl könnte trotzdem angekommen sein. Status erneut lesen.');
    if (error instanceof TypeError) throw new Error('Keine Verbindung zur Webapp. Läuft der Node.js-Server noch?');
    throw error;
  } finally { clearTimeout(timeout); }
}
function upsert(device) {
  const index = state.devices.findIndex(d => d.ip === device.ip);
  if (index === -1) state.devices.push(device);
  // Do not let a delayed HTTP response replace newer confirmed device state.
  else if (!state.devices[index].lastSeen || !device.lastSeen ||
    device.lastSeen >= state.devices[index].lastSeen) state.devices[index] = device;
}
function output(id, value, unit) {
  const unitNode = document.createElement('span');
  unitNode.textContent = unit;
  $(id).replaceChildren(document.createTextNode(`${value} `), unitNode);
}
function renderList() {
  const focusedIP = document.activeElement?.dataset?.ip;
  $('deviceList').replaceChildren();
  text('deviceCount', state.devices.length);
  if (!state.devices.length) {
    const p = document.createElement('p'); p.className = 'small muted';
    p.textContent = 'Noch keine Lampe hinzugefügt.'; $('deviceList').append(p); return;
  }
  for (const device of state.devices) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'device-card'; button.dataset.ip = device.ip;
    button.setAttribute('aria-pressed', String(device.ip === state.selected));
    const icon = document.createElement('span'); icon.className = 'device-icon';
    icon.textContent = '◉'; icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span'); copy.className = 'device-copy';
    const name = document.createElement('strong'); name.textContent = device.name;
    const status = document.createElement('span');
    status.textContent = device.online === false ? 'Nicht erreichbar' : device.online !== true ? 'Noch nicht bestätigt' :
      `${device.pilot ? (device.pilot.state ? 'An' : 'Aus') : 'Gefunden'}${Number.isFinite(device.pilot?.dimming) ? ` · ${device.pilot.dimming} %` : ''}`;
    copy.append(name, status);
    const dot = document.createElement('span'); dot.className = `device-indicator ${device.online && device.pilot?.state ? 'on' : ''}`;
    button.append(icon, copy, dot);
    button.addEventListener('click', () => choose(device.ip));
    $('deviceList').append(button);
    if (focusedIP === device.ip) button.focus({ preventScroll: true });
  }
}
const rgbHex = pilot => '#' + ['r', 'g', 'b'].map(k => clamp(Math.round(pilot[k] || 0), 0, 255).toString(16).padStart(2, '0')).join('');
function kelvinPreview(kelvin) {
  const fraction = clamp((kelvin - 2200) / 4300, 0, 1);
  const a = [255, 188, 103], b = [207, 226, 255];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * fraction)).join(',')})`;
}
function setMode(mode) {
  const caps = selectedDevice()?.capabilities || {};
  if (mode === 'color' && caps.color === false) return;
  if (mode === 'white' && caps.temperature === false) return;
  state.mode = mode;
  $('whitePanel').hidden = mode !== 'white'; $('colorPanel').hidden = mode !== 'color';
  $('whiteTab').setAttribute('aria-selected', String(mode === 'white'));
  $('colorTab').setAttribute('aria-selected', String(mode === 'color'));
}
function render(syncControls = true) {
  renderList();
  const device = selectedDevice();
  $('emptyState').hidden = Boolean(device); $('lightPanel').hidden = !device;
  if (!device) return;
  const pilot = device.pilot || {};
  const caps = device.capabilities || {};
  text('lightName', device.name); text('lightAddress', `${device.ip} · ${state.meta?.demo ? 'Simulierte Lampe' : 'Lokale UDP-Verbindung'}`);
  $('power').setAttribute('aria-checked', String(Boolean(pilot.state)));
  $('power').setAttribute('aria-label', pilot.state ? 'Lampe ausschalten' : 'Lampe einschalten');
  $('power').disabled = !device.pilot || device.online !== true || device.musicActive || state.sending || Boolean(state.pending);
  text('powerText', pilot.state ? 'An' : 'Aus');
  text('deviceStatus', device.online === false ? 'Nicht erreichbar' : device.online !== true ? 'Nicht bestätigt' : pilot.state ? 'Eingeschaltet' : 'Ausgeschaltet');
  $('preview').classList.toggle('off', !pilot.state);
  const actualWhite = pilot.temp > 0;
  const actualColor = ['r', 'g', 'b'].every(k => Number.isFinite(pilot[k]));
  const actualScene = pilot.sceneId > 0;
  text('modeLabel', !device.pilot ? 'Status unbekannt' : actualScene ? `AnyDj-Szene ${pilot.sceneId}` : actualWhite ? 'Weißlicht' : actualColor ? 'RGB-Farbe' : 'Licht');
  text('reportedValue', !device.pilot ? '–' : !pilot.state ? 'Aus' : actualScene ? `${pilot.dimming ?? '–'} %` : actualWhite ? `${pilot.temp} K` : actualColor ? rgbHex(pilot).toUpperCase() : `${pilot.dimming ?? '–'} %`);
  text('lastSeen', device.lastSeen ? `Letzte Antwort · ${new Date(device.lastSeen).toLocaleTimeString('de-DE')}` : 'Noch keine Antwort von der Lampe');
  $('whiteTab').disabled = caps.temperature === false;
  $('colorTab').disabled = caps.color === false;
  $('brightness').disabled = !device.pilot || device.online !== true || device.musicActive || caps.brightness === false;
  $('temperature').disabled = !device.pilot || device.online !== true || device.musicActive || caps.temperature === false;
  for (const node of [$('color'), $('hex'), ...$('hexForm').querySelectorAll('button'), ...$('swatches').querySelectorAll('button')]) {
    node.disabled = !device.pilot || device.online !== true || device.musicActive || caps.color === false;
  }
  $('temperature').min = caps.minKelvin || 2200;
  $('temperature').max = caps.maxKelvin || 6500;
  text('minTemperature', `Warm · ${$('temperature').min} K`);
  text('maxTemperature', `Kühl · ${$('temperature').max} K`);
  text('rangeNote', caps.rangeReported ? 'Temperaturbereich von der Lampe gemeldet.' : 'Voreinstellung 2200–6500 K; tatsächlicher Modellbereich unbekannt.');
  text('capabilityNote', caps.color === null || caps.temperature === null ? 'Funktionen nicht vollständig erkannt. Nicht unterstützte Werte können ignoriert werden.' : caps.color === false ? 'Dieses Modell unterstützt keine RGB-Farben.' : '');
  if (!state.mode || (state.mode === 'color' && caps.color === false) || (state.mode === 'white' && caps.temperature === false)) {
    state.mode = actualWhite && caps.temperature !== false ? 'white' : caps.color !== false ? 'color' : 'white';
  }
  // A tab is a UI choice; merely opening a tab never sends a light command.
  $('whitePanel').hidden = state.mode !== 'white'; $('colorPanel').hidden = state.mode !== 'color';
  $('whiteTab').setAttribute('aria-selected', String(state.mode === 'white'));
  $('colorTab').setAttribute('aria-selected', String(state.mode === 'color'));
  if (syncControls && !state.dragging && !state.sending && !state.pending) {
    $('brightness').value = pilot.dimming || 65;
    output('brightnessValue', Number.isFinite(pilot.dimming) ? pilot.dimming : '–', '%');
    $('temperature').value = clamp(pilot.temp || Number($('temperature').value), Number($('temperature').min), Number($('temperature').max));
    output('temperatureValue', $('temperature').value, 'K');
    if (actualColor && pilot.r + pilot.g + pilot.b > 0) {
      $('color').value = rgbHex(pilot);
      if (document.activeElement !== $('hex')) $('hex').value = rgbHex(pilot).toUpperCase();
    }
    $('preview').style.setProperty('--light-color', actualWhite ? kelvinPreview(pilot.temp) : actualColor ? rgbHex(pilot) : '#ffcf8b');
  }
  for (const button of $('presets').querySelectorAll('button')) {
    const preset = PRESETS[Number(button.dataset.index)];
    button.disabled = !device.pilot || device.online !== true || device.musicActive || ('temp' in preset.params ? caps.temperature === false : caps.color === false) || caps.brightness === false;
  }
  text('diagIp', device.ip); text('diagMac', device.mac || 'Nicht gemeldet');
  text('diagModule', device.system?.moduleName || 'Nicht erkannt'); text('diagFirmware', device.system?.fwVersion || 'Nicht gemeldet');
  if (document.activeElement !== $('rename')) $('rename').value = device.name;
  text('rawData', JSON.stringify({ mode: state.meta?.demo ? 'demo' : 'local-udp', ...device }, null, 2));
}
async function refresh(silent = false) {
  const ip = state.selected;
  if (!ip || state.reading.has(ip)) return;
  const wasOffline=selectedDevice()?.online===false;
  state.reading.add(ip);
  try {
    if (!silent) notice('Verbindung zur Lampe wird geprüft …');
    const result = await api('/api/connection', { method: 'POST', data: { ip, force: !silent } });
    state.devices = result.devices;
    if (result.device) upsert(result.device);
    if (state.selected === ip && result.device) {
      state.selected = result.device.ip;
      saveStorage('localStorage', 'wiz-selected', state.selected);
    }
    render(!state.sending && !state.pending);
    if (!['ready', 'music'].includes(result.state) || !silent || wasOffline) {
      notice(result.message, result.state === 'ready' ? '' : 'warning');
      if (result.setupUrl) { const link = document.createElement('a'); link.href = result.setupUrl; link.textContent = ' WLAN-Einrichtung öffnen'; $('notice').append(link); }
    }
    text('footerStatus', result.message);
  } catch (error) {
    const device = state.devices.find(d => d.ip === ip);
    if (device && !state.sending && !state.pending) { device.online = false; device.lastError = error.message; }
    if (state.selected === ip) render(false);
    if (!silent && error.status !== 401) notice(error.message, 'error');
    text('footerStatus', 'Statusabfrage nicht erfolgreich');
  } finally { state.reading.delete(ip); }
}
async function choose(ip) {
  if (state.selected !== ip) {
    clearTimeout(state.timer); state.pending = null;
    state.selected = ip; state.mode = null;
    saveStorage('localStorage', 'wiz-selected', ip);
  }
  render();
  await refresh();
}
function setInterfaces(interfaces) {
  const value = $('interface').value;
  $('interface').replaceChildren(new Option('Alle lokalen Netzwerke', ''));
  for (const item of interfaces || []) $('interface').add(new Option(`${item.name} · ${item.address}`, item.address));
  if ([...$('interface').options].some(x => x.value === value)) $('interface').value = value;
}
async function loadDevices() {
  const result = await api('/api/devices');
  state.devices = result.devices;
  setInterfaces(result.interfaces);
  state.authenticated = true;
  $('discover').disabled = false;
  if (!state.devices.some(x => x.ip === state.selected)) state.selected = state.devices[0]?.ip || null;
  render();
  if (state.selected) await refresh();
  else {
    notice('Suche automatisch nach einer Lampe …');
    state.scanning = true;
    try {
      const checked = await api('/api/connection', { method: 'POST', data: {} });
      state.devices = checked.devices; state.selected = checked.device?.ip || null; render(); notice(checked.message);
    } finally { state.scanning = false; }
  }
}
let searchRetryTimer, searchUntil=0;
async function discover(retry = false) {
  if (state.scanning || !state.authenticated) return;
  clearTimeout(searchRetryTimer);
  if(retry!==true)searchUntil=Date.now()+90000;
  state.scanning = true; $('discover').disabled = true; text('discover', 'Suche läuft …');
  notice('AnyDj-Geräte im lokalen Netzwerk werden gesucht. Es werden keine Lichtzustände verändert.');
  try {
    const result = await api('/api/discover', { method: 'POST', data: { interface: $('interface').value } });
    for (const device of result.devices) upsert(device);
    // Drop stale IPs replaced by a rediscovered MAC on the backend.
    state.devices = state.devices.filter(x => result.devices.some(y => y.ip === x.ip));
    if (!state.devices.some(x => x.ip === state.selected)) state.selected = null;
    const found = result.found.length;
    const missingSelected=state.selected && !result.found.includes(state.selected);
    if((!found || missingSelected)&&Date.now()<searchUntil)searchRetryTimer=setTimeout(()=>{if(!document.hidden)void discover(true);},8000);
    notice(found ? `${found} ${found === 1 ? 'Lampe hat' : 'Lampen haben'} geantwortet.${result.warnings.length ? ' Hinweise stehen unten.' : ''}` :
      (Date.now()<searchUntil?'Noch keine Antwort. Nach dem Einschalten braucht die Lampe Zeit für das WLAN. Die Suche wird bis zu 90 Sekunden wiederholt.':'Lampe noch nicht erreichbar. Die regelmäßige Verbindungsprüfung läuft weiter.'), found ? '' : 'warning');
    if (result.warnings.length) notice(`${found} Gerät(e) gefunden. ${result.warnings.join(' · ')}`, 'warning');
    render();
    if (!state.selected && result.found.length) await choose(result.found[0]);
    else if (state.selected && result.found.includes(state.selected)) await refresh(true);
  } catch (error) { if (error.status !== 401) notice(error.message, 'error'); }
  finally { state.scanning = false; $('discover').disabled = !state.authenticated; text('discover', '⌕ Lampen suchen'); }
}

/** Coalesce slider input, keep only the newest unsent color mode and never send
 * parallel control commands. A pending edit always belongs to its original IP.
 */
function enqueue(params, immediate = false) {
  const ip = state.selected;
  if (!ip) return;
  let merged = state.pending?.ip === ip ? { ...state.pending.params } : {};
  if ('temp' in params) for (const key of ['r', 'g', 'b']) delete merged[key];
  if ('r' in params) delete merged.temp;
  if (params.state === false) merged = {};
  Object.assign(merged, params);
  state.pending = { ip, params: merged };
  clearTimeout(state.timer);
  $('power').disabled = true;
  text('footerStatus', 'Änderung wird gesendet …');
  state.timer = setTimeout(sendNext, immediate ? 0 : 220);
}
async function sendNext() {
  if (state.sending || !state.pending) return;
  const next = state.pending;
  state.pending = null; state.sending = true;
  try {
    const result = await api(`/api/devices/${encodeURIComponent(next.ip)}/pilot`, { method: 'POST', data: next.params });
    upsert(result.device);
    if (result.warning) notice(result.warning, 'warning');
    else { notice(''); text('footerStatus', state.meta?.demo ? 'Änderung simuliert · Keine echte Lampe' : 'Lampe hat geantwortet · Status aktualisiert'); }
  } catch (error) {
    const device = state.devices.find(d => d.ip === next.ip);
    if (device) { device.lastError = error.message; device.online = null; }
    if (error.status !== 401) notice(error.message, 'error');
    text('footerStatus', 'Änderung nicht bestätigt · Status neu lesen');
  } finally {
    state.sending = false;
    render(!state.pending);
    if (state.pending) void sendNext();
  }
}
function requestColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || hex.toLowerCase() === '#000000') {
    notice('Bitte eine Farbe außer #000000 wählen. Zum Ausschalten den Ein/Aus-Schalter verwenden.', 'warning'); return;
  }
  const values = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  $('color').value = hex; $('hex').value = hex.toUpperCase();
  $('preview').style.setProperty('--light-color', hex);
  enqueue({ state: true, r: values[0], g: values[1], b: values[2] });
}
function buildPresets() {
  PRESETS.forEach((preset, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'preset'; button.dataset.index = index;
    const dot = document.createElement('span'); dot.className = 'preset-dot'; dot.style.setProperty('--preset', preset.color);
    const copy = document.createElement('span'); copy.className = 'preset-copy';
    const name = document.createElement('strong'); name.textContent = preset.name;
    const detail = document.createElement('span'); detail.textContent = preset.detail;
    copy.append(name, detail); button.append(dot, copy);
    button.addEventListener('click', () => {
      const params = { ...preset.params }, caps = selectedDevice()?.capabilities;
      if ('temp' in params) {
        params.temp = clamp(params.temp, caps?.minKelvin || 2200, caps?.maxKelvin || 6500);
        setMode('white');
      } else setMode('color');
      enqueue(params, true);
    });
    $('presets').append(button);
  });
  const colors = [ ['#FF7835', 'Orange'], ['#F44266', 'Pink'], ['#B959FF', 'Violett'], ['#388FFF', 'Blau'], ['#44DCD0', 'Türkis'], ['#95E8AF', 'Grün'] ];
  for (const [color, name] of colors) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch';
    button.style.setProperty('--swatch', color); button.setAttribute('aria-label', name); button.title = name;
    button.addEventListener('click', () => requestColor(color)); $('swatches').append(button);
  }
}
$('discover').addEventListener('click', () => discover());
$('power').addEventListener('click', () => enqueue({ state: !selectedDevice()?.pilot?.state }, true));
$('whiteTab').addEventListener('click', () => setMode('white'));
$('colorTab').addEventListener('click', () => setMode('color'));
for (const id of ['brightness', 'temperature']) {
  $(id).addEventListener('pointerdown', () => { state.dragging = true; });
}
window.addEventListener('pointerup', () => { state.dragging = false; });
window.addEventListener('pointercancel', () => { state.dragging = false; });
window.addEventListener('blur', () => { state.dragging = false; });
$('brightness').addEventListener('input', () => {
  const dimming = Number($('brightness').value); output('brightnessValue', dimming, '%'); enqueue({ state: true, dimming });
});
$('temperature').addEventListener('input', () => {
  const temp = Number($('temperature').value); output('temperatureValue', temp, 'K');
  $('preview').style.setProperty('--light-color', kelvinPreview(temp)); enqueue({ state: true, temp });
});
$('color').addEventListener('input', () => requestColor($('color').value));
$('hexForm').addEventListener('submit', event => { event.preventDefault(); requestColor($('hex').value.trim()); });
$('refresh').addEventListener('click', () => refresh());
$('addForm').addEventListener('submit', async event => {
  event.preventDefault(); $('addButton').disabled = true; text('addButton', 'Prüfe Verbindung …');
  try {
    const result = await api('/api/devices', { method: 'POST', data: { ip: $('newIp').value.trim(), name: $('newName').value.trim() } });
    state.devices = result.devices; state.selected = result.device.ip; state.mode = null;
    saveStorage('localStorage', 'wiz-selected', state.selected);
    $('addDetails').open = false; $('addForm').reset(); render(); notice('Lampe verbunden. Ihr könnt sie jetzt steuern.');
  } catch (error) { if (error.status !== 401) notice(error.message, 'error'); }
  finally { $('addButton').disabled = false; text('addButton', 'Verbinden'); }
});
$('renameForm').addEventListener('submit', async event => {
  event.preventDefault(); const ip = state.selected;
  try {
    const result = await api(`/api/devices/${encodeURIComponent(ip)}`, { method: 'PATCH', data: { name: $('rename').value.trim() } });
    upsert(result.device); render(false); notice('Name lokal gespeichert. Der Name in der AnyDj-App wurde nicht verändert.');
  } catch (error) { notice(error.message, 'error'); }
});
$('remove').addEventListener('click', async () => {
  const device = selectedDevice();
  if (!device || !confirm(`„${device.name}“ nur aus dieser Webapp entfernen? Die Lampe wird nicht zurückgesetzt.`)) return;
  clearTimeout(state.timer); state.pending = null;
  try {
    const result = await api(`/api/devices/${encodeURIComponent(device.ip)}`, { method: 'DELETE', data: {} });
    state.devices = result.devices; state.selected = null; state.mode = null; render();
    if (state.devices.length) await choose(state.devices[0].ip);
    notice('Lampe aus der Liste entfernt. Sie bleibt unverändert im WLAN.');
  } catch (error) { notice(error.message, 'error'); }
});
$('loginDialog').addEventListener('cancel', event => event.preventDefault());
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); state.token = $('webToken').value.trim(); text('loginError', '');
  try {
    await loadDevices(); saveStorage('sessionStorage', 'wiz-web-token', state.token);
    $('loginDialog').close(); $('webToken').value = '';
    if (state.meta.demo && !state.devices.length) await discover();
  } catch (error) { text('loginError', error.message); }
});
async function init() {
  buildPresets();
  try {
    state.meta = await api('/api/meta'); $('demoBanner').hidden = !state.meta.demo;
    text('footerStatus', state.meta.demo ? 'Demo · Keine echte Lampe verbunden' : 'Server bereit · UDP 38899');
    if (state.meta.tokenRequired && !state.token) { openLogin(); return; }
    await loadDevices();
    if (state.meta.demo && !state.devices.length) await discover();
  } catch (error) { if (error.status !== 401) notice(error.message, 'error'); }
}
setInterval(() => {
  if (state.authenticated && !document.hidden && state.selected && !state.sending && !state.pending && !state.dragging && !state.scanning && !$('loginDialog').open) void refresh(true);
}, 5000);
setInterval(() => { if (state.authenticated && !document.hidden && !state.selected && !state.scanning) void loadDevices().catch(error => notice(error.message, 'error')); }, 15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.authenticated&&!state.scanning&&state.selected)void refresh();});
window.addEventListener('online',()=>{if(state.authenticated&&state.selected)void refresh();});
window.addEventListener('pagehide',()=>clearTimeout(searchRetryTimer));
void init();
