'use strict';
const $ = id => document.getElementById(id);
let device = null;
let pending = false;
let timer;
let polls = 0;
async function api(path, data) {
  const headers = { 'Content-Type': 'application/json', 'X-AnyDj-Local': '1' };
  const token = sessionStorage.getItem('wiz-web-token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || 'Anfrage fehlgeschlagen.');
    error.code = body.error?.code;
    throw error;
  }
  return body;
}
async function check() {
  clearTimeout(timer);
  $('check').disabled = true;
  try {
    device = await api('/api/setup/device');
    $('status').textContent = `Lampe ${device.mac} · ${device.name} · Firmware ${device.fw} · Einrichtungsstatus ${device.status}`;
    const joined = device.status === 5 && device.ip;
    $('setupForm').hidden = pending || Boolean(joined);
    $('complete').hidden = !joined;
    if (joined) $('result').textContent = `Die Lampe meldet WLAN-Beitritt mit IP ${device.ip}. Du kannst die Einrichtung jetzt abschließen.`;
  } catch (error) {
    device = null;
    $('status').textContent = error.message;
    $('setupForm').hidden = true;
    $('complete').hidden = true;
  } finally {
    $('check').disabled = false;
    if (pending && $('complete').hidden && ++polls < 20) timer = setTimeout(check, 3000);
    else if (pending && $('complete').hidden) $('result').textContent = 'WLAN-Beitritt noch nicht bestätigt. Bitte Verbindung und WLAN-Daten prüfen; Status kann manuell erneut abgefragt werden.';
  }
}
$('check').addEventListener('click', check);
$('setupForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!device || pending) return;
  $('submit').disabled = true;
  // Check the connection again before clearing an entered password or sending.
  // A disconnected AP must not discard credentials or lock the form forever.
  try {
    const current = await api('/api/setup/device');
    if (current.mac !== device.mac) throw new Error('Die Lampe hat sich geändert. Bitte erneut prüfen.');
  } catch (error) {
    $('result').textContent = `${error.message} Es wurden keine WLAN-Daten gesendet. Deine Eingaben bleiben bis zum Neuladen erhalten.`;
    $('submit').disabled = false;
    return;
  }
  pending = true;
  const data = { mac: device.mac, ssid: $('ssid').value, password: $('password').value };
  $('password').value = '';
  try {
    await api('/api/setup/pair', data);
    $('result').textContent = 'Die Lampe hat die WLAN-Daten angenommen. Ihr Beitritt wird jetzt geprüft …';
  } catch (error) {
    $('result').textContent = `${error.message} Es wird nicht automatisch erneut gesendet.`;
    if (['INVALID_INPUT', 'SETUP_NETWORK', 'SETUP_UNSUPPORTED', 'SETUP_REJECTED'].includes(error.code)) {
      pending = false;
      $('submit').disabled = false;
    }
  } finally {
    data.password = '';
    $('setupForm').hidden = true;
    await check();
  }
});
check();
$('complete').addEventListener('click', async () => {
  $('complete').disabled = true;
  clearTimeout(timer);
  try {
    const result = await api('/api/setup/complete', { mac: device.mac });
    pending = false;
    $('result').textContent = `Abschlussanfrage bestätigt. Suche jetzt in der Lampensteuerung oder füge ${result.ip} manuell hinzu. Die Steuerbarkeit im Heimnetz muss noch geprüft werden.`;
    $('complete').hidden = true;
  } catch (error) { $('result').textContent = error.message; }
  finally { $('complete').disabled = false; }
});
