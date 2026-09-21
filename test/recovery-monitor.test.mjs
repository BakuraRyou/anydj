import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryMonitor } from '../lib/recovery-monitor.mjs';

const mac = 'a8bb5074d27c';
function fixture(t, overrides = {}) {
  const calls = [];
  const recovery = { config: async () => ({ mac }), running: null };
  const devices = new Map([['old', { ip: '192.168.178.53', mac }]]);
  const monitor = new RecoveryMonitor({ recovery, devices, isBusy: () => false,
    checkConnection: async (...args) => calls.push(args), ...overrides });
  t.after(() => monitor.stop());
  monitor.stopped = false;
  return { monitor, recovery, devices, calls };
}
test('Server prüft konfigurierte Lampe ohne Browser und folgt geänderter IP', async t => {
  const f = fixture(t);
  await f.monitor.tick();
  f.devices.set('old', { mac: mac.toUpperCase(), ip: '192.168.178.54' });
  await f.monitor.tick();
  assert.deepEqual(f.calls, [['192.168.178.53', true], ['192.168.178.54', true]]);
});
test('Deaktivierte Automatik und entfernte Lampe lösen keine Prüfung aus', async t => {
  const f = fixture(t);
  f.devices.clear();
  await f.monitor.tick();
  f.devices.set('old', { mac, ip: '192.168.178.53' });
  f.recovery.config = async () => null;
  await f.monitor.tick();
  assert.equal(f.calls.length, 0);
});
test('Musik und laufendes Pairing pausieren Hintergrundprüfung', async t => {
  let busy = true;
  const f = fixture(t, { isBusy: () => busy });
  await f.monitor.tick();
  busy = false;
  f.recovery.running = Promise.resolve();
  await f.monitor.tick();
  assert.equal(f.calls.length, 0);
  f.recovery.running = null;
  await f.monitor.tick();
  assert.equal(f.calls.length, 1);
});
test('Prüfungen überlappen nicht und laufen nach Fehler weiter', async t => {
  let release, count = 0;
  const f = fixture(t, { checkConnection: async () => {
    count++;
    await new Promise(resolve => { release = resolve; });
    throw Error('offline');
  } });
  const first = f.monitor.tick();
  await Promise.resolve();
  await f.monitor.tick();
  assert.equal(count, 1);
  release(); await first;
  const second = f.monitor.tick();
  await Promise.resolve();
  assert.equal(count, 2);
  release(); await second;
});
test('Stop während Konfigurationslesen verhindert weitere Prüfung', async t => {
  let release;
  const f = fixture(t);
  f.recovery.config = () => new Promise(resolve => { release = resolve; });
  const pending = f.monitor.tick();
  f.monitor.stop(); release({ mac }); await pending;
  assert.equal(f.calls.length, 0);
});
