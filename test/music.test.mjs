import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicSession, settings, levels, lightFrame, restoreParams } from '../lib/music.mjs';
const original = { state: false, dimming: 42, r: 255, g: 90, b: 0 };
function fixture(options = {}) {
  const calls = [];
  const client = { inspect: async () => ({ pilot: original, capabilities: { brightness: true, color: true } }), exchange: async (...args) => { calls.push(args); } };
  return { calls, client, music: new MusicSession(client, { tickMs: 100000, ...options }) };
}
test('Audiopegel und Einstellungen sind begrenzt; Weißlampen erhalten keine RGB-Werte', () => {
  for (const input of [{ rms: NaN, bass: 0 }, { rms: 1.1, bass: 0 }, {}]) assert.throws(() => levels(input));
  assert.throws(() => settings({ maximum: 101 }));
  const frame = lightFrame({ rms: 1, bass: 1 }, settings({ maximum: 60 }), 0, 0, false);
  assert.ok(frame.params.dimming <= 60); assert.equal(frame.params.r, undefined);
});
test('Keine Warteschlange: laufendes Paket beendet sich vor neuestem Pegel und Wiederherstellung', async () => {
  const { music, client, calls } = fixture();
  const { id } = await music.start('192.168.1.2', 'file');
  let release;
  client.exchange = (...args) => { calls.push(args); return new Promise(resolve => { release = resolve; }); };
  music.frame(id, { rms: 0.1, bass: 0 }); music.tick(music.session);
  music.frame(id, { rms: 1, bass: 1 }); music.tick(music.session);
  assert.equal(calls.length, 1);
  release(); await music.session.inFlight;
  client.exchange = async (...args) => { calls.push(args); };
  music.tick(music.session); await music.session.inFlight;
  assert.ok(calls[1][2].dimming > calls[0][2].dimming);
  const result = await music.stop(id);
  assert.equal(result.restored, true); assert.deepEqual(calls.at(-1)[2], original);
  assert.deepEqual(await music.stop(id), result);
});
test('Abgelaufene Browserverbindung beendet Erfassung und stellt Zustand wieder her', async () => {
  let stopped = false;
  const { music, calls } = fixture({ capture: () => () => { stopped = true; }, leaseMs: 10 });
  const { id } = await music.start('192.168.1.2', 'system');
  music.session.touched = 0; const session = music.session; music.tick(session);
  await session.stopPromise;
  assert.equal(stopped, true); assert.equal(music.status(id).active, false);
  assert.deepEqual(calls.at(-1)[2], original);
});
test('Abbruch während Geräteprüfung startet keine Audioerfassung', async () => {
  let captured = false, resolve;
  const { music, client } = fixture({ capture: () => { captured = true; return () => {}; } });
  client.inspect = () => new Promise(r => { resolve = r; });
  const starting = music.start('192.168.1.2', 'system');
  await music.stop(music.session.id);
  resolve({ pilot: original });
  await assert.rejects(starting, /abgebrochen/); assert.equal(captured, false); assert.equal(music.session, null);
});
test('Vier ausgefallene Lichtpakete beenden die Sitzung', async () => {
  const { music, client } = fixture();
  const { id } = await music.start('192.168.1.2', 'file'); const s = music.session;
  client.exchange = async () => { throw Error('offline'); };
  for (let i = 0; i < 4; i++) { s.nextAttempt = 0; music.tick(s); await s.inFlight; }
  await s.stopPromise;
  assert.equal(music.status(id).restored, false); assert.match(music.status(id).error, /antwortet nicht/);
});

