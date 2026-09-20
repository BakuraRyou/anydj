const clamp = x => Math.max(0, Math.min(1, x));
// Linear audio gains leave headroom even when the same recording plays on both decks.
export function deckGains(position) {
  if (!Number.isFinite(position)) throw Error('Ungültiger Crossfader.');
  const b = clamp(position); return [1 - b, b];
}
export function mixDeckFrames(frames, weights) {
  const total = weights.reduce((sum, w, i) => sum + (frames[i] ? w : 0), 0);
  if (total <= 0) return {state: true, r: 1, g: 1, b: 1, dimming: 5};
  return {state: true, ...Object.fromEntries(['r','g','b','dimming'].map(key => [key,
    Math.round(frames.reduce((sum, frame, i) => sum + (frame ? frame[key] * weights[i] : 0), 0) / total)]))};
}
export function fileIdentity(file) { return `${file.name}\u0000${file.size}\u0000${file.lastModified}`; }
export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function crossfadePosition(from, to, elapsed, duration) {
  if (![from,to,elapsed,duration].every(Number.isFinite) || duration <= 0) throw Error('Ungültiger Übergang.');
  return from + (to-from)*clamp(elapsed/duration);
}
export function automaticFadeSource(decks, position, seconds) {
  const index = position <= .001 ? 0 : position >= .999 ? 1 : -1;
  if (index < 0) return -1;
  const source = decks[index], target = decks[1-index];
  return source.ready && !source.paused && source.remaining > 0 && source.remaining <= seconds &&
    target.ready && target.paused && !target.used ? index : -1;
}
