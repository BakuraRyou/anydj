/**
 * Small, independent implementation of the unencrypted local AnyDj UDP protocol.
 * Only lighting controls and read-only metadata are exposed to HTTP clients.
 * This is NOT the authenticated "Only verified controls" protocol.
 */
import dgram from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const WIZ_PORT = 38899;
const PHONE_MAC = `02${randomBytes(5).toString('hex')}`;

export class AppError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
export function isPrivateIPv4(ip) {
  if (typeof ip !== 'string' || isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254);
}
const ipNumber = ip => ip.split('.').reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
const numberIp = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
export function broadcastAddress(address, netmask) {
  return numberIp((ipNumber(address) | ~ipNumber(netmask)) >>> 0);
}
export function getInterfaces() {
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
    (entries || []).filter(x => !x.internal && (x.family === 'IPv4' || x.family === 4) &&
      isPrivateIPv4(x.address)).map(x => ({
      name, address: x.address, netmask: x.netmask,
      network: numberIp((ipNumber(x.address) & ipNumber(x.netmask)) >>> 0),
      broadcast: broadcastAddress(x.address, x.netmask),
    })));
}
export function assertLocalIP(ip, interfaces = getInterfaces()) {
  if (!isPrivateIPv4(ip)) {
    throw new AppError('Bitte eine private IPv4-Adresse der Lampe eingeben, z. B. 192.168.178.42.');
  }
  if (interfaces.some(x => x.address === ip || x.network === ip || x.broadcast === ip)) {
    throw new AppError('Das ist eine Server-, Netz- oder Broadcast-Adresse, keine Lampenadresse.');
  }
  return ip;
}
export function validatePilot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Der Befehl muss ein JSON-Objekt sein.');
  }
  const allowed = new Set(['state', 'dimming', 'r', 'g', 'b', 'temp']);
  if (!Object.keys(input).length || Object.keys(input).some(k => !allowed.has(k))) {
    throw new AppError('Erlaubt sind ausschließlich state, dimming, r, g, b und temp.');
  }
  const result = {};
  if ('state' in input) {
    if (typeof input.state !== 'boolean') throw new AppError('state muss true oder false sein.');
    result.state = input.state;
  }
  const integer = (key, min, max) => {
    if (!(key in input)) return;
    if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) {
      throw new AppError(`${key} muss eine ganze Zahl zwischen ${min} und ${max} sein.`);
    }
    result[key] = input[key];
  };
  integer('dimming', 1, 100);
  integer('temp', 1000, 10000);
  for (const key of ['r', 'g', 'b']) integer(key, 0, 255);
  const rgbCount = ['r', 'g', 'b'].filter(k => k in input).length;
  if (rgbCount && rgbCount !== 3) throw new AppError('RGB immer vollständig als r, g und b senden.');
  if (rgbCount && 'temp' in input) throw new AppError('RGB und Weißtemperatur nicht gleichzeitig senden.');
  if (rgbCount === 3) {
    if (input.r + input.g + input.b === 0) {
      throw new AppError('RGB-Schwarz ist kein Ausschaltbefehl. Bitte den Ein/Aus-Schalter verwenden.');
    }
    // Keep pure RGB colors from inheriting white LED channels from an earlier mode.
    result.c = 0;
    result.w = 0;
  }
  return result;
}
export function capabilities(system = {}, model = {}, pilot = {}) {
  const moduleName = String(system.moduleName || '');
  const rgb = /RGB/i.test(moduleName);
  const tw = /TW/i.test(moduleName);
  const dw = /DW|FANDIM/i.test(moduleName);
  const socket = /SOCKET/i.test(moduleName);
  const known = rgb || tw || dw || socket;
  const candidates = [model.cctRange, model.extRange, model.whiteRange,
    system.cctRange, system.extRange, system.whiteRange];
  const range = candidates.find(x => Array.isArray(x) && x.length >= 2 &&
    x.every(v => Number.isFinite(v) && v >= 1000 && v <= 10000));
  return {
    color: known ? rgb : (['r', 'g', 'b'].every(k => Number.isFinite(pilot[k])) ? true : null),
    temperature: known ? rgb || tw : (pilot.temp > 0 ? true : null),
    brightness: known ? !socket : (Number.isFinite(pilot.dimming) ? true : null),
    minKelvin: range ? Math.min(...range) : 2200,
    maxKelvin: range ? Math.max(...range) : 6500,
    rangeReported: Boolean(range),
    source: known ? 'moduleName' : 'Status / unbekannt',
  };
}

