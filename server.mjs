import { AppError } from './lib/app-error.mjs';
import {createVRAuth} from './lib/vr-auth.mjs';
import {createVRPreviewRelay} from './lib/vr-preview.mjs';
import http from 'node:http';
import https from 'node:https';
import {DmxConnection} from './lib/dmx.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { BeatAnalysis } from './lib/beat-analysis.mjs';
import { StyleAnalysis } from './lib/style-analysis.mjs';
import { StructureAnalysis } from './lib/structure-analysis.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const VERSION = '0.1.0';
const STATIC = new Map([
  ['/storage-migration.js', ['storage-migration.js', 'text/javascript; charset=utf-8']],
  ['/local-access.js', ['local-access.js', 'text/javascript; charset=utf-8']],
  ['/track-cut-playback.js', ['track-cut-playback.js', 'text/javascript; charset=utf-8']],
  ['/track-cuts.js', ['track-cuts.js', 'text/javascript; charset=utf-8']],
  ['/track-cut-editor.js', ['track-cut-editor.js', 'text/javascript; charset=utf-8']],
  ['/queue-export-plan.js', ['queue-export-plan.js', 'text/javascript; charset=utf-8']],
  ['/queue-audio-export.js', ['queue-audio-export.js', 'text/javascript; charset=utf-8']],
  ['/queue-export-dialog.js', ['queue-export-dialog.js', 'text/javascript; charset=utf-8']],
  ['/mp3-export-worker.js', ['mp3-export-worker.js', 'text/javascript; charset=utf-8']],
  ['/audio-export-worker.js', ['audio-export-worker.js', 'text/javascript; charset=utf-8']],
  ['/audio-export-formats.js', ['audio-export-formats.js', 'text/javascript; charset=utf-8']],
  ['/lossless-audio-encoder.js', ['lossless-audio-encoder.js', 'text/javascript; charset=utf-8']],
  ['/lame.min.js', ['lame.min.js', 'text/javascript; charset=utf-8']],
  ['/lame-source.js', ['lame-source.js', 'text/javascript; charset=utf-8']],
  ['/lame-license.txt', ['lame-license.txt', 'text/plain; charset=utf-8']],
  ['/dj-edit-export.css', ['dj-edit-export.css', 'text/css; charset=utf-8']],
  ['/app-settings.js', ['app-settings.js', 'text/javascript; charset=utf-8']],
  ['/app-settings.css', ['app-settings.css', 'text/css; charset=utf-8']],
  ['/dj-theme.css', ['dj-theme.css', 'text/css; charset=utf-8']],
  ['/dj-mix-workspace.css', ['dj-mix-workspace.css', 'text/css; charset=utf-8']],
  ['/design-tokens.css', ['design-tokens.css', 'text/css; charset=utf-8']],
  ['/vr-test', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-test/', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-view', ['vr-view.html', 'text/html; charset=utf-8']],
  ['/vr-view-boot.js', ['vr-view-boot.js', 'text/javascript; charset=utf-8']],
  ['/vr-view.js', ['vr-view.js', 'text/javascript; charset=utf-8']],
  ['/vr-view.css', ['vr-view.css', 'text/css; charset=utf-8']],
  ['/dmx-vr-share.js', ['dmx-vr-share.js', 'text/javascript; charset=utf-8']],
  ['/brand.css', ['brand.css', 'text/css; charset=utf-8']],
  ['/transition-timeline.js', ['transition-timeline.js', 'text/javascript; charset=utf-8']],
  ['/transition-align.js', ['transition-align.js', 'text/javascript; charset=utf-8']],
  ['/transition-optimizer.js', ['transition-optimizer.js', 'text/javascript; charset=utf-8']],
  ['/transition-optimizer-worker.js', ['transition-optimizer-worker.js', 'text/javascript; charset=utf-8']],
  ['/animatus-small.svg', ['animatus-small.svg', 'image/svg+xml']],
  ['/transition-audio.js', ['transition-audio.js', 'text/javascript; charset=utf-8']],
  ['/transition-curve-editor.js', ['transition-curve-editor.js', 'text/javascript; charset=utf-8']],
  ['/transition-library.js', ['transition-library.js', 'text/javascript; charset=utf-8']],
  ['/transition-links.js', ['transition-links.js', 'text/javascript; charset=utf-8']],
  ['/setlist-transition.js', ['setlist-transition.js', 'text/javascript; charset=utf-8']],
  ['/transition-preview.js', ['transition-preview.js', 'text/javascript; charset=utf-8']],
  ['/transition-cut-save.js', ['transition-cut-save.js', 'text/javascript; charset=utf-8']],
  ['/musical-transition.js', ['musical-transition.js', 'text/javascript; charset=utf-8']],
  ['/stage-motion.js', ['stage-motion.js', 'text/javascript; charset=utf-8']],
  ['/stage-motifs.js', ['stage-motifs.js', 'text/javascript; charset=utf-8']],
  ['/dmx-connection.js', ['dmx-connection.js', 'text/javascript; charset=utf-8']],
  ['/song-movement-plan.js', ['song-movement-plan.js', 'text/javascript; charset=utf-8']],
  ['/dmx-group-motion.js', ['dmx-group-motion.js', 'text/javascript; charset=utf-8']],
  ['/dmx-musical-score.js', ['dmx-musical-score.js', 'text/javascript; charset=utf-8']],
  ['/dmx-activity.js', ['dmx-activity.js', 'text/javascript; charset=utf-8']],
  ['/dmx-participation.js', ['dmx-participation.js', 'text/javascript; charset=utf-8']],
  ['/dmx-focus.js', ['dmx-focus.js', 'text/javascript; charset=utf-8']],
  ['/dmx-auto.js', ['dmx-auto.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe-conductor.js', ['dmx-strobe-conductor.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe-choreography.js', ['dmx-strobe-choreography.js', 'text/javascript; charset=utf-8']],
  ['/dmx-formation-variations.js', ['dmx-formation-variations.js', 'text/javascript; charset=utf-8']],
  ['/dmx-formation-music.js', ['dmx-formation-music.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe-space.js', ['dmx-strobe-space.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe-motifs.js', ['dmx-strobe-motifs.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe-score.js', ['dmx-strobe-score.js', 'text/javascript; charset=utf-8']],
  ['/dmx-strobe.js', ['dmx-strobe.js', 'text/javascript; charset=utf-8']],
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
  ['/dmx-device-manager.js', ['dmx-device-manager.js', 'text/javascript; charset=utf-8']],
  ['/dmx-device-manager.css', ['dmx-device-manager.css', 'text/css; charset=utf-8']],
  ['/dmx-layout.js', ['dmx-layout.js', 'text/javascript; charset=utf-8']],
  ['/dmx-layout-model.js', ['dmx-layout-model.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage.css', ['dmx-stage.css', 'text/css; charset=utf-8']],
  ['/dj-waveform.js', ['dj-waveform.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-transport.js', ['dmx-stage-transport.js', 'text/javascript; charset=utf-8']],
  ['/dmx-formation-actions.js', ['dmx-formation-actions.js', 'text/javascript; charset=utf-8']],
  ['/dmx-formation-scenes.js', ['dmx-formation-scenes.js', 'text/javascript; charset=utf-8']],
  ['/dmx-formation-rig.js', ['dmx-formation-rig.js', 'text/javascript; charset=utf-8']],
  ['/select-state.js', ['select-state.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-full.js', ['dmx-stage-full.js', 'text/javascript; charset=utf-8']],
  ['/dmx-ar-model.js', ['dmx-ar-model.js', 'text/javascript; charset=utf-8']],
  ['/dmx-ar-planner.js', ['dmx-ar-planner.js', 'text/javascript; charset=utf-8']],
  ['/dmx-ar-controls.js', ['dmx-ar-controls.js', 'text/javascript; charset=utf-8']],
  ['/dmx-ar.css', ['dmx-ar.css', 'text/css; charset=utf-8']],
  ['/dmx-room-mesh.js', ['dmx-room-mesh.js', 'text/javascript; charset=utf-8']],
  ['/dmx-room-style.js', ['dmx-room-style.js', 'text/javascript; charset=utf-8']],
  ['/dmx-room.js', ['dmx-room.js', 'text/javascript; charset=utf-8']],
  ['/dmx-zone-plan.js', ['dmx-zone-plan.js', 'text/javascript; charset=utf-8']],
  ['/dmx-zone-motion.js', ['dmx-zone-motion.js', 'text/javascript; charset=utf-8']],
  ['/dmx-room-presets.js', ['dmx-room-presets.js', 'text/javascript; charset=utf-8']],
  ['/dmx-beam-volume.js', ['dmx-beam-volume.js', 'text/javascript; charset=utf-8']],
  ['/dmx-scene-readability.js', ['dmx-scene-readability.js', 'text/javascript; charset=utf-8']],
  ['/dmx-light-geometry.js', ['dmx-light-geometry.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-workspace.js', ['dmx-stage-workspace.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-setup.js', ['dmx-vr-setup.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-playback.js', ['dmx-vr-playback.js', 'text/javascript; charset=utf-8']],
  ['/dmx-surface-light.js', ['dmx-surface-light.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-vr.js', ['dmx-stage-vr.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-renderer.js', ['dmx-vr-renderer.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-quality.js', ['dmx-vr-quality.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-scene.js', ['dmx-vr-scene.js', 'text/javascript; charset=utf-8']],
  ['/dmx-vr-console.js', ['dmx-vr-console.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d.js', ['dmx-stage-3d.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-brand.js', ['dmx-stage-brand.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-brand-data.js', ['dmx-stage-brand-data.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d-renderer.js', ['dmx-stage-3d-renderer.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-desktop.js', ['dmx-stage-desktop.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-gpu-scene.js', ['dmx-stage-gpu-scene.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-webgpu.js', ['dmx-stage-webgpu.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-webgl.js', ['dmx-stage-webgl.js', 'text/javascript; charset=utf-8']],
  ['/dmx-stage-3d.css', ['dmx-stage-3d.css', 'text/css; charset=utf-8']],
  ['/', ['dj.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/editor-model.js', ['editor-model.js', 'text/javascript; charset=utf-8']],
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
  ['/light-review.js', ['light-review.js', 'text/javascript; charset=utf-8']],
  ['/light-output-trace.js', ['light-output-trace.js', 'text/javascript; charset=utf-8']],
  ['/dmx-light-scenes.js', ['dmx-light-scenes.js', 'text/javascript; charset=utf-8']],
  ['/light-editor-model.js', ['light-editor-model.js', 'text/javascript; charset=utf-8']],
  ['/light-editor-timeline.js', ['light-editor-timeline.js', 'text/javascript; charset=utf-8']],
  ['/light-editor.css', ['light-editor.css', 'text/css; charset=utf-8']],
  ['/dj-show-profile.js', ['dj-show-profile.js', 'text/javascript; charset=utf-8']],
  ['/show-score.js', ['show-score.js', 'text/javascript; charset=utf-8']],
  ['/show-action.js', ['show-action.js', 'text/javascript; charset=utf-8']],
  ['/dj-status.js', ['dj-status.js', 'text/javascript; charset=utf-8']],
  ['/dj-folder.js', ['dj-folder.js', 'text/javascript; charset=utf-8']],
  ['/feeling-tags.js', ['feeling-tags.js', 'text/javascript; charset=utf-8']],
  ['/feeling-library.js', ['feeling-library.js', 'text/javascript; charset=utf-8']],
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
]);
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

/** Local DJ, analysis, DMX and VR service. */
export async function createApp({
  demo = false,
  dataDir = join(ROOT, 'data'), token = '', hosts = allowedHosts(), tls = null, previewTls = tls, previewPort = Number(process.env.VR_PREVIEW_PORT || 3031),
  beatAnalysis = new BeatAnalysis(),
  structureAnalysis = new StructureAnalysis(),
  styleAnalysis = new StyleAnalysis(),
  dmx = new DmxConnection({demo}),
} = {}) {
  if(!Number.isInteger(previewPort)||previewPort<0||previewPort>65535)throw new AppError('VR_PREVIEW_PORT muss eine gültige Portnummer sein.',400);
  const rates = new Map();
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

  const previewAuth=createVRAuth(dataDir),previewRelay=createVRPreviewRelay();let previewBridge=null,bridgeTask=null;
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
      limiter(req, path === '/api/vr-preview/frame'?'preview':path === '/api/dmx/frame');
      if (req.method === 'GET' && path === '/api/meta') {
        json(res, 200, { version: VERSION, demo, tokenRequired: Boolean(token) && !tokenMatches(req.headers.authorization, token) }); return;
      }
      if(path==='/api/vr-preview/command'&&req.method==='POST'){if(req.headers['x-anydj-local']!=='1')throw new AppError('Steuerung benötigt den lokalen Anfrageheader.',403);const body=await bodyJSON(req,270000);json(res,200,previewRelay.command(body.id,body.control,body.command));return;}
      if(path==='/api/vr-preview/resume'&&req.method==='POST'){if(req.headers['x-anydj-local']!=='1')throw new AppError('Lokaler Anfrageheader fehlt.',403);const body=await bodyJSON(req);await previewAuth.verify(body.token);json(res,200,previewRelay.pairTest());return;}
      if(path==='/api/vr-preview/test-connect'&&req.method==='GET'){json(res,200,previewRelay.pairTest());return;}
      if(path==='/api/vr-preview/pair'&&req.method==='GET'){const paired=previewRelay.pair(url.searchParams.get('code'),req.socket.remoteAddress||'unknown');json(res,200,{...paired,token:await previewAuth.issue()});return;}
      if(path==='/api/vr-preview/stream'&&req.method==='GET'){previewRelay.stream(url.searchParams.get('id'),req,res);return;}
      if (token && !tokenMatches(req.headers.authorization, token)) {
        throw new AppError('Bitte den Web-Zugangscode aus dem Server-Terminal eingeben.', 401, 'UNAUTHORIZED');
      }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-anydj-local'] !== '1') {
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
      throw new AppError('Nicht gefunden.', 404);
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
      const allowed=new Set(['/dmx-scene-readability.js','/dmx-stage-brand.js','/dmx-stage-brand-data.js','/song-movement-plan.js','/dmx-musical-score.js','/dmx-group-motion.js','/dmx-room-presets.js','/dmx-beam-volume.js','/dmx-device-manager.js','/dmx-device-manager.css','/dmx-activity.js','/dmx-participation.js','/dmx-focus.js','/dmx-light-scenes.js','/instrument-activity.js','/musical-attention.js','/show-action.js','/show-score.js','/vr-test','/vr-test/','/api/vr-preview/test-connect','/vr-view','/vr-view-boot.js','/vr-view.js','/vr-view.css','/dmx-vr-renderer.js','/dmx-vr-quality.js','/dmx-vr-scene.js','/dmx-stage-vr.js','/dmx-vr-console.js','/dmx-vr-playback.js','/dmx-surface-light.js','/dmx-light-geometry.js','/dmx-zone-plan.js','/dmx-zone-motion.js','/dmx-ar-model.js','/dmx-room-style.js','/dmx-room-mesh.js','/dmx-ar-planner.js','/dmx-ar-controls.js','/dmx-ar.css','/dmx-stage-3d-renderer.js','/api/vr-preview/stream','/api/vr-preview/pair']);
      previewBridge=(previewTls?https.createServer.bind(https,previewTls):http.createServer)((req,res)=>{let path=(req.url||'').split('?')[0];if(req.method==='GET'&&(path==='/'||path==='/vr-view/')){req.url='/vr-view'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'');path='/vr-view';}if(req.method==='GET'&&path==='/favicon.ico'){res.writeHead(204);res.end();return;}if(!(req.method==='POST'&&['/api/vr-preview/command','/api/vr-preview/resume'].includes(path))&&(req.method!=='GET'||!allowed.has(path))){res.writeHead(403);res.end('Dieser Zugang ist nur für die VR-Vorschau.');return;}server.emit('request',req,res);});
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
  server.on('close', () => { beatAnalysis.close(); structureAnalysis.close(); styleAnalysis.close(); });
  server.on('listening',()=>dmx.startMonitoring());
  server.on('close',()=>void dmx.close());
  return { server, dmx };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Bitte Node.js 22 oder neuer verwenden.');
  }
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node server.mjs [--lan] [--demo] [--https]\nSSL_CERT_FILE=.certs/localhost.pem, SSL_KEY_FILE=.certs/localhost-key.pem\nPORT=3030, HOST=127.0.0.1, ANYDJ_WEB_TOKEN=<mindestens 20 Zeichen>, ANYDJ_DATA_DIR=<Pfad>');
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
  const token = process.env.ANYDJ_WEB_TOKEN || '';
  if (token && token.length < 20) throw new Error('ANYDJ_WEB_TOKEN muss mindestens 20 Zeichen lang sein.');
  const { server, dmx } = await createApp({ demo, token, hosts, tls,
    ...(process.env.ANYDJ_DATA_DIR ? { dataDir: resolve(process.env.ANYDJ_DATA_DIR) } : {}),
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  console.log(`\nAnyDj · Prototyp ${VERSION}${demo ? ' · DEMO: keine Hardwareausgabe' : ''}`);
  console.log(`Rechner: ${protocol}://127.0.0.1:${port}`);
  if (secure) console.log(`Spotify Redirect URI: https://127.0.0.1:${port}/spotify-callback.html`);
  if (lan) {
    for (const [name,entries] of Object.entries(networkInterfaces())) for (const iface of entries||[]) if (!iface.internal && iface.family==='IPv4') console.log(`Heimnetz (${name}): ${protocol}://${iface.address}:${port}`);
    console.log(secure ? 'Das lokale Zertifikat muss auch die verwendete Heimnetz-IP abdecken.' : 'Nur in einem vertrauenswürdigen Heimnetz verwenden. Kein TLS; keine Internet-Portfreigabe.');
  }
  if (token) console.log(`\nWeb-Zugangscode: ${token}\n`);
  console.log('\nBeenden: Strg+C\n');
  const stop = async () => {
    setTimeout(() => process.exit(0), 6000).unref();
    await dmx.close();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\nStart fehlgeschlagen: ${error.message}\n`); process.exitCode = 1; });
}
