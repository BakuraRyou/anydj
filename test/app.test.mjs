import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { DemoClient } from '../lib/demo.mjs';
import { assertLocalIP, broadcastAddress, capabilities, udpRequest, validatePilot, WizClient } from '../lib/wiz.mjs';

async function mockUDP(t, handler) {
  const socket = dgram.createSocket('udp4');
  socket.bind(0, '127.0.0.1');
  await once(socket, 'listening');
  socket.on('message', (buffer, peer) => {
    const reply = data => socket.send(typeof data === 'string' ? data : JSON.stringify(data), peer.port, peer.address);
    handler(JSON.parse(buffer.toString()), reply);
  });
  t.after(() => new Promise(resolve => socket.close(resolve)));
  return socket.address().port;
}
async function httpApp(t, options = {}) {
  const app = await createApp({ demo: true, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise(resolve => { app.server.closeAllConnections(); app.server.close(resolve); }));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, method = 'GET', data, extraHeaders = {}) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-AnyDj-Local': '1', ...extraHeaders },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return { ...app, base, call };
}

test('DJ-Seite liefert Styles und den statischen lokalen Modulbaum aus', async t => {
  const {base}=await httpApp(t);
  const page=await fetch(`${base}/dj`);
  assert.equal(page.status,200);
  const html=await page.text();
  const pending=[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(match=>new URL(match[1],base).href);
  const visited=new Set();
  while(pending.length){
    const url=pending.pop();if(visited.has(url))continue;visited.add(url);
    const response=await fetch(url);
    assert.equal(response.status,200,`${url} muss erreichbar sein`);
    assert.match(response.headers.get('content-type')||'',url.endsWith('.css')?/text\/css/:/(?:text|application)\/javascript/,url);
    const source=await response.text();
    if(url.endsWith('.js')){
      for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+\.js)["']/g))pending.push(new URL(match[1],url).href);
    }
  }
  assert.ok(visited.has(`${base}/dj-full.js`));
  assert.ok(visited.has(`${base}/dj-full.css`));
});

test('Berechnet Broadcast-Adressen auch außerhalb eines /24-Netzes', () => {
  assert.equal(broadcastAddress('192.168.178.7', '255.255.255.0'), '192.168.178.255');
  assert.equal(broadcastAddress('10.3.4.17', '255.255.252.0'), '10.3.7.255');
});
test('Akzeptiert private IPv4 und sperrt öffentliche sowie spezielle Ziele', () => {
  for (const ip of ['192.168.1.25', '172.16.2.20', '10.1.2.3']) assert.equal(assertLocalIP(ip, []), ip);
  for (const ip of ['8.8.8.8', '127.0.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', 'localhost', '::1', '192.168.1.999']) {
    assert.throws(() => assertLocalIP(ip, []));
  }
  assert.throws(() => assertLocalIP('192.168.1.255', [{ address: '192.168.1.2', network: '192.168.1.0', broadcast: '192.168.1.255' }]));
});
test('Prüft Steuerwerte; RGB setzt weiße Kanäle zurück', () => {
  assert.deepEqual(validatePilot({ state: true, r: 255, g: 0, b: 30, dimming: 71 }),
    { state: true, dimming: 71, r: 255, g: 0, b: 30, c: 0, w: 0 });
  assert.deepEqual(validatePilot({ state: false }), { state: false });
  for (const bad of [{}, { dimming: 0 }, { dimming: 101 }, { dimming: '50' }, { temp: 999 },
    { state: 1 }, { r: 1 }, { r: 0, g: 0, b: 0 }, { r: 1, g: 2, b: 3, temp: 2700 },
    { method: 'reset' }, { reboot: true }]) assert.throws(() => validatePilot(bad));
});
test('Erkennt Fähigkeiten und gemeldeten Kelvinbereich', () => {
  const rgb = capabilities({ moduleName: 'ESP20_SHRGB_31' }, { cctRange: [2200, 2700, 6500, 6500] });
  assert.equal(rgb.color, true); assert.equal(rgb.minKelvin, 2200); assert.equal(rgb.maxKelvin, 6500);
  assert.equal(capabilities({ moduleName: 'ESP20_SHTW_31' }).color, false);
  assert.equal(capabilities({ moduleName: 'ESP20_SHDW_31' }).temperature, false);
  assert.equal(capabilities({ moduleName: 'ESP25_SOCKET_01' }).brightness, false);
  assert.equal(capabilities().color, null);
});
test('UDP liest echte lokale Datagramme und ignoriert defekte/falsche Nachrichten', async t => {
  const port = await mockUDP(t, (packet, reply) => {
    reply('not-json'); reply({ method: 'other', result: { state: false } });
    reply({ method: packet.method, result: { state: true, dimming: 57 } });
  });
  const result = await udpRequest('127.0.0.1', 'getPilot', {}, { port, timeoutMs: 500, retryAt: [] });
  assert.equal(result.dimming, 57);
});
test('UDP meldet Protokollfehler und abgelehnte Befehle', async t => {
  const port = await mockUDP(t, (packet, reply) => reply(packet.method === 'getModelConfig' ?
    { method: packet.method, error: { code: -32601, message: 'Method not found' } } :
    { method: packet.method, result: { success: false } }));
  await assert.rejects(udpRequest('127.0.0.1', 'getModelConfig', {}, { port, timeoutMs: 500 }), { code: 'DEVICE_ERROR' });
  await assert.rejects(udpRequest('127.0.0.1', 'setPilot', { state: false }, { port, timeoutMs: 500 }), { code: 'DEVICE_REJECTED' });
});
test('UDP wiederholt verlorene Pakete und beendet Timeouts', async t => {
  let received = 0;
  const port = await mockUDP(t, () => { received++; });
  await assert.rejects(udpRequest('127.0.0.1', 'getPilot', {}, { port, timeoutMs: 110, retryAt: [20, 60] }), { code: 'UDP_TIMEOUT' });
  assert.equal(received, 3);
});
test('Demo: Suche, Status, Weißlicht, RGB, Ein/Aus und Namensänderung', async t => {
  const { call } = await httpApp(t);
  assert.equal((await call('/api/meta')).body.demo, true);
  assert.equal((await call('/api/devices')).body.devices.length, 0);
  const discovery = await call('/api/discover', 'POST', {});
  assert.equal(discovery.status, 200); assert.equal(discovery.body.found.length, 2);
  const ip = discovery.body.found[0];
  const read = await call(`/api/devices/${ip}`); assert.equal(read.body.device.pilot.dimming, 65);
  const color = await call(`/api/devices/${ip}/pilot`, 'POST', { state: true, r: 240, g: 12, b: 22, dimming: 73 });
  assert.equal(color.status, 200); assert.equal(color.body.device.pilot.r, 240); assert.equal(color.body.device.pilot.temp, undefined);
  const white = await call(`/api/devices/${ip}/pilot`, 'POST', { state: true, temp: 3400 });
  assert.equal(white.body.device.pilot.temp, 3400); assert.equal(white.body.device.pilot.r, undefined);
  const off = await call(`/api/devices/${ip}/pilot`, 'POST', { state: false });
  assert.equal(off.body.device.pilot.state, false);
  const rename = await call(`/api/devices/${ip}`, 'PATCH', { name: 'Wohnzimmer' });
  assert.equal(rename.body.device.name, 'Wohnzimmer');
});
test('HTTP blockiert Cross-Origin, fehlenden Schreibheader und beliebige RPCs', async t => {
  const { call, base } = await httpApp(t);
  assert.equal((await call('/api/discover', 'POST', {}, { Origin: 'https://fremde-seite.invalid' })).status, 403);
  assert.equal((await call('/api/discover', 'POST', {}, { 'X-AnyDj-Local': '' })).status, 403);
  assert.equal((await call('/api/devices', 'POST', { ip: '8.8.8.8' })).status, 400);
  await call('/api/devices', 'POST', { ip: '192.168.178.50' });
  assert.equal((await call('/api/devices/192.168.178.50/pilot', 'POST', { method: 'reset' })).status, 400);
  const badHostStatus = await new Promise((resolve, reject) => {
    const request = http.get(`${base}/api/meta`, { headers: { Host: 'evil.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    request.on('error', reject);
  });
  assert.equal(badHostStatus, 403);
  const asset = await fetch(`${base}/`); assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
test('LAN-Zugangscode schützt Lesen und Schreiben', async t => {
  const token = 'test-web-token-1234567890';
  const { call } = await httpApp(t, { token });
  const meta = await call('/api/meta'); assert.equal(meta.body.tokenRequired, true);
  assert.equal(JSON.stringify(meta.body).includes(token), false);
  assert.equal((await call('/api/meta', 'GET', undefined, { Authorization: `Bearer ${token}` })).body.tokenRequired, false);
  assert.equal((await call('/api/devices')).status, 401);
  assert.equal((await call('/api/devices', 'GET', undefined, { Authorization: `Bearer ${token}` })).status, 200);
  assert.equal((await call('/api/discover', 'POST', {}, { Authorization: 'Bearer falsch' })).status, 401);
});
test('Weiße Lampe: RGB wird abgelehnt; gemeldete Kelvin-Grenzen gelten', async t => {
  const { call } = await httpApp(t);
  await call('/api/devices', 'POST', { ip: '192.168.178.51' });
  assert.equal((await call('/api/devices/192.168.178.51/pilot', 'POST', { r: 255, g: 0, b: 0 })).status, 400);
  assert.equal((await call('/api/devices/192.168.178.51/pilot', 'POST', { temp: 9000 })).status, 400);
});
test('Echte UDP-Transportkette über HTTP sowie Speicherung ohne falschen Online-Status', async t => {
  let pilot = { state: true, dimming: 40, temp: 2700, mac: 'aabbccddeeff' };
  const port = await mockUDP(t, (packet, reply) => {
    let result;
    if (packet.method === 'getPilot') result = pilot;
    else if (packet.method === 'getSystemConfig') result = { mac: pilot.mac, moduleName: 'ESP20_SHRGB_31', fwVersion: 'TEST' };
    else if (packet.method === 'getModelConfig') result = { cctRange: [2200, 2700, 6500, 6500] };
    else if (packet.method === 'setPilot') { pilot = { ...pilot, ...packet.params }; result = { success: true }; }
    reply({ method: packet.method, result });
  });
  const dir = await mkdtemp(join(tmpdir(), 'wiz-local-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const client = new WizClient({
    request: (_ip, method, params, options) => udpRequest('127.0.0.1', method, params, { ...options, port }),
    interfaces: () => [],
  });
  const { call } = await httpApp(t, { demo: false, client, dataDir: dir });
  const add = await call('/api/devices', 'POST', { ip: '192.168.178.99', name: 'Echte UDP-Teststrecke' });
  assert.equal(add.status, 200); assert.equal(add.body.device.pilot.dimming, 40);
  const control = await call('/api/devices/192.168.178.99/pilot', 'POST', { state: false, dimming: 25 });
  assert.equal(control.status, 200); assert.equal(control.body.device.pilot.state, false);
  assert.equal(pilot.dimming, 25);
  const saved = JSON.parse(await readFile(join(dir, 'devices.json'), 'utf8'));
  assert.equal(saved[0].name, 'Echte UDP-Teststrecke'); assert.equal(saved[0].pilot, undefined);
  const restarted = await createApp({ demo: false, client, dataDir: dir });
  assert.equal(restarted.devices.get('192.168.178.99').online, null);
});
test('Gleichzeitige Steuerbefehle werden pro IP serialisiert', async t => {
  const client = new DemoClient();
  let active = 0, maxActive = 0;
  const original = client.control.bind(client);
  client.control = async (...args) => {
    active++; maxActive = Math.max(maxActive, active);
    try { return await original(...args); } finally { active--; }
  };
  const { call } = await httpApp(t, { client });
  await call('/api/devices', 'POST', { ip: '192.168.178.50' });
  const responses = await Promise.all([11, 22, 33, 44].map(dimming => call('/api/devices/192.168.178.50/pilot', 'POST', { dimming })));
  assert(responses.every(x => x.status === 200)); assert.equal(maxActive, 1);
});
test('Entfernen löscht nur den lokalen Eintrag', async t => {
  const { call, client } = await httpApp(t);
  await call('/api/devices', 'POST', { ip: '192.168.178.50' });
  const result = await call('/api/devices/192.168.178.50', 'DELETE', {});
  assert.equal(result.body.devices.length, 0);
  assert.equal((await client.read('192.168.178.50')).state, true);
});
test('Ältere Firmware: getUserConfig als Fallback für Modellbereich', async () => {
  const calls = [];
  const client = new WizClient({ request: async (_ip, method) => {
    calls.push(method);
    if (method === 'getPilot') return { state: true, dimming: 50 };
    if (method === 'getSystemConfig') return { moduleName: 'ESP01_SHRGB_01' };
    if (method === 'getModelConfig') throw new Error('Method not found');
    if (method === 'getUserConfig') return { extRange: [2700, 6500] };
  }});
  const result = await client.inspect('192.168.178.50');
  assert(calls.includes('getUserConfig'));
  assert.equal(result.capabilities.minKelvin, 2700);
  assert.equal(result.capabilities.rangeReported, true);
});
test('Bestätigter Befehl ohne lesbaren Folgestatus erzeugt Warnung statt erfundener Werte', async () => {
  const client = new WizClient({ request: async (_ip, method) => {
    if (method === 'setPilot') return { success: true };
    throw new Error('Test: Statusantwort verloren');
  }});
  const result = await client.control('192.168.178.50', { state: false });
  assert.equal(result.pilot, null);
  assert.match(result.warning, /bestätigt/);
  assert.match(result.warning, /Statusantwort verloren/);
});

test('Musik-API prüft Pegel, sperrt konkurrierende Steuerung und stellt Demo-Licht wieder her', async t => {
  const { call, client } = await httpApp(t);
  const discovered = await call('/api/discover', 'POST', {}); const ip = discovered.body.found[0];
  const before = (await client.inspect(ip)).pilot;
  assert.equal((await call('/api/music/start', 'POST', { ip, source: 'system' })).status, 403);
  const start = await call('/api/music/start', 'POST', { ip, source: 'file' });
  assert.equal(start.status, 200); const id = start.body.id;
  assert.equal((await call('/api/music/frame', 'POST', { id, rms: 2, bass: 0 })).status, 400);
  assert.equal((await call('/api/music/frame', 'POST', { id, rms: 0.5, bass: 0.2 })).status, 202);
  assert.equal((await call(`/api/devices/${ip}/pilot`, 'POST', { state: false })).status, 409);
  assert.equal((await call('/api/music/stop', 'POST', { id })).body.restored, true);
  const after = (await client.inspect(ip)).pilot;
  assert.equal(after.state, before.state); assert.equal(after.dimming, before.dimming);
});

test('Statusabfrage während Musik verwendet gekennzeichneten Cache ohne konkurrierendes getPilot', async t => {
  const { call, client } = await httpApp(t);
  const ip = (await call('/api/discover', 'POST', {})).body.found[0];
  const { body: { id } } = await call('/api/music/start', 'POST', { ip, source: 'file' });
  const read = client.read, inspect = client.inspect;
  client.read = client.inspect = async () => { throw Error('Statusabfrage darf nicht auf die Lampe zugreifen'); };
  const status = await call(`/api/devices/${ip}`);
  assert.equal(status.status, 200); assert.equal(status.body.device.musicActive, true);
  assert.match(status.body.device.warnings.join(' '), /zuletzt gelesenen/);
  assert.equal((await call('/api/discover', 'POST', {})).status, 409);
  client.read = read; client.inspect = inspect;
  await call('/api/music/stop', 'POST', { id });
  assert.equal((await call(`/api/devices/${ip}`)).body.device.musicActive, false);
});

test('Seitenprüfung verbindet bekannte Lampe und fasst parallele Prüfungen zusammen', async t => {
  const { call, client } = await httpApp(t);
  const ip = (await call('/api/discover', 'POST', {})).body.found[0];
  let inspections = 0; const inspect = client.inspect.bind(client);
  client.inspect = async address => { inspections++; return inspect(address); };
  const replies = await Promise.all([call('/api/connection', 'POST', { ip }), call('/api/connection', 'POST', { ip })]);
  assert.ok(replies.every(r => r.body.state === 'ready'));
  assert.equal(inspections, 1);
  assert.equal((await call('/api/connection', 'POST', { ip }, { 'X-AnyDj-Local': '' })).status, 403);
});
test('Seitenprüfung findet geänderte IP anhand MAC und erhält den Lampennamen', async t => {
  const { call, client, devices } = await httpApp(t);
  const ip = (await call('/api/discover', 'POST', {})).body.found[0];
  const name = devices.get(ip).name, next = '192.168.178.70';
  client.lights.set(next, client.lights.get(ip)); client.lights.delete(ip);
  const result = await call('/api/connection', 'POST', { ip });
  assert.equal(result.body.state, 'ready'); assert.equal(result.body.device.ip, next);
  assert.equal(result.body.device.name, name); assert.equal(devices.has(ip), false);
  assert.equal((await call('/api/connection', 'POST', { ip })).body.device.ip, next);
});
test('Fremdes Gerät an alter IP wird nicht als bekannte Lampe übernommen', async t => {
  const { call, client } = await httpApp(t);
  const ip = (await call('/api/discover', 'POST', {})).body.found[0];
  client.lights.get(ip).mac = 'ffffffffffff';
  const result = await call('/api/connection', 'POST', { ip });
  assert.equal(result.body.state, 'offline'); assert.notEqual(result.body.device.mac, 'ffffffffffff');
});
test('Seitenprüfung erkennt Einrichtungsnetz und begrenzt wiederholte erfolglose Suchen', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wiz-connection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const client = new DemoClient();
  const { call } = await httpApp(t, { demo: false, dataDir: directory, client, detectSetup: async () => true });
  const ip = (await call('/api/discover', 'POST', {})).body.found[0];
  client.lights.clear(); let searches = 0;
  client.discover = async () => { searches++; return { devices: [] }; };
  const first = await call('/api/connection', 'POST', { ip });
  assert.equal(first.body.state, 'setup'); assert.equal(first.body.setupUrl, '/setup');
  assert.equal((await call('/api/connection', 'POST', { ip })).body.state, 'setup');
  assert.equal(searches, 1);
});

test('Nach Stromunterbrechung umgeht manuelle Prüfung den Fehlercache', async t => {
  const {call,client}=await httpApp(t);
  const ip=(await call('/api/discover','POST',{})).body.found[0];
  const lamp=client.lights.get(ip);client.lights.delete(ip);
  assert.equal((await call('/api/connection','POST',{ip})).body.state,'offline');
  client.lights.set(ip,lamp);
  assert.equal((await call('/api/connection','POST',{ip,force:true})).body.state,'ready');
});
test('Suche prüft bekannte IP direkt bei fehlender Broadcast-Antwort und löscht Fehlercache', async t => {
  const {call,client}=await httpApp(t);
  const ip=(await call('/api/discover','POST',{})).body.found[0];
  const lamp=client.lights.get(ip);client.lights.delete(ip);
  await call('/api/connection','POST',{ip});client.lights.set(ip,lamp);
  client.discover=async()=>({devices:[],warnings:[],interfaces:client.interfaces()});
  const search=await call('/api/discover','POST',{});
  assert.ok(search.body.found.includes(ip));
  assert.equal((await call('/api/connection','POST',{ip})).body.state,'ready');
});

test('Lokale API akzeptiert neuen und bisherigen App-Header, aber keinen fehlenden',async t=>{
 const {base}=await httpApp(t);
 for(const name of ['X-AnyDj-Local','X-WiZ-Local']){
  const response=await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json',[name]:'1'},body:'{}'});
  assert.equal(response.status,200);
 }
 const denied=await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(denied.status,403);
});