/** One socket per exchange isolates delayed responses from later commands.
 * Explicit commands (not toggles) make retries idempotent for these controls.
 * Loopback/custom port can be used internally by tests, never via the HTTP API.
 */
export function udpRequest(ip, method, params = {}, {
  port = WIZ_PORT, timeoutMs = 3200, retryAt = [650, 1650], onPacket = () => {},
} = {}) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const payload = { method, params };
    const bytes = Buffer.from(JSON.stringify(payload));
    const timers = [];
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      try { socket.close(); } catch { /* Socket may not have finished binding. */ }
      error ? reject(error) : resolve(value);
    };
    const send = () => {
      if (finished) return;
      onPacket('send', payload);
      socket.send(bytes, port, ip, error => {
        if (error) finish(new AppError(`UDP-Senden fehlgeschlagen: ${error.message}`, 502, 'UDP_SEND'));
      });
    };
    socket.on('error', error => finish(new AppError(`UDP-Fehler: ${error.message}`, 502, 'UDP_ERROR')));
    socket.on('message', (buffer, remote) => {
      if (remote.address !== ip || remote.port !== port || buffer.length > 32768) return;
      let packet;
      try { packet = JSON.parse(buffer.toString('utf8')); } catch { return; }
      if (!packet || packet.method !== method) return;
      onPacket('receive', packet);
      if (packet.error) {
        const detail = typeof packet.error === 'object' ? JSON.stringify(packet.error) : String(packet.error);
        finish(new AppError(`Die Lampe meldet bei ${method}: ${detail.slice(0, 400)}`, 502, 'DEVICE_ERROR'));
      } else if (packet.result && typeof packet.result === 'object' && !Array.isArray(packet.result)) {
        if (packet.result.success === false) {
          finish(new AppError(`Die Lampe hat ${method} abgelehnt.`, 502, 'DEVICE_REJECTED'));
        } else finish(null, packet.result);
      }
    });
    timers.push(setTimeout(() => finish(new AppError(
      `Keine UDP-Antwort von ${ip} auf ${method}. WLAN, IP, Firewall und lokale AnyDj-Freigabe prüfen.` +
      (method === 'setPilot' ? ' Der Befehl könnte trotz fehlender Bestätigung angekommen sein.' : ''),
      504, 'UDP_TIMEOUT')), timeoutMs));
    socket.bind(0, '0.0.0.0', () => {
      if (finished) return;
      send();
      for (const ms of retryAt.filter(ms => ms < timeoutMs)) timers.push(setTimeout(send, ms));
    });
  });
}