test('Neue Regler validieren Grenzen, Farbcodes und Mindesthelligkeit', () => {
  for (const option of [null, { minimum: 80, maximum: 70 }, { speed: 0 }, { smoothing: 2 }, { palette: 'invalid' }, { colorA: '#xyzxyz' }, { saturation: 101 }]) assert.throws(() => settings(option));
  assert.equal(settings({ mode: 'disco', palette: 'custom' }).mode, 'disco');
});
test('Helligkeit nutzt feine monotone Stufen und hält den gewählten Bereich ein', () => {
  const o = settings({ minimum: 10, maximum: 90, intensity: 1, smoothing: 0 });
  const values = Array.from({ length: 101 }, (_, i) => lightFrame({ rms: i / 300, bass: 0 }, o, 0, 0).params.dimming);
  assert.ok(new Set(values).size > 65);
  assert.ok(values.every((v, i) => v >= 10 && v <= 90 && (!i || v >= values[i - 1])));
  assert.equal(values[0], 10);
});
test('Kurven heben leise Musik unterschiedlich stark hervor; weiche Übergänge bremsen Sprünge', () => {
  const l = { rms: 0.05, bass: 0.01 };
  const frame = (dynamics, smoothing = 0) => lightFrame(l, settings({ dynamics, smoothing }), 0, 0).smooth;
  assert.ok(frame('sensitive') > frame('balanced')); assert.ok(frame('balanced') > frame('punchy'));
  assert.ok(frame('balanced', 1) < frame('balanced', 0));
});
test('Disco wechselt auf Impulse, nicht bei konstantem Pegel oder Stille', () => {
  const o = settings({ mode: 'disco', palette: 'neon', smoothing: 0 });
  let f = lightFrame({ rms: 0, bass: 0 }, o, 0, 0);
  f = lightFrame({ rms: 0.5, bass: 0.4 }, o, f.animation, 0.125);
  assert.equal(f.beat, true); const position = f.animation.position;
  const bright = f.params.dimming;
  for (let i = 2; i <= 10; i++) { f = lightFrame({ rms: 0.5, bass: 0.4 }, o, f.animation, i * 0.125); assert.equal(f.beat, false); }
  assert.equal(f.animation.position, position);
  for (let i = 11; i <= 40; i++) f = lightFrame({ rms: 0, bass: 0 }, o, f.animation, i * 0.125);
  assert.equal(f.animation.position, position); assert.ok(f.params.dimming < bright); assert.equal(f.params.dimming, o.minimum);
});
test('Eigene Farben, Sättigung und Verlaufstempo verändern RGB bei gleicher Helligkeit', () => {
  const o = settings({ mode: 'color', palette: 'custom', colorA: '#ff0000', colorB: '#0000ff' });
  const l = { rms: 0.1, bass: 0 };
  const a = lightFrame(l, { ...o, speed: 0.2 }, 0, 0);
  const b = lightFrame(l, { ...o, speed: 4 }, 0, 0);
  assert.equal(a.params.dimming, b.params.dimming); assert.ok(b.params.b > a.params.b);
  const pale = lightFrame(l, { ...o, saturation: 20 }, 0, 0);
  assert.ok(pale.params.g > a.params.g);
});
test('Zeitbasierte Glättung bleibt bei unterschiedlichen Paketabständen konsistent', () => {
  const o = settings(); const l = { rms: 0.1, bass: 0 };
  const run = dt => { let state = { smooth: 0, time: 0 }; for (let t = dt; t < 1.001; t += dt) state = lightFrame(l, o, state, t).animation; return state.smooth; };
  assert.ok(Math.abs(run(0.125) - run(0.25)) < 0.00001);
});

test('Schwarze Wunschfarben erzeugen gültige numerische Lampenwerte', () => {
  const { params } = lightFrame({ rms: 0.1, bass: 0 }, settings({ palette: 'custom', colorA: '#000000', colorB: '#000000' }));
  assert.ok(['r', 'g', 'b'].every(k => Number.isInteger(params[k]) && params[k] >= 0 && params[k] <= 255));
  assert.ok(params.r + params.g + params.b > 0);
});

test('Wiederherstellung entfernt sceneId null und trennt Szene, Weißtemperatur und RGB', () => {
  assert.deepEqual(restoreParams({ ...original, sceneId: 0 }), original);
  assert.deepEqual(restoreParams({ ...original, sceneId: 12, speed: 80 }), { state: false, dimming: 42, sceneId: 12, speed: 80 });
  assert.deepEqual(restoreParams({ ...original, sceneId: 0, temp: 2700 }), { state: false, dimming: 42, temp: 2700 });
});
test('Gleiche Lichtwerte werden nicht dauernd gesendet; Fehler lösen eine Sendepause aus', async () => {
  const { music, client, calls } = fixture();
  const { id } = await music.start('192.168.1.2', 'file', { minimum: 5, maximum: 5 });
  const s = music.session;
  music.tick(s); await s.inFlight;
  music.tick(s); assert.equal(calls.length, 1);
  s.lastAck = 0;
  client.exchange = async () => { throw Error('timeout'); };
  music.tick(s); await s.inFlight;
  assert.ok(s.nextAttempt > Date.now());
  music.tick(s); assert.equal(s.failures, 1);
  await music.stop(id);
});

test('Disco erhält acht klare Beats innerhalb einer Farbfamilie und wechselt danach weich', () => {
  const o=settings({mode:'disco',palette:'neon'});let state=0, first;
  for(let i=1;i<=9;i++) {
    const f=lightFrame({rms:0.2,bass:0.1,beatSeq:i},o,state,i*0.5);
    assert.equal(f.beat,true);assert.equal(f.params.dimming,o.maximum);
    if(i===1)first=f.params;
    if(i<=8)assert.deepEqual([f.params.r,f.params.g,f.params.b],[first.r,first.g,first.b]);
    else assert.ok(f.animation.colorPosition>0&&f.animation.colorPosition<1);
    state=f.animation;
  }
});
