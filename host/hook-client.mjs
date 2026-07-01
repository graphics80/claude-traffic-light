#!/usr/bin/env node
// Fire-and-forget TCP client used by Claude Code hooks.
// Sends a state line (and, when available, the session name) to the bridge.
//
//   node hook-client.mjs C think
//   node hook-client.mjs C tool      (label = tool name from the payload)
//   node hook-client.mjs C input     (label = project name; needs your input)
//
// Claude Code pipes the hook payload as JSON on stdin. Depending on the state we
// derive a center label: the tool name for `tool`, the project (basename of cwd)
// for `input`. Never blocks Claude: short timeouts, all errors ignored.

import net from 'node:net';
import path from 'node:path';
import { TCP_HOST, TCP_PORT } from './config.mjs';

const cmd = process.argv.slice(2).join(' ').trim(); // e.g. "C think"
const state = cmd.split(/\s+/).pop();               // idle | think | tool | input

function readStdin(timeoutMs = 250) {
  return new Promise((res) => {
    if (process.stdin.isTTY) return res('');
    let data = '';
    const t = setTimeout(() => res(data), timeoutMs);
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => { clearTimeout(t); res(data); });
    process.stdin.on('error', () => { clearTimeout(t); res(data); });
  });
}

function labelFromPayload(raw, state) {
  try {
    const o = JSON.parse(raw);
    if (state === 'tool') {
      // Short tool name; strip MCP prefixes like "mcp__server__toolName".
      const t = o.tool_name || '';
      return t.includes('__') ? t.split('__').pop() : t;
    }
    const cwd = o.cwd || (o.workspace && o.workspace.current_dir) || '';
    return cwd ? path.basename(cwd) : '';
  } catch {
    return '';
  }
}

const raw = await readStdin();
const label = labelFromPayload(raw, state);

const lines = [];
if (label && (state === 'tool' || state === 'input')) lines.push(`N ${label}`);
if (cmd) lines.push(cmd);
if (!lines.length) process.exit(0);

const sock = net.createConnection({ host: TCP_HOST, port: TCP_PORT });
sock.setTimeout(600);
const done = () => { try { sock.destroy(); } catch {} process.exit(0); };

sock.on('connect', () => { sock.write(lines.join('\n') + '\n', () => done()); });
sock.on('timeout', done);
sock.on('error', done);
