#!/usr/bin/env node
// Long-running bridge: TCP server -> USB serial to the RP2040 Ampel.
//
//   node serial-bridge.mjs
//
// Clients connect to TCP 127.0.0.1:7654 and send one line per event; every line
// is forwarded verbatim to the device (newline-terminated). It is fed by:
//   - hook-client.mjs   -> the color/label state (what Claude is doing)
//   - usage-oauth.mjs   -> the exact remaining-usage rings (H / W / F), polled
//                          from Claude's own /api/oauth/usage endpoint
// A legacy ccusage estimator (AMPEL_POLLER=1) is available as a fallback when
// the OAuth token isn't reachable; see host/config.mjs.

import net from 'node:net';
import fs from 'node:fs';
import { SerialPort } from 'serialport';
import {
  TCP_HOST, TCP_PORT, SERIAL_PATH, SERIAL_BAUD,
  OAUTH_POLLER_ENABLED, POLLER_ENABLED,
} from './config.mjs';
import { startPolling as startOauthPolling, USAGE_CACHE } from './usage-oauth.mjs';
import { startPolling as startCcusagePolling } from './usage.mjs';

let port = null;
let currentPath = null;
let reconnectTimer = null;

// Last value seen per command key, so a freshly (re)connected device can be
// brought up to date immediately instead of showing the boot defaults.
const lastState = {}; // 'C'|'H'|'W'|'F'|'N'|'B' -> full line

function cacheLine(line) {
  const key = line.trim()[0];
  if (key && 'CHWFNB'.includes(key)) lastState[key] = line.trim();
}

// Seed gauges from the last poll on disk so a device connecting before the
// first (slow) ccusage call still shows real percentages instead of 0%.
function seedFromCache() {
  try {
    const { h, w, f } = JSON.parse(fs.readFileSync(USAGE_CACHE, 'utf8'));
    if (Number.isFinite(h)) lastState.H = `H ${h}`;
    if (Number.isFinite(w)) lastState.W = `W ${w}`;
    if (Number.isFinite(f)) lastState.F = `F ${f}`;
  } catch {}
  if (!lastState.C) lastState.C = 'C idle';
}

function writeRaw(line) {
  if (!port || !port.isOpen) return;
  port.write(line.endsWith('\n') ? line : line + '\n');
}

function replayState() {
  // Brightness first, then gauges/name, then the color state last.
  for (const k of ['B', 'H', 'W', 'F', 'N', 'C']) {
    if (lastState[k]) writeRaw(lastState[k]);
  }
}

async function resolveSerialPath() {
  if (SERIAL_PATH) return SERIAL_PATH;
  const ports = await SerialPort.list();
  // 1) Most reliable: match the Raspberry Pi RP2040 USB vendor id (2E8A).
  let m = ports.find((p) => (p.vendorId || '').toLowerCase() === '2e8a');
  // 2) macOS / Linux CDC device name patterns.
  if (!m) m = ports.find((p) => /usbmodem|ACM|usbserial/i.test(p.path || ''));
  // 3) Windows fallback: first COM port.
  if (!m && process.platform === 'win32') {
    m = ports.find((p) => /^COM\d+$/i.test(p.path || ''));
  }
  return m ? m.path : null;
}

function writeToDevice(line) {
  cacheLine(line);
  if (port && port.isOpen) {
    writeRaw(line);
  }
  // If not connected we just keep it cached; it replays on reconnect.
}

// Tear down the current port (on error / close / unplug) and retry.
function handleDisconnect(reason) {
  if (port) {
    const p = port;
    port = null;
    currentPath = null;
    try { if (p.isOpen) p.close(() => {}); } catch {}
    console.warn(`[bridge] serial ${reason}, reconnecting...`);
  }
  scheduleReconnect();
}

async function openSerial() {
  const path = await resolveSerialPath();
  if (!path) {
    scheduleReconnect();
    return;
  }
  port = new SerialPort({ path, baudRate: SERIAL_BAUD }, (err) => {
    if (err) {
      console.error('[bridge] open failed:', err.message);
      handleDisconnect('open error');
      return;
    }
    currentPath = path;
    console.log(`[bridge] serial open: ${path} @ ${SERIAL_BAUD}`);
    replayState();
  });
  port.on('error', () => handleDisconnect('error'));
  port.on('close', () => handleDisconnect('closed'));
  // Surface device logs.
  port.on('data', (buf) => process.stdout.write(`[device] ${buf}`));
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerial();
  }, 2000);
}

// Watchdog: some platforms don't emit 'close' on a silent unplug. Poll the
// device list and force a reconnect if our port vanished (hotplug / swap).
setInterval(async () => {
  if (!port || !port.isOpen || !currentPath) return;
  try {
    const ports = await SerialPort.list();
    if (!ports.some((p) => p.path === currentPath)) {
      handleDisconnect('unplugged');
    }
  } catch {}
}, 3000);

// TCP server for hook clients + poller
const server = net.createServer((sock) => {
  let buf = '';
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) writeToDevice(line);
    }
  });
  sock.on('error', () => {});
});

server.listen(TCP_PORT, TCP_HOST, () => {
  console.log(`[bridge] listening on tcp://${TCP_HOST}:${TCP_PORT}`);
});

seedFromCache();
await openSerial();

if (OAUTH_POLLER_ENABLED) {
  console.log('[bridge] usage rings from /api/oauth/usage (exact 5h/week/fable)');
  startOauthPolling(writeToDevice);
}
if (POLLER_ENABLED) {
  console.log('[bridge] ccusage fallback poller enabled (AMPEL_POLLER=1)');
  startCcusagePolling(writeToDevice);
}
if (!OAUTH_POLLER_ENABLED && !POLLER_ENABLED) {
  console.log('[bridge] no usage poller enabled; rings hold cached values');
}
