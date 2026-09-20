import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { AppError, getInterfaces, assertLocalIP, broadcastAddress } from './wiz.mjs';

// Experimental AP protocol, inspected in the original ESP03_SHRGB1C_01 1.32.0
// firmware. See SETUP.md. This is distinct from the UDP control protocol.
const ADDRESS = '192.168.56.1';
export function pairingPayload(ssid, password) {
  if (typeof ssid !== 'string' || Buffer.byteLength(ssid) < 1 || Buffer.byteLength(ssid) > 32 || ssid.includes('\0')) {
    throw new AppError('Der WLAN-Name muss 1–32 UTF-8-Bytes lang sein.');
  }
  if (typeof password !== 'string' || !/^[\x20-\x7e]{8,63}$/.test(password)) {
    throw new AppError('Bitte ein WPA2-Passwort mit 8–63 ASCII-Zeichen verwenden.');
  }
  // offsets [1,0]: first 16 bytes after the first newline of the public certificate.
  // The ASCII hex MD5 digest is the 32-byte AES key (not the binary digest).
  const key = Buffer.from(createHash('md5').update('MIIEkjCCA3qgAwIB').digest('hex'));
  const iv = randomBytes(16);
  const encrypt = value => {
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64');
  };
  return { offsets: [1, 0], enc_ssid: encrypt(ssid), enc_pwd: encrypt(password),
    iv: iv.toString('base64'), pwd: '', hid: 0, env: 'pro', reg: 'eu' };
}

export class SetupClient {
  constructor({ interfaces = getInterfaces, fetcher = fetch } = {}) {
    this.interfaces = interfaces;
    this.fetcher = fetcher;
    this.pendingMac = null;
    this.busy = false;
    this.homeIP = null;
    this.deviceAddress = ADDRESS;
  }
  async request(path, body, address = ADDRESS) {
    const interfaces = this.interfaces();
    assertLocalIP(address, interfaces);
    if (address !== ADDRESS && !interfaces.some(x => broadcastAddress(address, x.netmask) === broadcastAddress(x.address, x.netmask))) {
      throw new AppError("Die neue Lampen-IP liegt nicht im direkt angeschlossenen Heimnetz.", 409, "SETUP_NETWORK");
    }
    if (address === ADDRESS && !interfaces.some(x => x.network === '192.168.56.0' && x.netmask === '255.255.255.0' && x.address !== ADDRESS)) {
      throw new AppError('Den Rechner zuerst mit dem WLAN WiZConfig_… der Lampe verbinden.', 409, 'SETUP_NETWORK');
    }
    let response;
    try {
      response = await this.fetcher(`http://${address}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Never include payloads, response bodies or credentials in errors/logs.
      throw new AppError('Keine Antwort der Einrichtungsschnittstelle. Ein übertragener Auftrag könnte trotzdem angekommen sein; Status prüfen.', 504, 'SETUP_TIMEOUT');
    }
    if (!response.ok) throw new AppError(`Die Lampe hat die Einrichtungsanfrage mit HTTP ${response.status} abgelehnt.`, 502, 'SETUP_REJECTED');
    return response;
  }
  async device() {
    let device;
    try {
      let response;
      try { response = await this.request('/device'); this.deviceAddress = ADDRESS; }
      catch (error) {
        if (!this.homeIP) throw error;
        response = await this.request('/device', undefined, this.homeIP);
        this.deviceAddress = this.homeIP;
      }
      device = await response.json();
    }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Ungültige Geräteantwort.', 502, 'SETUP_DEVICE');
    }
    if (device.name !== 'ESP03_SHRGB1C_01' || device.fw !== '1.32.0' || !/^[a-f0-9]{12}$/i.test(device.mac || '')) {
      throw new AppError('Die experimentelle Einrichtung unterstützt bisher nur ESP03_SHRGB1C_01 mit Firmware 1.32.0.', 409, 'SETUP_UNSUPPORTED');
    }
    if (device.status === 5 && typeof device.ip === 'string') {
      assertLocalIP(device.ip, this.interfaces());
      this.homeIP = device.ip;
    }
    return { mac: device.mac, name: device.name, fw: device.fw, status: device.status,
      ...(typeof device.ip === 'string' ? { ip: device.ip } : {}) };
  }
  async pair({ ssid, password, mac }) {
    if (this.busy || this.pendingMac) throw new AppError('Einrichtungsauftrag läuft bereits. Bitte Status prüfen.', 409);
    const payload = pairingPayload(ssid, password);
    this.busy = true;
    try {
      const device = await this.device();
      if (device.mac !== mac) throw new AppError('Gerät hat sich geändert. Lampe erneut prüfen.', 409);
      this.pendingMac = mac; // Keep on timeout: do not silently repeat a write.
      try { await (await this.request('/pairing', payload)).arrayBuffer(); }
      catch (error) { if (error.code === 'SETUP_REJECTED') this.pendingMac = null; throw error; }
      return { accepted: true, mac };
    } finally { this.busy = false; }
  }
  async complete(mac) {
    if (this.busy) throw new AppError('Einrichtungsauftrag läuft bereits.', 409);
    this.busy = true;
    try {
      const device = await this.device();
      if (device.mac !== mac || device.status !== 5 || !device.ip) {
        throw new AppError('Die Lampe hat den WLAN-Beitritt noch nicht bestätigt.', 409);
      }
      await (await this.request('/complete', {}, this.deviceAddress)).arrayBuffer();
      this.pendingMac = null;
      return { completed: true, mac, ip: device.ip };
    } finally { this.busy = false; }
  }
}
