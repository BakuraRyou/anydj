import {createVRPreviewRelay} from './lib/vr-preview.mjs';
import http from 'node:http';
import https from 'node:https';
import {DmxConnection} from './lib/dmx.mjs';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { AppError, WizClient, assertLocalIP, validatePilot, capabilities } from './lib/wiz.mjs';
import { DemoClient } from './lib/demo.mjs';
import { SetupClient } from './lib/setup.mjs';
import { AutoRecovery } from './lib/recovery.mjs';
import { RecoveryMonitor } from './lib/recovery-monitor.mjs';
import { setupNetworkStatus } from './lib/connection.mjs';
import { MusicSession } from './lib/music.mjs';
import { BeatAnalysis } from './lib/beat-analysis.mjs';
import { StyleAnalysis } from './lib/style-analysis.mjs';
import { StructureAnalysis } from './lib/structure-analysis.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VERSION = '0.1.0';
const STATIC = new Map([
  ['/vr-test', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-test/', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-view', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-view.js', ['vr-view.js', 'text/javascript; charset=utf-8']],
  ['/vr-view.css', ['vr-view.css', 'text/css; charset=utf-8']],
  ['/dmx-vr-share.js', ['dmx-vr-share.js', 'text/javascript; charset=utf-8']],
  ['/brand.css', ['brand.css', 'text/css; charset=utf-8']],
  ['/transition-timeline.js', ['transition-timeline.js', 'text/javascript; charset=utf-8']],
  ['/animatus-small.svg', ['animatus-small.svg', 'image/svg+xml']],
  ['/transition-audio.js', ['transition-audio.js', 'text/javascript; charset=utf-8']],
  ['/transition-curve-editor.js', ['transition-curve-editor.js', 'text/javascript; charset=utf-8']],
  ['/transition-library.js', ['transition-library.js', 'text/javascript; charset=utf-8']],
  ['/transition-links.js', ['transition-links.js', 'text/javascript; charset=utf-8']],
  ['/setlist-transition.js', ['setlist-transition.js', 'text/javascript; charset=utf-8']],
  ['/transition-preview.js', ['transition-preview.js', 'text/javascript; charset=utf-8']],
  ['/musical-transition.js', ['musical-transition.js', 'text/javascript; charset=utf-8']],
  ['/stage-motion.js', ['stage-motion.js', 'text/javascript; charset=utf-8']],
  ['/stage-motifs.js', ['stage-motifs.js', 'text/javascript; charset=utf-8']],
  ['/dmx-connection.js', ['dmx-connection.js', 'text/javascript; charset=utf-8']],
  ['/dmx-activity.js', ['dmx-activity.js', 'text/javascript; charset=utf-8']],
  ['/dmx-auto.js', ['dmx-auto.js', 'text/javascript; charset=utf-8']],
  ['/dmx-show.js', ['dmx-show.js', 'text/javascript; charset=utf-8']],
  ['/dmx-editor.js', ['dmx-editor.js', 'text/javascript; charset=utf-8']],
  ['/dmx-fixture-library.js', ['dmx-fixture-library.js', 'text/javascript; charset=utf-8']],
  ['/dmx-model.js', ['dmx-model.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage.js', ['dmx-stage.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-heads.js', ['dmx-moving-heads.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-model.js', ['dmx-moving-model.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-plan.js', ['dmx-moving-plan.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-direction.js', ['dmx-moving-direction.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-cues.js', ['dmx-moving-cues.js', 'text/javascript; charset=utf-8']],
  ['/dmx-moving-moods.js', ['dmx-moving-moods.js', 'text/javascript; charset=utf-8']],
  ['/dmx-layout.js', ['dmx-layout.js', 'text/javascript; charset=utf-8']],
  ['/dmx-layout-model.js', ['dmx-layout-model.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage.css', ['dmx-stage.css', 'text/css; charset=utf-8']],
  ['/dj-waveform.js', ['dj-waveform.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-transport.js', ['dmx-stage-transport.js', 'text/javascript; charset=utf-8']],
  ['/dmx-room.js', ['dmx-room.js', 'text/javascript; charset=utf-8']],
  ['/dmx-zone-plan.js', ['dmx-zone-plan.js', 'text/javascript; charset=utf-8']],
  ['/dmx-zone-motion.js', ['dmx-zone-motion.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-workspace.js', ['dmx-stage-workspace.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-setup.js', ['dmx-vr-setup.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-playback.js', ['dmx-vr-playback.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-vr.js', ['dmx-stage-vr.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-console.js', ['dmx-vr-console.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d.js', ['dmx-stage-3d.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d-renderer.js', ['dmx-stage-3d-renderer.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d.css', ['dmx-stage-3d.css', 'text/css; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/setup', ['setup.html', 'text/html; charset=utf-8']],
  ['/setup.js', ['setup.js', 'text/javascript; charset=utf-8']],
  ['/editor', ['editor.html', 'text/html; charset=utf-8']],
  ['/editor.js', ['editor.js', 'text/javascript; charset=utf-8']],
  ['/editor-model.js', ['editor-model.js', 'text/javascript; charset=utf-8']],
  ['/music', ['music.html', 'text/html; charset=utf-8']],
  ['/dj', ['dj.html', 'text/html; charset=utf-8']],
  ['/tidal-callback.html', ['tidal-callback.html', 'text/html; charset=utf-8']],
  ['/tidal-auth.js', ['tidal-auth.js', 'text/javascript; charset=utf-8']],
  ['/tidal-client.js', ['tidal-client.js', 'text/javascript; charset=utf-8']],
  ['/tidal-library.js', ['tidal-library.js', 'text/javascript; charset=utf-8']],
  ['/provider-tabs.js', ['provider-tabs.js', 'text/javascript; charset=utf-8']],
  ['/spotify-callback.html', ['spotify-callback.html', 'text/html; charset=utf-8']],
  ['/spotify-auth.js', ['spotify-auth.js', 'text/javascript; charset=utf-8']],
  ['/provider-queue.js', ['provider-queue.js', 'text/javascript; charset=utf-8']],
  ['/spotify-playback.js', ['spotify-playback.js', 'text/javascript; charset=utf-8']],
  ['/spotify-client.js', ['spotify-client.js', 'text/javascript; charset=utf-8']],
  ['/spotify-library.js', ['spotify-library.js', 'text/javascript; charset=utf-8']],
  ['/spotify-library.css', ['spotify-library.css', 'text/css; charset=utf-8']],
  ['/dj-color-modes.js', ['dj-color-modes.js', 'text/javascript; charset=utf-8']],
  ['/dj-color-picker.js', ['dj-color-picker.js', 'text/javascript; charset=utf-8']],
  ['/beat-sync.js', ['beat-sync.js', 'text/javascript; charset=utf-8']],
  ['/dj-performance.js', ['dj-performance.js', 'text/javascript; charset=utf-8']],
  ['/dj-performance-model.js', ['dj-performance-model.js', 'text/javascript; charset=utf-8']],
  ['/dj-session.js', ['dj-session.js', 'text/javascript; charset=utf-8']],
  ['/dj-layout.js', ['dj-layout.js', 'text/javascript; charset=utf-8']],
  ['/dj-layout.css', ['dj-layout.css', 'text/css; charset=utf-8']],
  ['/dj-tutorial.js', ['dj-tutorial.js', 'text/javascript; charset=utf-8']],
  ['/tutorial.json', ['tutorial.json', 'application/json; charset=utf-8']],
  ['/dj.js', ['dj.js', 'text/javascript; charset=utf-8']],
  ['/light-tuning.js', ['light-tuning.js', 'text/javascript; charset=utf-8']],
  ['/light-flicker.js', ['light-flicker.js', 'text/javascript; charset=utf-8']],
  ['/dj-full.js', ['dj-full.js', 'text/javascript; charset=utf-8']],
  ['/dj-full.css', ['dj-full.css', 'text/css; charset=utf-8']],
  ['/dj-shuffle.js', ['dj-shuffle.js', 'text/javascript; charset=utf-8']],
  ['/dj-model.js', ['dj-model.js', 'text/javascript; charset=utf-8']],
  ['/color-choreography.js', ['color-choreography.js', 'text/javascript; charset=utf-8']],
  ['/section-lighting.js', ['section-lighting.js', 'text/javascript; charset=utf-8']],
  ['/section-editor.js', ['section-editor.js', 'text/javascript; charset=utf-8']],
  ['/light-editor.js', ['light-editor.js', 'text/javascript; charset=utf-8']],
  ['/light-editor-model.js', ['light-editor-model.js', 'text/javascript; charset=utf-8']],
  ['/light-editor-timeline.js', ['light-editor-timeline.js', 'text/javascript; charset=utf-8']],
  ['/light-editor.css', ['light-editor.css', 'text/css; charset=utf-8']],
  ['/dj-show-profile.js', ['dj-show-profile.js', 'text/javascript; charset=utf-8']],
  ['/dj-status.js', ['dj-status.js', 'text/javascript; charset=utf-8']],
  ['/dj-folder.js', ['dj-folder.js', 'text/javascript; charset=utf-8']],
  ['/dj-library.js', ['dj-library.js', 'text/javascript; charset=utf-8']],
  ['/color-profile.js', ['color-profile.js', 'text/javascript; charset=utf-8']],
  ['/local-cover.js', ['local-cover.js', 'text/javascript; charset=utf-8']],
  ['/dj.css', ['dj.css', 'text/css; charset=utf-8']],
  ['/audio-analysis.js', ['audio-analysis.js', 'text/javascript; charset=utf-8']],
  ['/audio-worklet.js', ['audio-worklet.js', 'text/javascript; charset=utf-8']],
  ['/live-analysis.js', ['live-analysis.js', 'text/javascript; charset=utf-8']],
  ['/spectral-analysis.js', ['spectral-analysis.js', 'text/javascript; charset=utf-8']],
  ['/melody-analysis.js', ['melody-analysis.js', 'text/javascript; charset=utf-8']],
  ['/mood-analysis.js', ['mood-analysis.js', 'text/javascript; charset=utf-8']],
  ['/show-patterns.js', ['show-patterns.js', 'text/javascript; charset=utf-8']],
  ['/show-arrangement.js', ['show-arrangement.js', 'text/javascript; charset=utf-8']],
  ['/musical-attention.js', ['musical-attention.js', 'text/javascript; charset=utf-8']],
  ['/show-clock.js', ['show-clock.js', 'text/javascript; charset=utf-8']],
  ['/color-direction.js', ['color-direction.js', 'text/javascript; charset=utf-8']],
  ['/song-palette.js', ['song-palette.js', 'text/javascript; charset=utf-8']],
  ['/show-plan.js', ['show-plan.js', 'text/javascript; charset=utf-8']],
  ['/automatic-settings.js', ['automatic-settings.js', 'text/javascript; charset=utf-8']],
  ['/music-style.js', ['music-style.js', 'text/javascript; charset=utf-8']],
  ['/style-analysis.js', ['style-analysis.js', 'text/javascript; charset=utf-8']],
  ['/song-structure.js', ['song-structure.js', 'text/javascript; charset=utf-8']],
  ['/instrument-activity.js', ['instrument-activity.js', 'text/javascript; charset=utf-8']],
  ['/structure-analysis.js', ['structure-analysis.js', 'text/javascript; charset=utf-8']],
  ['/show-worker.js', ['show-worker.js', 'text/javascript; charset=utf-8']],
  ['/beat-grid.js', ['beat-grid.js', 'text/javascript; charset=utf-8']],
  ['/beat-analysis.js', ['beat-analysis.js', 'text/javascript; charset=utf-8']],
  ['/music.js', ['music.js', 'text/javascript; charset=utf-8']],
]);
const validName = value => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60 || /[\x00-\x1f]/.test(value)) {
    throw new AppError('Der Name muss zwischen 1 und 60 Zeichen lang sein.');
  }
  return value.trim();
};
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
async function bodyJSON(req,limit=8192) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw new AppError('Content-Type application/json erforderlich.', 415);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new AppError('Anfrage ist zu groß.', 413);
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new AppError('Ungültiges JSON-Objekt.'); }
}
function allowedHosts() {
  return new Set(['localhost', '127.0.0.1', '[::1]',
    ...Object.values(networkInterfaces()).flat().filter(Boolean).map(x => x.address),
  ]);
}
function tokenMatches(header, token) {
  const actual = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The HTTP service is independent of the transport; tests inject a DemoClient. */
export async function createApp({
  demo = false, client = demo ? new DemoClient() : new WizClient(),
  dataDir = join(ROOT, 'data'), token = '', hosts = allowedHosts(), tls = null, previewTls = tls, previewPort = Number(process.env.VR_PREVIEW_PORT || 3031),
  setup = new SetupClient(), detectSetup = setupNetworkStatus,
  beatAnalysis = new BeatAnalysis(),
  structureAnalysis = new StructureAnalysis(),
  styleAnalysis = new StyleAnalysis(),
  dmx = new DmxConnection({demo}),
} = {}) {
  if(!Number.isInteger(previewPort)||previewPort<0||previewPort>65535)throw new AppError('VR_PREVIEW_PORT muss eine gültige Portnummer sein.',400);
  const devices = new Map();
  const music = new MusicSession(client);
  const queues = new Map();
  const rates = new Map();
  let saving = Promise.resolve();
  let discovering = null;
  let connecting = null;
  const connectionCache = new Map();
  const storePath = join(dataDir, 'devices.json');
  const recovery=new AutoRecovery({dataDir,client,onReady:async record=>{remember(record);await save();connectionCache.clear();}});

  if (!demo) {
    try {
      const saved = JSON.parse(await readFile(storePath, 'utf8'));
      if (!Array.isArray(saved)) throw new Error('Erwartet wurde eine Liste.');
      for (const item of saved.slice(0, 128)) {
        assertLocalIP(item.ip, client.interfaces());
        devices.set(item.ip, { ip: item.ip, name: validName(item.name),
          mac: typeof item.mac === 'string' ? item.mac : null, online: null,
          pilot: null, capabilities: capabilities() });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Gerätedatei ${storePath} kann nicht gelesen werden: ${error.message}. Datei prüfen; sie wurde nicht überschrieben.`);
      }
    }
  }
  async function save() {
    if (demo) return;
    const content = JSON.stringify([...devices.values()].map(({ ip, name, mac }) => ({ ip, name, mac })), null, 2) + '\n';
    const task = saving.catch(() => {}).then(async () => {
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      const temp = `${storePath}.${randomBytes(5).toString('hex')}.tmp`;
      await writeFile(temp, content, { mode: 0o600 });
      await rename(temp, storePath);
    });
    saving = task;
    await task;
  }
  function serialize(record) {
    return { ip: record.ip, name: record.name, mac: record.mac || null,
      musicActive: Boolean(record.musicActive), online: record.online ?? null, lastSeen: record.lastSeen || null,
      pilot: record.pilot || null, system: record.system || {}, model: record.model || {},
      capabilities: record.capabilities || capabilities(), warnings: record.warnings || [],
      lastError: record.lastError || null,
      history: client.history.get(record.ip) || [] };
  }
  function list() { return [...devices.values()].map(serialize); }
  function remember({ ip, pilot, system, model, mac, ...rest }) {
    // A rediscovered MAC may have a new DHCP address; preserve the local nickname.
    const identity = mac || pilot?.mac || system?.mac;
    const old = devices.get(ip) || [...devices.values()].find(x => identity && x.mac === identity);
    if (!old && devices.size >= 128) throw new AppError('Maximal 128 Geräte im Prototyp.', 409);
    if (old && old.ip !== ip) devices.delete(old.ip);
    const record = { ...old, ip, name: old?.name || (demo ? (ip.endsWith('.50') ? 'Wohnzimmer (Demo)' : 'Leselampe (Demo)') : `AnyDj ${ip}`), online: true,
      lastSeen: new Date().toISOString(), lastError: null,
      ...rest, pilot: pilot || old?.pilot || null, system: system || old?.system || {},
      model: model || old?.model || {}, mac: identity || old?.mac || null };
    record.capabilities = capabilities(record.system, record.model, record.pilot || {});
    devices.set(ip, record);
    return record;
  }
  async function serial(ip, operation) {
    const previous = queues.get(ip) || { promise: Promise.resolve(), count: 0 };
    if (previous.count >= 12) throw new AppError('Zu viele offene Befehle für diese Lampe.', 429, 'BUSY');
    const entry = { count: previous.count + 1, promise: null };
    const task = previous.promise.catch(() => {}).then(operation);
    entry.promise = task;
    queues.set(ip, entry);
    try { return await task; }
    finally {
      const current = queues.get(ip);
      if (current) current.count = Math.max(0, current.count - 1);
      if (current === entry) queues.delete(ip);
    }
  }
  async function refresh(ip, inspect = false) {
    const session = music.session;
    if (session?.ip === ip && session.info) {
      // Do not compete with the music stream. This is explicitly a cached read,
      // not an assertion that the current physical color matches this snapshot.
      const stored = devices.get(ip);
      return { ...stored, ...session.info, ip, name: stored.name, musicActive: true,
        online: session.lastAck ? true : stored.online,
        warnings: [...(session.info.warnings || []), 'Musik aktiv: Anzeige des zuletzt gelesenen Zustands. Live-Status wird nach dem Stoppen wieder abgefragt.'] };
    }
    try {
      const record = devices.get(ip);
      const result = inspect || !record?.inspected ? await client.inspect(ip) : { pilot: await client.read(ip) };
      const actualMac = result.pilot?.mac || result.system?.mac;
      if (record?.mac && actualMac && record.mac.toLowerCase() !== actualMac.toLowerCase()) throw new AppError('Die gespeicherte IP gehört inzwischen zu einem anderen Gerät.', 409, 'DEVICE_CHANGED');
      return remember({ ip, ...result, inspected: true });
    } catch (error) {
      const record = devices.get(ip);
      if (record) { record.online = false; record.lastError = error.message; }
      throw error;
    }
  }
  async function checkConnection(ip, local, force = false) {
    if (!devices.has(ip) && devices.has(connectionCache.get(ip)?.result.device?.ip)) ip = connectionCache.get(ip).result.device.ip;
    if(recovery.running)return {state:'recovering',message:recovery.status.message,devices:list(),device:devices.has(ip)?serialize(devices.get(ip)):null};
    const cached = connectionCache.get(ip);
    if (!force && cached && Date.now() < cached.until && !music.session) return { ...cached.result, devices: list() };
    if (connecting) { await connecting; return checkConnection(ip, local); }
    const task = (async () => {
      const stored = devices.get(ip);
      let record, scanError = false;
      if (stored) try { record = await serial(ip, () => refresh(ip)); } catch {}
      if (!record && !music.session) {
        try {
          const scan = await (discovering || client.discover());
          const found = stored ? scan.devices.find(d => stored.mac && (d.mac || d.pilot?.mac || d.system?.mac)?.toLowerCase() === stored.mac.toLowerCase()) : scan.devices[0];
          if (found) {
            const newIP = assertLocalIP(found.ip, client.interfaces());
            // Read and verify the identity before replacing the stored address.
            const info = await serial(newIP, () => client.inspect(newIP));
            const mac = info.pilot?.mac || info.system?.mac;
            if (!stored || mac?.toLowerCase() === stored.mac?.toLowerCase()) {
              record = remember({ ip: newIP, ...info, inspected: true }); await save();
            }
          }
        } catch { scanError = true; }
      }
      let result;
      if(record&&!record.musicActive)await recovery.observeReady(record);
      if (record) result = { state: record.musicActive ? 'music' : 'ready', message: record.musicActive ? 'Musik läuft bereits. Statusprüfung pausiert während der Wiedergabe.' : record.ip !== ip && ip ? 'Lampe unter neuer IP wiedergefunden und verbunden.' : 'Lampe verbunden.', device: serialize(record) };
      else {
        const resumed = local && !demo && stored && !music.session && await recovery.resumeHome(stored.mac, stored.ip);
        let detection=null;
        if(!resumed&&local&&!demo&&stored&&!music.session){
          const config=await recovery.config();
          const scan=await detectSetup(stored.mac,{interfaceName:config?.interface||''});
          detection=typeof scan==='boolean'?{visible:scan,code:scan?'SETUP_VISIBLE':'SETUP_NOT_VISIBLE'}:scan;
        }
        const setup = detection?.visible;
        result = { state: setup ? 'setup' : 'offline', setupUrl: setup ? '/setup' : null,
          message: setup ? 'Die Lampe sendet ihr Einrichtungsnetz. Sie muss erneut mit dem WLAN verbunden werden.' : music.session ? 'Verbindungsprüfung wartet, bis die laufende Musik beendet ist.' : scanError ? 'Lampe nicht erreichbar; die automatische Suche konnte nicht abgeschlossen werden. Die App versucht es erneut.' : 'Lampe aktuell nicht im Heimnetz erreichbar. Die App sucht automatisch erneut.',
          device: stored ? serialize(devices.get(ip)) : null };
        if(detection&&!setup){
          result.diagnosis={code:detection.code,checkedAt:new Date().toISOString()};
          if(detection.code==='WIFI_SCAN_FAILED')result.message='Die WLAN-Suche auf dem Rechner ist fehlgeschlagen. Der Einrichtungsmodus der Lampe konnte nicht geprüft werden. Die App versucht es erneut.';
          else if(detection.code==='SETUP_NOT_VISIBLE')result.message='Keine Antwort im Heimnetz und kein Einrichtungs-WLAN der Lampe gefunden. Eine automatische Einrichtung ist erst möglich, sobald die Lampe erreichbar ist. Die App prüft weiter.';
        }
        if(resumed)result={...result,state:resumed.state,message:resumed.message,setupUrl:null};
      }
      if(result.state==='setup'&&!music.session){
        const recoveryStatus=await recovery.start(stored.mac, stored.ip);
        if(recoveryStatus)result={...result,state:recoveryStatus.state==='recovering'?'recovering':'setup',message:recoveryStatus.message,setupUrl:recoveryStatus.state==='recovering'?null:'/setup'};
      }
      const entry = { result, until: Date.now() + (record?.musicActive ? 0 : 5000) };
      connectionCache.set(ip, entry); if (record?.ip) connectionCache.set(record.ip, entry);
      if (connectionCache.size > 256) connectionCache.delete(connectionCache.keys().next().value);
      return { ...result, devices: list() };
    })();
    connecting = task;
    try { return await task; } finally { if (connecting === task) connecting = null; }
  }
  const limiter = (req, frame = false) => {
    const key = `${req.socket.remoteAddress || 'unknown'}:${frame=== 'preview'?'preview':frame ? 'music' : 'api'}`;
    const now = Date.now();
    let entry = rates.get(key);
    if (!entry || now - entry.start > 60000) entry = { start: now, count: 0 };
    if (rates.size > 512) for (const [ip, v] of rates) if (now - v.start > 60000) rates.delete(ip);
    if (rates.size > 1024 && !rates.has(key)) throw new AppError('Zu viele Verbindungen.', 429);
    entry.count++;
    rates.set(key, entry);
    if (entry.count > (frame ? 1400 : 360)) throw new AppError('Zu viele Anfragen. Bitte kurz pausieren.', 429, 'RATE_LIMIT');
  };

  const previewRelay=createVRPreviewRelay();let previewBridge=null,bridgeTask=null;
  const createServer = tls ? handler => https.createServer(tls, handler) : handler => http.createServer(handler);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://resources.tidal.com https://images.tidal.com https://*.scdn.co https://*.spotifycdn.com; media-src 'self' blob: https://*.scdn.co https://*.spotifycdn.com; connect-src 'self' https://openapi.tidal.com https://auth.tidal.com https://accounts.spotify.com https://api.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://*.spotifycdn.com; frame-src https://sdk.scdn.co https://*.spotify.com; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    try {
      let url;
      try { url = new URL(req.url, `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`); }
      catch { throw new AppError('Ungültiger Host.', 400); }
      if (!hosts.has(url.hostname) || req.url.startsWith('http')) {
        throw new AppError('Host nicht zugelassen. localhost oder die lokale Server-IP verwenden.', 403, 'BAD_HOST');
      }
      const spotifyCallback=req.method==='GET'&&['/spotify-callback.html','/tidal-callback.html'].includes(url.pathname)&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
      if (req.headers['sec-fetch-site'] === 'cross-site'&&!spotifyCallback) {
        throw new AppError('Seitenübergreifende Anfragen sind gesperrt.', 403, 'CROSS_SITE');
      }
      if (req.headers.origin && req.headers.origin !== url.origin) {
        throw new AppError('Fremder Origin ist nicht zugelassen.', 403, 'BAD_ORIGIN');
      }
      const path = url.pathname;
      if (req.method === 'GET' && STATIC.has(path)) {
        const [filename, contentType] = STATIC.get(path);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(await readFile(join(ROOT, 'public', filename)));
        return;
      }
      if (req.method === 'GET' && path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (!path.startsWith('/api/')) throw new AppError('Nicht gefunden.', 404);
      limiter(req, path === '/api/vr-preview/frame'?'preview':path === '/api/dmx/frame' || path === '/api/music/frame' || path === '/api/music/status');
      if (req.method === 'GET' && path === '/api/meta') {
        json(res, 200, { version: VERSION, demo, tokenRequired: Boolean(token) && !tokenMatches(req.headers.authorization, token) }); return;
      }
      if(path==='/api/vr-preview/command'&&req.method==='POST'){if(req.headers['x-anydj-local']!=='1')throw new AppError('Steuerung benötigt den lokalen Anfrageheader.',403);const body=await bodyJSON(req);json(res,200,previewRelay.command(body.id,body.control,body.command));return;}
      if(path==='/api/vr-preview/test-connect'&&req.method==='GET'){json(res,200,previewRelay.pairTest());return;}
      if(path==='/api/vr-preview/pair'&&req.method==='GET'){json(res,200,previewRelay.pair(url.searchParams.get('code'),req.socket.remoteAddress||'unknown'));return;}
      if(path==='/api/vr-preview/stream'&&req.method==='GET'){previewRelay.stream(url.searchParams.get('id'),req,res);return;}
      if (token && !tokenMatches(req.headers.authorization, token)) {
        throw new AppError('Bitte den Web-Zugangscode aus dem Server-Terminal eingeben.', 401, 'UNAUTHORIZED');
      }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-anydj-local'] !== '1' && req.headers['x-wiz-local'] !== '1') {
        throw new AppError('Schreibzugriff benötigt den Header X-AnyDj-Local: 1.', 403, 'CSRF');
      }
      if(path.startsWith('/api/vr-preview/')){
        if(req.method!=='POST')throw new AppError('Vorschau benötigt POST.',405);
        const body=await bodyJSON(req,path.endsWith('/frame')?1048576:8192);
        if(path==='/api/vr-preview/start'){
          const urls=await previewAddresses();const session=previewRelay.start();json(res,200,{...session,urls:urls.map(base=>`${base}/vr-view#${session.id}`),secure:Boolean(previewTls)});return;
        }
        if(path==='/api/vr-preview/frame'){json(res,200,previewRelay.publish(body.id,body.owner,body.scene,body.ack));return;}
        if(path==='/api/vr-preview/stop'){previewRelay.stop(body.id,body.owner);json(res,200,{stopped:true});return;}
        throw new AppError('Vorschau-Endpunkt nicht gefunden.',404);
      }
      if (path === '/api/dmx/status' && req.method === 'GET') { json(res,200,dmx.status());return; }
      if (path.startsWith('/api/dmx/')) {
        if(req.method!=='POST')throw new AppError('DMX-Zugriff benötigt POST.',405);
        const body=await bodyJSON(req);
        if(path==='/api/dmx/start'){json(res,200,await dmx.enable(body.target));return;}
        if(path==='/api/dmx/frame'){dmx.frame(body.id,body.channels);json(res,202,{accepted:true});return;}
        if(path==='/api/dmx/stop'){json(res,200,await dmx.stop(body.id));return;}
        throw new AppError('DMX-Endpunkt nicht gefunden.',404);
      }
      if (path === '/api/analysis/beats') {
        if (req.method === 'GET') { json(res, 200, await beatAnalysis.status()); return; }
        if (req.method !== 'POST') throw new AppError('Beat-Analyse benötigt GET oder POST.', 405);
        json(res, 200, await beatAnalysis.handle(req, res)); return;
      }
      if (path === '/api/analysis/style') {
        if(req.method==='GET'){json(res,200,await styleAnalysis.status());return;}
        if(req.method!=='POST')throw new AppError('Stilanalyse benötigt GET oder POST.',405);
        json(res,200,await styleAnalysis.handle(req,res));return;
      }
      if (path === '/api/analysis/structure') {
        if (req.method === 'GET') { json(res, 200, await structureAnalysis.status()); return; }
        if (req.method !== 'POST') throw new AppError('Songstruktur-Analyse benötigt GET oder POST.',405);
        json(res,200,await structureAnalysis.handle(req,res));return;
      }
      if (req.method === 'POST' && path === '/api/connection') {
        const body = await bodyJSON(req);
        const ip = body.ip ? assertLocalIP(body.ip, client.interfaces()) : devices.keys().next().value;
        if (body.ip && !devices.has(ip) && !connectionCache.has(ip)) throw new AppError('Unbekannte Lampe.', 404);
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        json(res, 200, await checkConnection(ip, local, body.force === true)); return;
      }
      if (path.startsWith('/api/music/')) {
        if (req.method !== 'POST') throw new AppError('Musikzugriff benötigt POST.', 405);
        const body = await bodyJSON(req);
        if (path === '/api/music/start') {
          if (connecting) throw new AppError('Verbindungsprüfung läuft noch. Bitte kurz warten.', 409, 'CONNECTION_CHECK');
          if(recovery.running)throw new AppError('Automatische WLAN-Wiederverbindung läuft.',409);
          const ip = assertLocalIP(body.ip, client.interfaces());
          if (!devices.has(ip)) throw new AppError('Lampe zuerst hinzufügen.', 404);
          if (body.source === 'system' && (demo || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))) {
            throw new AppError('Rechner-Audio ist nur direkt am Rechner im echten Modus verfügbar.', 403);
          }
          json(res, 200, await serial(ip, () => music.start(ip, body.source, body.settings))); return;
        }
        if (path === '/api/music/frame') { music.frame(body.id, body); json(res, 202, { accepted: true }); return; }
        if (path === '/api/music/status') { json(res, 200, music.status(body.id)); return; }
        if (path === '/api/music/settings') { music.configure(body.id, body.settings); json(res, 200, { accepted: true }); return; }
        if (path === '/api/music/stop') { json(res, 200, await music.stop(body.id)); return; }
        throw new AppError('Musik-Endpunkt nicht gefunden.', 404);
      }
      if (path.startsWith('/api/setup/')) {
        if (demo) throw new AppError('WLAN-Einrichtung ist im Demo-Modus deaktiviert.', 409);
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
          throw new AppError('WLAN-Einrichtung bitte direkt am Rechner über localhost öffnen.', 403);
        }
        if(path==='/api/setup/recovery') {
          if(req.method==='GET'){json(res,200,{enabled:Boolean(await recovery.config()),...recovery.status});return;}
          if(req.method==='POST'){
            const body=await bodyJSON(req);
            if(body.enabled!==false&&![...devices.values()].some(d=>d.mac?.toLowerCase()===body.mac?.toLowerCase()))throw new AppError('Nur gespeicherte Lampen können automatisch verbunden werden.',409);
            try{json(res,200,await recovery.configure(body));}catch{throw new AppError('Wiederverbindungs-Konfiguration ungültig oder Vorgang läuft.',409);}
            return;
          }
        }
        if(recovery.running)throw new AppError('Automatische WLAN-Wiederverbindung läuft bereits.',409);
        if (req.method === 'GET' && path === '/api/setup/device') {
          json(res, 200, await setup.device()); return;
        }
        if (req.method === 'POST' && path === '/api/setup/pair') {
          json(res, 200, await setup.pair(await bodyJSON(req))); return;
        }
        if (req.method === 'POST' && path === '/api/setup/complete') {
          const body = await bodyJSON(req);
          json(res, 200, await setup.complete(body.mac)); return;
        }
        throw new AppError('Einrichtungsendpunkt nicht gefunden.', 404);
      }
      if (req.method === 'GET' && path === '/api/devices') {
        json(res, 200, { devices: list(), interfaces: client.interfaces() }); return;
      }
      if (req.method === 'POST' && path === '/api/discover') {
        if (recovery.running) throw new AppError('Automatische WLAN-Wiederverbindung läuft. Bitte kurz warten.',409);
        if (music.session) throw new AppError('Musik zuerst stoppen, bevor erneut nach Lampen gesucht wird.', 409, 'MUSIC_ACTIVE');
        const body = await bodyJSON(req);
        if (body.interface != null && typeof body.interface !== 'string') throw new AppError('interface muss eine IPv4-Adresse sein.');
        if (!discovering) {
          discovering = (async () => {
            const result = await client.discover(body.interface || '');
            const found = [];
            for (const item of result.devices) {
              try { assertLocalIP(item.ip, client.interfaces()); remember(item); found.push(item.ip); }
              catch (error) { result.warnings.push(error.message); }
            }
            // Broadcast replies can be lost while Wi-Fi is reconnecting. Probe
            // saved addresses as well; refresh verifies the stored MAC identity.
            if(!body.interface) {
              const known=[...devices.keys()].filter(ip=>!found.includes(ip)).slice(0,12);
              await Promise.allSettled(known.map(async ip=>{
                try { await serial(ip,()=>refresh(ip));found.push(ip); } catch {}
              }));
            }
            connectionCache.clear();
            await save();
            return { devices: list(), found, warnings: result.warnings, interfaces: result.interfaces };
          })();
        }
        const task = discovering;
        try { json(res, 200, await task); }
        finally { if (discovering === task) discovering = null; }
        return;
      }
      if (req.method === 'POST' && path === '/api/devices') {
        const body = await bodyJSON(req);
        const ip = assertLocalIP(body.ip, client.interfaces());
        const name = body.name ? validName(body.name) : null;
        const record = await serial(ip, () => refresh(ip, true));
        if (name) record.name = name;
        await save();
        json(res, 200, { device: serialize(record), devices: list() }); return;
      }
      const match = path.match(/^\/api\/devices\/([^/]+)(\/pilot)?$/);
      if (!match) throw new AppError('API-Endpunkt nicht gefunden.', 404);
      const ip = assertLocalIP(decodeURIComponent(match[1]), client.interfaces());
      if (!devices.has(ip)) throw new AppError('Lampe zuerst suchen oder über ihre IP hinzufügen.', 404, 'UNKNOWN_DEVICE');
      if (music.ip === ip && ((req.method === 'POST' && match[2]) || req.method === 'DELETE')) {
        throw new AppError('Musikeffekt zuerst auf der Musikseite stoppen.', 409, 'MUSIC_ACTIVE');
      }
      if (req.method === 'GET' && !match[2]) {
        const record = await serial(ip, () => refresh(ip));
        json(res, 200, { device: serialize(record) }); return;
      }
      if (req.method === 'PATCH' && !match[2]) {
        const body = await bodyJSON(req);
        devices.get(ip).name = validName(body.name);
        await save();
        json(res, 200, { device: serialize(devices.get(ip)) }); return;
      }
      if (req.method === 'DELETE' && !match[2]) {
        await bodyJSON(req);
        await serial(ip, async () => {
          if (music.ip === ip) throw new AppError('Musik zuerst stoppen.', 409, 'MUSIC_ACTIVE');
          devices.delete(ip); await save();
        });
        json(res, 200, { devices: list() }); return;
      }
      if (req.method === 'POST' && match[2] === '/pilot') {
        const params = validatePilot(await bodyJSON(req));
        const output = await serial(ip, async () => {
          if (music.ip === ip) throw new AppError('Musik zuerst stoppen.', 409, 'MUSIC_ACTIVE');
          const record = devices.get(ip);
          if (!record) throw new AppError('Lampe wurde entfernt.', 404);
          const caps = record.capabilities;
          if ('r' in params && caps?.color === false) throw new AppError('Diese Lampe unterstützt laut Modul keine RGB-Farben.');
          if ('temp' in params && caps?.temperature === false) throw new AppError('Diese Lampe unterstützt laut Modul keine einstellbare Weißtemperatur.');
          if ('dimming' in params && caps?.brightness === false) throw new AppError('Dieses Gerät unterstützt laut Modul keine Helligkeitsregelung.');
          if ('temp' in params && caps?.rangeReported && (params.temp < caps.minKelvin || params.temp > caps.maxKelvin)) {
            throw new AppError(`Die Lampe meldet einen Bereich von ${caps.minKelvin} bis ${caps.maxKelvin} K.`);
          }
          try {
            const result = await client.control(ip, params);
            if (result.pilot) remember({ ip, pilot: result.pilot });
            else { record.online = null; record.lastError = result.warning; }
            return { device: serialize(devices.get(ip)), warning: result.warning, sent: { method: 'setPilot', params } };
          } catch (error) {
            // A lost UDP response does not prove the command was not executed.
            record.online = error.code === 'UDP_TIMEOUT' ? null : record.online;
            record.lastError = error.message;
            throw error;
          }
        });
        json(res, 200, output); return;
      }
      throw new AppError('HTTP-Methode nicht erlaubt.', 405);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, {
        error: { code: error.code || 'SERVER_ERROR', message: error.status ? error.message : 'Serverfehler. Details stehen im Server-Terminal.' },
      });
      else res.end();
      if (!error.status) console.error(error);
    }
  });
  async function previewAddresses(){
    if(!bridgeTask)bridgeTask=(async()=>{
      const allowed=new Set(['/vr-test','/vr-test/','/api/vr-preview/test-connect','/vr-view','/vr-view.js','/vr-view.css','/dmx-stage-vr.js','/dmx-vr-console.js','/dmx-vr-playback.js','/dmx-stage-3d-renderer.js','/api/vr-preview/stream','/api/vr-preview/pair']);
      previewBridge=(previewTls?https.createServer.bind(https,previewTls):http.createServer)((req,res)=>{let path=(req.url||'').split('?')[0];if(req.method==='GET'&&(path==='/'||path==='/vr-view/')){req.url='/vr-view'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'');path='/vr-view';}if(req.method==='GET'&&path==='/favicon.ico'){res.writeHead(204);res.end();return;}if(!(req.method==='POST'&&path==='/api/vr-preview/command')&&(req.method!=='GET'||!allowed.has(path))){res.writeHead(403);res.end('Dieser Zugang ist nur für die VR-Vorschau.');return;}server.emit('request',req,res);});
      await new Promise((resolve,reject)=>{previewBridge.once('error',reject);previewBridge.listen(previewPort,'0.0.0.0',resolve);});
      return previewBridge.address().port;
    })().catch(error=>{previewBridge?.close();previewBridge=null;bridgeTask=null;if(error.code==='EADDRINUSE')throw new AppError(`Der VR-Vorschau-Port ${previewPort} ist bereits belegt. Beende die andere AnyDj-Instanz oder lege VR_PREVIEW_PORT fest.`,409);throw error;});
    const port=await bridgeTask,addresses=Object.values(networkInterfaces()).flat().filter(x=>x&&!x.internal&&x.family==='IPv4').map(x=>x.address);
    return [...new Set(addresses.length?addresses:['127.0.0.1'])].map(ip=>`${previewTls?'https':'http'}://${ip}:${port}`);
  }
  server.on('close',()=>{previewRelay.close();previewBridge?.closeAllConnections();previewBridge?.close();});
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  const recoveryMonitor = new RecoveryMonitor({ recovery, devices, checkConnection,
    isBusy: () => Boolean(music.session || connecting || discovering) });
  if (!demo) server.on('listening', () => recoveryMonitor.start());
  server.on('close', () => recoveryMonitor.stop());
  server.on('close', () => { beatAnalysis.close(); structureAnalysis.close(); styleAnalysis.close(); if (music.session) void music.stop(music.session.id); });
  server.on('listening',()=>dmx.startMonitoring());
  server.on('close',()=>void dmx.close());
  return { server, devices, client, music, dmx };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Bitte Node.js 22 oder neuer verwenden.');
  }
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node server.mjs [--lan] [--demo] [--https]\nSSL_CERT_FILE=.certs/localhost.pem, SSL_KEY_FILE=.certs/localhost-key.pem\nPORT=3030, HOST=127.0.0.1, WIZ_WEB_TOKEN=<mindestens 20 Zeichen>, WIZ_DATA_DIR=<Pfad>');
    return;
  }
  if (args.some(x => !['--lan', '--demo', '--https'].includes(x))) throw new Error('Unbekannte Option. Siehe --help.');
  const demo = args.includes('--demo');
  const secure = args.includes('--https'), protocol = secure ? 'https' : 'http';
  let tls = null;
  if (secure) {
    try {
      const [cert, key] = await Promise.all([
        readFile(resolve(process.env.SSL_CERT_FILE || join(ROOT, '.certs/localhost.pem'))),
        readFile(resolve(process.env.SSL_KEY_FILE || join(ROOT, '.certs/localhost-key.pem'))),
      ]);
      tls = {cert, key};
    } catch { throw Error('Lokales TLS-Zertifikat fehlt oder ist nicht lesbar. Zuerst pnpm run dev:cert ausführen oder SSL_CERT_FILE und SSL_KEY_FILE setzen.'); }
  }
  const host = process.env.HOST || (args.includes('--lan') ? '0.0.0.0' : '127.0.0.1');
  const hosts = allowedHosts();
  if (host !== '0.0.0.0' && !hosts.has(host)) throw new Error('HOST muss 127.0.0.1, localhost oder eine lokale Server-IP sein.');
  const port = Number(process.env.PORT || 3030);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT muss zwischen 1 und 65535 liegen.');
  const lan = !['localhost', '127.0.0.1', '[::1]'].includes(host);
  const token = process.env.WIZ_WEB_TOKEN || '';
  if (token && token.length < 20) throw new Error('WIZ_WEB_TOKEN muss mindestens 20 Zeichen lang sein.');
  const { server, client, music, dmx } = await createApp({ demo, token, hosts, tls,
    ...(process.env.WIZ_DATA_DIR ? { dataDir: resolve(process.env.WIZ_DATA_DIR) } : {}),
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  console.log(`\nAnyDj · Prototyp ${VERSION}${demo ? ' · DEMO: keine echte Lampe wird angesprochen' : ''}`);
  console.log(`Rechner: ${protocol}://127.0.0.1:${port}`);
  if (secure) console.log(`Spotify Redirect URI: https://127.0.0.1:${port}/spotify-callback.html`);
  if (lan) {
    for (const iface of (new WizClient()).interfaces()) console.log(`Heimnetz (${iface.name}): ${protocol}://${iface.address}:${port}`);
    console.log(secure ? 'Das lokale Zertifikat muss auch die verwendete Heimnetz-IP abdecken.' : 'Nur in einem vertrauenswürdigen Heimnetz verwenden. Kein TLS; keine Internet-Portfreigabe.');
  }
  if (token) console.log(`\nWeb-Zugangscode: ${token}\n(Das ist NICHT der AnyDj Home Security Key.)`);
  console.log('\nBeenden: Strg+C\n');
  const stop = async () => {
    setTimeout(() => process.exit(0), 6000).unref();
    if (music.session) await music.stop(music.session.id);
    await dmx.close();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\nStart fehlgeschlagen: ${error.message}\n`); process.exitCode = 1; });
}
