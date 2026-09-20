import { setTimeout as delay } from 'node:timers/promises';
import { AppError, capabilities } from './wiz.mjs';

/** In-memory adapter: demo mode never creates UDP sockets or changes real bulbs. */
export class DemoClient {
  constructor() {
    this.history = new Map();
    this.lights = new Map([
      ['192.168.178.50', { state: true, dimming: 65, temp: 2700, sceneId: 0, mac: 'demo00000001' }],
      ['192.168.178.51', { state: false, dimming: 40, temp: 3500, sceneId: 0, mac: 'demo00000002' }],
    ]);
  }
  interfaces() { return [{ name: 'Demo-Netzwerk', address: '192.168.178.2', netmask: '255.255.255.0', network: '192.168.178.0', broadcast: '192.168.178.255' }]; }
  async discover() {
    await delay(300);
    return { devices: [...this.lights].map(([ip, pilot]) => ({ ip, pilot: { ...pilot }, mac: pilot.mac })), warnings: [], interfaces: this.interfaces() };
  }
  async read(ip) {
    await delay(60);
    if (!this.lights.has(ip)) throw new AppError('Im Demo-Modus gibt es nur die beiden simulierten Lampen.', 404, 'DEMO_ONLY');
    return { ...this.lights.get(ip) };
  }
  async inspect(ip) {
    const pilot = await this.read(ip);
    const system = { moduleName: ip.endsWith('.51') ? 'DEMO_SHTW_01' : 'DEMO_SHRGB_01', fwVersion: 'Demo', mac: pilot.mac };
    const model = { cctRange: [2200, 2700, 6500, 6500] };
    return { pilot, system, model, capabilities: capabilities(system, model, pilot), warnings: [] };
  }
  async control(ip, params) {
    const current = await this.read(ip);
    if ('r' in params) { delete current.temp; current.sceneId = 0; }
    if ('temp' in params) for (const key of ['r', 'g', 'b', 'w', 'c']) delete current[key];
    Object.assign(current, params);
    this.lights.set(ip, current);
    this.history.set(ip, [
      { at: new Date().toISOString(), direction: 'send (simuliert)', packet: { method: 'setPilot', params } },
      { at: new Date().toISOString(), direction: 'receive (simuliert)', packet: { method: 'getPilot', result: current } },
    ]);
    return { pilot: { ...current }, warning: null };
  }
}
