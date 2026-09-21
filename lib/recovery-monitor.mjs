// Run only the explicitly configured recovery, independently of browser pages.
export class RecoveryMonitor {
  constructor({ recovery, devices, checkConnection, isBusy, intervalMs = 15000 }) {
    Object.assign(this, { recovery, devices, checkConnection, isBusy, intervalMs });
    this.stopped = true;
    this.pending = null;
  }
  async tick() {
    if (this.stopped || this.pending || this.isBusy() || this.recovery.running) return;
    const task = (async () => {
      const config = await this.recovery.config();
      if (!config || this.stopped || this.isBusy() || this.recovery.running) return;
      const device = [...this.devices.values()].find(d => d.mac?.toLowerCase() === config.mac.toLowerCase());
      if (device) await this.checkConnection(device.ip, true);
    })();
    this.pending = task;
    try { await task; }
    catch { /* A transient failure must not stop future recovery checks. */ }
    finally { this.pending = null; }
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    const poll = async () => {
      await this.tick();
      if (!this.stopped) {
        this.timer = setTimeout(poll, this.intervalMs);
        this.timer.unref?.();
      }
    };
    void poll();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}
