import { AppError } from './app-error.mjs';

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
  const result = { mode: 'soft', intensity: 1.5, minimum: 5, maximum: 100, smoothing: 0.5, speed: 1,
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
// Stateful envelopes keep preview fades consistent across frame intervals.
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
