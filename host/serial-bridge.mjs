#!/usr/bin/env node
// Long-running bridge: TCP server -> USB serial to the RP2040 Ampel.
// Also runs the ccusage poller so the token gauges stay current.
//
//   node serial-bridge.mjs
//
// Hook clients connect to TCP 127.0.0.1:7654 and send one line per event.
// Every line received is forwarded verbatim to the device (newline-terminated).

import net from 'node:net';
import { SerialPort } from 'serialport';
import {
  TCP_HOST, TCP_PORT, SERIAL_PATH, SERIAL_BAUD, POLLER_ENABLED,
} from './config.mjs';
import { startPolling } from './usage.mjs';

let port = null;
let reconnectTimer = null;

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
  const msg = line.endsWith('\n') ? line : line + '\n';
  if (port && port.isOpen) {
    port.write(msg);
  } else {
    console.warn('[bridge] device not open, dropped:', line.trim());
  }
}

async function openSerial() {
  const path = await resolveSerialPath();
  if (!path) {
    console.warn('[bridge] no serial device found, retrying in 3s...');
    scheduleReconnect();
    return;
  }
  port = new SerialPort({ path, baudRate: SERIAL_BAUD }, (err) => {
    if (err) {
      console.error('[bridge] open failed:', err.message);
      scheduleReconnect();
      return;
    }
    console.log(`[bridge] serial open: ${path} @ ${SERIAL_BAUD}`);
  });
  port.on('error', (e) => console.error('[bridge] serial error:', e.message));
  port.on('close', () => {
    console.warn('[bridge] serial closed, reconnecting...');
    port = null;
    scheduleReconnect();
  });
  // Surface device logs.
  port.on('data', (buf) => process.stdout.write(`[device] ${buf}`));
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerial();
  }, 3000);
}

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

await openSerial();

if (POLLER_ENABLED) {
  startPolling(writeToDevice);
} else {
  console.log('[bridge] ccusage poller disabled (AMPEL_NO_POLLER=1)');
}
