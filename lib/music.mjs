import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { LiveAnalysis } from '../public/live-analysis.js';
import { AppError, validatePilot } from './wiz.mjs';
import { automaticSettings } from '../public/automatic-settings.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const PALETTES = {
  rainbow: ['#ff2400', '#ffbf00', '#36ff00', '#00dfff', '#3333ff', '#ff00cc'],
  neon: ['#ff0080', '#7400ff', '#00e5ff', '#b5ff00'],
  fire: ['#ff1800', '#ff6500', '#ffc000', '#ff0070'],
  ocean: ['#003cff', '#00aaff', '#00ffd0', '#6600ff'],
  sunset: ['#ff7700', '#ff3300', '#ff0080', '#9d00ff'],
};
export function settings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Ungültige Musikeinstellungen.');
  const result = { mode: 'soft', intensity: 1.5, minimum: 5, maximum: 75, smoothing: 0.5, speed: 1,
    arrangement:'manual', mood: 'off', toneFollow: 0.8, palette: 'sunset', saturation: 100, dynamics: 'balanced', colorA: '#ff0080', colorB: '#00dfff', ...input };
  const ranges = { toneFollow: [0, 1], intensity: [0.2, 4], minimum: [5, 100], maximum: [5, 100], smoothing: [0, 1], speed: [0.2, 4], saturation: [20, 100] };
  if (!['auto','manual'].includes(result.arrangement) || !['off', 'auto'].includes(result.mood) || !['soft', 'bass', 'color', 'disco'].includes(result.mode) || !['balanced', 'sensitive', 'punchy'].includes(result.dynamics) ||
    ![...Object.keys(PALETTES), 'custom'].includes(result.palette) ||
    Object.entries(ranges).some(([key, [lo, hi]]) => !Number.isFinite(result[key]) || result[key] < lo || result[key] > hi) ||
    !Number.isInteger(result.minimum) || !Number.isInteger(result.maximum) || result.minimum > result.maximum ||
    ![result.colorA, result.colorB].every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) throw new AppError('Ungültige Musikeinstellungen: Mindesthelligkeit darf nicht über der maximalen Helligkeit liegen.');
  return result;
}
export function levels(input) {
  if (!input || !['rms', 'bass'].every(k => Number.isFinite(input[k]) && input[k] >= 0 && input[k] <= 1)) throw new AppError('Ungültige Audiopegel.');
  const result = { rms: input.rms, bass: input.bass };
  for (const key of ['energy', 'bassEnergy', 'confidence', 'tone', 'melodyTone', 'melodyConfidence', 'pitchClass', 'tonality', 'flatness', 'rolloff', 'harmonicHue', 'harmonicConfidence', 'flux']) if (key in input) {
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 1) throw new AppError('Ungültige Audiopegel.');
    result[key] = input[key];
  }
  for (const [key, length] of [['bands', 5], ['chroma', 12]]) if (key in input) {
    if (!Array.isArray(input[key]) || input[key].length !== length || input[key].some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new AppError('Ungültiges Klangspektrum.');
    result[key] = [...input[key]];
  }
  if ('bpm' in input) {
    if (!Number.isFinite(input.bpm) || input.bpm < 0 || input.bpm > 300) throw new AppError('Ungültiges Tempo.');
    result.bpm = input.bpm;
  }
  if ('beatSeq' in input) {
    if (!Number.isSafeInteger(input.beatSeq) || input.beatSeq < 0) throw new AppError('Ungültiger Musikimpuls.');
    result.beatSeq = input.beatSeq;
  }
  return result;
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
// Stateful, elapsed-time based envelopes keep fades consistent when UDP replies are slow.
export function lightFrame(level, options, previous = 0, now = 0, color = true) {
  const prior = typeof previous === 'number' ? { smooth: previous } : previous;
  const dt = clamp(now - (prior.time ?? now - 0.125), 0.001, 0.5);
  const signal = options.mode === 'bass' ? level.bass : level.rms;
  const adaptive = options.mode === 'bass' ? level.bassEnergy : level.energy;
  const normalized = adaptive === undefined ? clamp((signal - 0.003) * options.intensity * 3, 0, 1) : clamp(adaptive * options.intensity / 1.5, 0, 1);
  const exponent = { sensitive: 0.65, balanced: 1, punchy: 1.8 }[options.dynamics];
  const energy = normalized ** exponent;
  const onset = Math.max(level.bass, level.rms * 0.55);
  const baseline = prior.baseline ?? onset;
  const detected = level.beatSeq === undefined ? onset > 0.012 && onset > baseline * 1.45 + 0.008 && onset > (prior.onset ?? 0) * 1.15 : level.beatSeq > (prior.beatSeq ?? 0);
  const beat = detected && (level.beatSeq !== undefined || now - (prior.lastBeat ?? -Infinity) >= 0.22);
  const pulse = beat ? 1 : (prior.pulse ?? 0) * Math.exp(-dt / 0.11);
  const target = options.mode === 'disco' ? pulse : energy;
  const tau = (target > (prior.smooth ?? 0) ? 0.025 : 0.07) + options.smoothing * (target > (prior.smooth ?? 0) ? 0.22 : 0.85);
  const smooth = options.mode === 'disco' ? pulse : (prior.smooth ?? 0) + (target - (prior.smooth ?? 0)) * (1 - Math.exp(-dt / tau));
  const dimming = clamp(Math.round(options.minimum + smooth * (options.maximum - options.minimum)), options.minimum, options.maximum);
  const beatCount = (prior.beatCount ?? 0) + (beat ? 1 : 0);
  const position = options.mode === 'disco' ? Math.floor(Math.max(0,beatCount-1)/8) : (prior.position ?? 0) + ( options.mode === 'color' && normalized > 0 ? dt * options.speed * 0.65 : 0);
  let colorPosition = options.mode === 'disco' ? (prior.colorPosition ?? position) + (position - (prior.colorPosition ?? position)) * (1 - Math.exp(-dt / 0.35)) : position;
  const animation = { beatCount, colorPosition, beatSeq: level.beatSeq ?? prior.beatSeq, smooth, time: now, baseline: baseline + (onset - baseline) * (1 - Math.exp(-dt / 0.8)), onset, pulse, position, lastBeat: beat ? now : prior.lastBeat };
  if (!color) return { params: { state: true, dimming }, smooth, animation, beat };
  const palette = (options.palette === 'custom' ? [options.colorA, options.colorB] : PALETTES[options.palette]).map(rgb);
  if (level.bands && Number.isFinite(level.tone) && ['disco', 'color'].includes(options.mode) && options.toneFollow > 0) {
    // Tonal contours drive color independently from the beat-only disco pulse.
    const melody = level.melodyConfidence > 0.08 ? level.melodyTone : level.tone;
    const high = level.bands[3] + level.bands[4];
    const contour = clamp(melody * 0.65 + level.tone * 0.2 + (high - level.bands[0] + 1) * 0.075, 0, 1);
    const harmonic = (level.harmonicConfidence ?? 0) * 0.2;
    const sound = clamp((contour * (1-harmonic) + (level.harmonicHue ?? 0) * harmonic - 0.12) / 0.65, 0, 1);
    const targetColor = sound * (palette.length-1) * options.toneFollow + (position % palette.length) * (1-options.toneFollow);
    colorPosition = (prior.colorPosition ?? targetColor) + (targetColor - (prior.colorPosition ?? targetColor)) *
      (1-Math.exp(-dt * options.speed * (1+(level.flux ?? 0)*3) / (0.10+options.smoothing*0.45)));
    animation.colorPosition = colorPosition;
  }
  const index = Math.floor(colorPosition) % palette.length;
  const fraction = colorPosition % 1;
  const mixed = palette[index].map((v, i) => v + (palette[(index + 1) % palette.length][i] - v) * fraction);
  const top = Math.max(1, ...mixed);
  let [r, g, b] = mixed.map(v => Math.round((v / top * 255) * options.saturation / 100 + 255 * (1 - options.saturation / 100)));
  if (r + g + b === 0) [r, g, b] = [1, 1, 1];
  return { params: { state: true, dimming, r, g, b, c: 0, w: 0 }, smooth, animation, beat };
}
export function restoreParams(pilot) {
  const result = { state: pilot.state };
  if (Number.isFinite(pilot.dimming)) result.dimming = pilot.dimming;
  // getPilot reports sceneId:0 for static colors; setPilot rejects that field.
  if (Number.isInteger(pilot.sceneId) && pilot.sceneId > 0) {
    result.sceneId = pilot.sceneId;
    if (Number.isFinite(pilot.speed)) result.speed = pilot.speed;
  } else if (Number.isFinite(pilot.temp) && pilot.temp > 0) result.temp = pilot.temp;
  else for (const key of ['r', 'g', 'b', 'c', 'w']) if (Number.isFinite(pilot[key])) result[key] = pilot[key];
  return result;
}

// Capture only the default OUTPUT monitor, never a microphone. Raw PCM is
// reduced to levels in memory and neither stored nor returned to the browser.
export function captureOutput(onLevel, onError) {
  const child = spawn('parec', ['--device=@DEFAULT_MONITOR@', '--format=s16le', '--rate=16000', '--channels=2', '--latency-msec=50'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stopped = false, remainder = Buffer.alloc(0);
  const analysis = new LiveAnalysis(16000, onLevel);
  const stereo = [new Float32Array(1), new Float32Array(1)];
  child.stdout.on('data', chunk => {
    const buffer = Buffer.concat([remainder, chunk]);
    const end = buffer.length - buffer.length % 4;
    for (let i = 0; i < end; i += 4) {
      stereo[0][0] = buffer.readInt16LE(i) / 32768; stereo[1][0] = buffer.readInt16LE(i + 2) / 32768; analysis.pushFrame(stereo, 0);
    }
    remainder = Buffer.from(buffer.subarray(end));
  });
  child.stderr.resume();
  const failed = () => { if (!stopped) onError('Rechner-Audio nicht verfügbar. PulseAudio/PipeWire und parec prüfen.'); };
  child.on('error', failed); child.on('exit', failed);
  return () => { stopped = true; child.kill('SIGTERM'); };
}

export class MusicSession {
  constructor(client, { capture = captureOutput, leaseMs = 10000, tickMs = 125 } = {}) {
    this.client = client; this.capture = capture; this.leaseMs = leaseMs; this.tickMs = tickMs;
    this.session = null; this.last = null;
  }
  get ip() { return this.session?.ip; }
  require(id) {
    if (!this.session || this.session.id !== id) throw new AppError('Musiksitzung ist nicht mehr aktiv.', 409, 'MUSIC_SESSION');
    return this.session;
  }
  async start(ip, source, options) {
    if (this.session) throw new AppError('Es läuft bereits eine Musiksitzung. Diese zuerst stoppen.', 409);
    if (!['file', 'system', 'tab', 'show'].includes(source)) throw new AppError('Ungültige Audioquelle.');
    const config = settings(options);
    const s = this.session = { id: randomBytes(18).toString('hex'), ip, source, config, level: { rms: 0, bass: 0 }, smooth: 0, sent: 0, failures: 0, starting: true, lastFrame: 0, touched: Date.now() };
    try {
      const info = await this.client.inspect(ip);
      if (s.stopping || this.session !== s) throw new AppError('Musikstart abgebrochen.', 409);
      if (info.capabilities?.brightness === false) throw new AppError('Dieses Gerät unterstützt keine Helligkeitsregelung.');
      s.info = info; s.original = restoreParams(info.pilot); s.color = info.capabilities?.color !== false;
      s.starting = false;
      if (source === 'system') s.cancelCapture = this.capture(l => { s.level = l; s.lastFrame = Date.now(); }, error => { void this.stop(s.id, error); });
      if (s.stopping) { s.cancelCapture?.(); throw new AppError('Audioquelle konnte nicht gestartet werden.', 409); }
      s.timer = setInterval(() => this.tick(s), this.tickMs); s.timer.unref?.();
      return { id: s.id, source, ip };
    } catch (error) { if (this.session === s) this.session = null; throw error; }
  }
  frame(id, level) {
    const s = this.require(id);
    if (s.source === 'system') throw new AppError('Rechner-Audio wird am Server analysiert.');
    if (s.source === 'show') {
      const params = validatePilot(level.params);
      if (params.state !== true || 'sceneId' in params || 'speed' in params || !['r','temp','dimming'].some(k=>k in params) || ('temp' in params && s.info.capabilities?.temperature !== true)) throw new AppError('Ungültiges Lichtshow-Bild.');
      if('temp' in params)params.temp=clamp(params.temp,s.info.capabilities.minKelvin??2200,s.info.capabilities.maxKelvin??6500);
      s.showParams = { ...params, dimming: clamp(params.dimming ?? s.config.minimum, s.config.minimum, s.config.maximum) };
    } else s.level = levels(level);
    s.lastFrame = Date.now(); s.touched = Date.now();
    // A prepared frame already describes the current playback position. Forward
    // it on receipt instead of adding another independent timer's phase delay.
    if (s.source === 'show') this.tick(s);
  }
  status(id) {
    if (this.last?.id === id && this.session?.id !== id) return this.last;
    const s = this.require(id); s.touched = Date.now();
    return { id, active: !s.stopping, source: s.source, level: s.level, sent: s.sent, failures: s.failures, automatic:s.config.arrangement==='auto'?s.automatic??null:null };
  }
  configure(id, input) {
    const s = this.require(id), next = settings(input);
    if (s.animation && s.config.mode !== next.mode) s.animation = { ...s.animation, position: 0, pulse: 0 };
    s.config = next;
    s.autoSamples=[];s.autoUpdated=0;s.autoCandidate=null;s.automatic=null;
  }
  tick(s) {
    if (this.session !== s || s.stopping || s.starting) return;
    if (Date.now() - s.touched > this.leaseMs) { void this.stop(s.id, 'Musik beendet: Browserverbindung unterbrochen.'); return; }
    if (s.source === 'show' && s.showParams && Date.now() - s.lastFrame > 1500) { void this.stop(s.id, 'Lichtshow pausiert: keine Wiedergabedaten.'); return; }
    if (s.inFlight || Date.now() < (s.nextAttempt ?? 0)) return; // There is never a queue; the next tick uses the newest level.
    const l = Date.now() - s.lastFrame < 1500 ? s.level : { rms: 0, bass: 0 };
    let params;
    if (s.source === 'show') {
      if (!s.showParams) return;
      if (Date.now() - s.lastFrame > 1500) { void this.stop(s.id, 'Lichtshow pausiert: keine Wiedergabedaten.'); return; }
      params = s.color ? s.showParams : { state: true, dimming: s.showParams.dimming, ...('temp' in s.showParams ? {temp:s.showParams.temp} : {}) };
    } else {
      let config=s.config;
      if(config.arrangement==='auto') {
        s.autoSamples??=[];s.autoSamples.push(l);if(s.autoSamples.length>64)s.autoSamples.shift();
        if(!s.automatic)s.automatic=automaticSettings([],config);
        if(s.autoSamples.length>=32&&Date.now()-(s.autoUpdated??0)>8000) {
          const next=automaticSettings(s.autoSamples,config);
          if(next.kind===s.automatic.kind||next.kind===s.autoCandidate)s.automatic=next;
          s.autoCandidate=next.kind;s.autoUpdated=Date.now();
        }
        config={...config,...s.automatic.options};
      }
      const rendered = lightFrame(l, config, s.animation ?? 0, performance.now() / 1000, s.color);
      params = rendered.params; s.animation = rendered.animation;
    }
    const frameKey = JSON.stringify(params);
    if (frameKey === s.lastFrameKey && Date.now() - s.lastAck < 2000) return;
    if (s.source === 'show' && Date.now() - (s.lastDispatch ?? -Infinity) < 100) return;
    s.lastDispatch = Date.now();
    s.inFlight = (async () => {
      try {
        if (this.client.exchange) await this.client.exchange(s.ip, 'setPilot', params, { timeoutMs: 600, retryAt: [] });
        else await this.client.control(s.ip, params);
        s.sent++; s.failures = 0; s.lastFrameKey = frameKey; s.lastAck = Date.now(); s.nextAttempt = 0;
      } catch { s.failures++; s.nextAttempt = Date.now() + Math.min(2000, 250 * 2 ** s.failures); }
    })().finally(() => {
      s.inFlight = null;
      if (s.failures >= 4 && !s.stopping) void this.stop(s.id, 'Lampe antwortet nicht. Musikeffekt beendet.');
    });
  }
  async stop(id, error = null) {
    if (this.last?.id === id && this.session?.id !== id) return this.last;
    const s = this.require(id);
    if (s.stopPromise) return s.stopPromise;
    s.stopping = true; clearInterval(s.timer); s.cancelCapture?.();
    s.stopPromise = (async () => {
      await s.inFlight;
      let restored = false;
      try {
        if (s.original) {
          if (this.client.exchange) await this.client.exchange(s.ip, 'setPilot', s.original);
          else await this.client.control(s.ip, s.original);
          restored = true;
        }
      } catch { error = `${error || ''} Vorheriger Lichtzustand konnte nicht bestätigt wiederhergestellt werden.`.trim(); }
      this.last = { id, active: false, restored, error };
      if (this.session === s) this.session = null;
      return this.last;
    })();
    return s.stopPromise;
  }
}