function discoverInterface(iface, durationMs) {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    const found = new Map();
    const warnings = [];
    const timers = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      try { socket.close(); } catch { /* Not bound. */ }
      resolve({ devices: [...found.values()], warnings });
    };
    const send = (method, params = {}) => {
      if (done) return;
      socket.send(Buffer.from(JSON.stringify({ method, params })), WIZ_PORT, iface.broadcast, error => {
        if (error) warnings.push(`${iface.name}: ${error.message}`);
      });
    };
    socket.on('error', error => { warnings.push(`${iface.name}: ${error.message}`); finish(); });
    socket.on('message', (buffer, remote) => {
      if (remote.port !== WIZ_PORT || !isPrivateIPv4(remote.address) || buffer.length > 32768) return;
      if (((ipNumber(remote.address) & ipNumber(iface.netmask)) >>> 0) !== ipNumber(iface.network)) return;
      let packet;
      try { packet = JSON.parse(buffer.toString('utf8')); } catch { return; }
      if (!packet || !['registration', 'getSystemConfig', 'getPilot'].includes(packet.method)) return;
      const data = packet.result;
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
          (!data.mac && typeof data.state !== 'boolean')) return;
      if (found.size >= 128 && !found.has(remote.address)) return;
      const record = found.get(remote.address) || { ip: remote.address };
      if (typeof data.mac === 'string') record.mac = data.mac;
      if (packet.method === 'getSystemConfig') record.system = data;
      if (packet.method === 'getPilot') record.pilot = data;
      found.set(remote.address, record);
    });
    timers.push(setTimeout(finish, durationMs));
    // Binding to the interface address makes replies use the correct adapter.
    socket.bind(0, iface.address, () => {
      if (done) return;
      try { socket.setBroadcast(true); socket.setTTL(1); }
      catch (error) { warnings.push(`${iface.name}: ${error.message}`); finish(); return; }
      send('getSystemConfig');
      send('getPilot');
      // Compatibility probe: unregister only this process's random synthetic controller.
      // No Wi-Fi pairing, persistent registration, reset or light change is performed.
      send('registration', { phoneMac: PHONE_MAC, phoneIp: iface.address, register: false });
      for (const ms of [850, 1800]) timers.push(setTimeout(() => {
        send('getSystemConfig'); send('getPilot');
      }, ms));
    });
  });
}

export class WizClient {
  constructor({ request = udpRequest, interfaces = getInterfaces } = {}) {
    this.request = request;
    this.interfaces = interfaces;
    this.history = new Map();
  }
  exchange(ip, method, params = {}, options = {}) {
    return this.request(ip, method, params, { ...options, onPacket: (direction, packet) => {
      const events = this.history.get(ip) || [];
      events.push({ at: new Date().toISOString(), direction, packet });
      this.history.set(ip, events.slice(-12));
      if (this.history.size > 128) this.history.delete(this.history.keys().next().value);
    }});
  }
  async discover(selectedAddress = '') {
    let interfaces = this.interfaces().filter(x => x.address !== x.broadcast && x.address !== x.network);
    if (selectedAddress) interfaces = interfaces.filter(x => x.address === selectedAddress);
    if (!interfaces.length) throw new AppError('Keine passende private IPv4-Netzwerkschnittstelle gefunden.', 400, 'NO_INTERFACE');
    const results = await Promise.all(interfaces.slice(0, 12).map(iface => discoverInterface(iface, 3300)));
    const devices = new Map();
    for (const result of results) for (const item of result.devices) {
      devices.set(item.ip, { ...devices.get(item.ip), ...item });
    }
    return { devices: [...devices.values()], warnings: [...new Set(results.flatMap(x => x.warnings))], interfaces };
  }
  async read(ip) {
    const pilot = await this.exchange(ip, 'getPilot');
    if (typeof pilot.state !== 'boolean') {
      throw new AppError('Die Antwort enthält keinen unterstützten Lampenstatus. Gerät eventuell nicht kompatibel.', 502, 'UNSUPPORTED_STATUS');
    }
    return pilot;
  }
  async inspect(ip) {
    const pilot = await this.read(ip);
    const warnings = [];
    const optional = async method => {
      try { return await this.exchange(ip, method, {}, { timeoutMs: 1100, retryAt: [500] }); }
      catch (error) { warnings.push(`${method}: ${error.message}`); return {}; }
    };
    const system = await optional('getSystemConfig');
    let model = await optional('getModelConfig');
    if (!Object.keys(model).length) model = await optional('getUserConfig');
    return { pilot, system, model, warnings, capabilities: capabilities(system, model, pilot) };
  }
  async control(ip, params) {
    await this.exchange(ip, 'setPilot', params);
    await delay(180);
    try { return { pilot: await this.read(ip), warning: null }; }
    catch (error) {
      return { pilot: null, warning: `Befehl von der Lampe bestätigt, Status danach nicht lesbar: ${error.message}` };
    }
  }
}
