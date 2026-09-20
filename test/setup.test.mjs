import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createHash } from 'node:crypto';
import { SetupClient, pairingPayload } from '../lib/setup.mjs';
const device = { mac: 'a8bb5074d27c', name: 'ESP03_SHRGB1C_01', fw: '1.32.0', status: 0 };
const interfaces = () => [{ address: '192.168.56.100', network: '192.168.56.0', netmask: '255.255.255.0' }];
test('Abschluss folgt der bestätigten Heimnetz-IP, wenn das Einrichtungs-WLAN verschwindet', async () => {
  let apAvailable = true;
  const calls = [];
  const client = new SetupClient({ interfaces: () => [
    ...(apAvailable ? interfaces() : []),
    { address: '192.168.178.28', network: '192.168.178.0', netmask: '255.255.255.0' },
  ], fetcher: async (url) => {
    calls.push(url);
    if (url.endsWith('/device')) return Response.json({ ...device, status: 5, ip: '192.168.178.53' });
    return new Response(null, { status: 200 });
  } });
  await client.device();
  apAvailable = false;
  assert.equal((await client.complete(device.mac)).ip, '192.168.178.53');
  assert.deepEqual(calls, ['http://192.168.56.1/device', 'http://192.168.178.53/device', 'http://192.168.178.53/complete']);
});
test('WLAN-Daten: Byte-Grenzen, vollständiges Passwort, zufällige IV, kein Klartextfeld', () => {
  const password = 'a'.repeat(63);
  const payload = pairingPayload('Küche', password);
  const key = Buffer.from(createHash('md5').update('MIIEkjCCA3qgAwIB').digest('hex'));
  const decrypt = value => {
    const cipher = createDecipheriv('aes-256-cbc', key, Buffer.from(payload.iv, 'base64'));
    return Buffer.concat([cipher.update(Buffer.from(value, 'base64')), cipher.final()]).toString();
  };
  assert.equal(decrypt(payload.enc_ssid), 'Küche');
  assert.equal(decrypt(payload.enc_pwd), password);
  assert.equal(payload.pwd, '');
  assert.equal(payload.hid, 0);
  assert.equal(JSON.stringify(payload).includes(password), false);
  assert.notEqual(payload.iv, pairingPayload('Küche', password).iv);
  for (const [ssid, pwd] of [['', password], ['ä'.repeat(17), password], ['WLAN', 'short'], ['WLAN', 'a'.repeat(64)], ['WLAN', 'a\0bcdefghi']]) {
    assert.throws(() => pairingPayload(ssid, pwd));
  }
});
test('Einrichtung erfordert passendes Netz, Firmware und unveränderte MAC', async () => {
  let requests = 0;
  const fetcher = async () => { requests++; return Response.json(device); };
  await assert.rejects(new SetupClient({ interfaces: () => [], fetcher }).device(), { code: 'SETUP_NETWORK' });
  assert.equal(requests, 0);
  const client = new SetupClient({ interfaces, fetcher });
  await assert.rejects(client.pair({ ssid: 'WLAN', password: 'abcdefgh', mac: 'other' }), /geändert/);
  assert.equal(requests, 1);
  const unsupported = new SetupClient({ interfaces, fetcher: async () => Response.json({ ...device, fw: '1.36.1' }) });
  await assert.rejects(unsupported.device(), { code: 'SETUP_UNSUPPORTED' });
});
test('Timeout: keine Wiederholung/Passwortausgabe; Abschluss erst nach WLAN-Bestätigung', async () => {
  let pairingCalls = 0, completeCalls = 0, joined = false;
  const client = new SetupClient({ interfaces, fetcher: async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/device')) return Response.json(joined ? { ...device, status: 5, ip: '192.168.178.40' } : device);
    if (url.endsWith('/pairing')) { pairingCalls++; throw new Error('abcdefgh secret response'); }
    if (url.endsWith('/complete')) { completeCalls++; return new Response(null, { status: 204 }); }
    throw new Error('Unexpected URL');
  } });
  const data = { ssid: 'WLAN', password: 'abcdefgh', mac: device.mac };
  await assert.rejects(client.pair(data), error => error.code === 'SETUP_TIMEOUT' && !error.message.includes(data.password));
  await assert.rejects(client.pair(data), /bereits/);
  assert.equal(pairingCalls, 1);
  await assert.rejects(client.complete(device.mac), /noch nicht bestätigt/);
  assert.equal(completeCalls, 0);
  joined = true;
  assert.equal((await client.complete(device.mac)).ip, '192.168.178.40');
  assert.equal(completeCalls, 1);
});
