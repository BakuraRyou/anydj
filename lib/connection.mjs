import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export async function setupNetworkVisible(mac) {
  if (!/^[a-f0-9]{12}$/i.test(mac || '')) return false;
  try {
    const { stdout } = await run('nmcli', ['-t', '-f', 'SSID', 'device', 'wifi', 'list', '--rescan', 'auto'], { timeout: 2500, maxBuffer: 65536 });
    return stdout.split('\n').some(ssid => ssid.toLowerCase() === `wizconfig_${mac.slice(-4).toLowerCase()}`);
  } catch { return false; }
}
