import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export async function setupNetworkStatus(mac, {interfaceName = '', execute = run} = {}) {
  if (!/^[a-f0-9]{12}$/i.test(mac || '')) return {visible:false, code:'UNKNOWN_IDENTITY'};
  if (interfaceName && !/^[-a-zA-Z0-9_.]{1,30}$/.test(interfaceName)) return {visible:false, code:'INVALID_INTERFACE'};
  try {
    const { stdout } = await execute('nmcli', ['-t', '-f', 'SSID', 'device', 'wifi', 'list',
      ...(interfaceName ? ['ifname',interfaceName] : []), '--rescan', 'yes'], { timeout: 12000, maxBuffer: 65536 });
    const visible = stdout.split('\n').some(ssid => ssid.toLowerCase() === `wizconfig_${mac.slice(-4).toLowerCase()}`);
    return {visible, code:visible?'SETUP_VISIBLE':'SETUP_NOT_VISIBLE'};
  } catch { return {visible:false, code:'WIFI_SCAN_FAILED'}; }
}
export async function setupNetworkVisible(mac) {
  return (await setupNetworkStatus(mac)).visible;
}
