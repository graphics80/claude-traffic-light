// Authenticated usage poller.
//
// Polls Claude's own usage endpoint (the one the /usage screen and the
// claude.ai usage page use) and pushes the EXACT remaining percentages for the
// three limits to the device:
//
//   GET https://api.anthropic.com/api/oauth/usage
//     -> .limits[] entries, each with a `percent` USED (0..100):
//          kind "session"                      -> 5h window      -> "H"
//          kind "weekly_all"                   -> 7-day window   -> "W"
//          kind "weekly_scoped" model "Fable"  -> weekly Fable   -> "F"
//
// The device shows REMAINING, so we send (100 - percent). Unlike the ccusage
// estimate this needs no budgets/calibration, carries the per-model Fable limit,
// and keeps updating between sessions.
//
// Auth: the OAuth access token Claude Code already stores locally. We read it
// fresh on every poll so token refreshes are picked up; the token is only ever
// placed in the Authorization header, never logged.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLL_INTERVAL_MS } from './config.mjs';

// Last percentages cached to disk so a device connecting before the first poll
// can be seeded immediately instead of showing boot defaults.
export const USAGE_CACHE = fileURLToPath(new URL('./.usage-cache.json', import.meta.url));

const USAGE_URL = process.env.AMPEL_USAGE_URL
  || 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';

// Pull the access token from the macOS keychain, falling back to the plain
// credentials file (Linux / older installs). Returns '' if none found.
function readToken() {
  return new Promise((resolve) => {
    const fromJson = (s) => {
      try {
        const j = JSON.parse(s);
        return (j.claudeAiOauth && j.claudeAiOauth.accessToken) || j.accessToken || '';
      } catch { return ''; }
    };
    if (process.platform === 'darwin') {
      execFile('security',
        ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { timeout: 5000 },
        (err, stdout) => {
          const tok = err ? '' : fromJson(stdout);
          if (tok) return resolve(tok);
          resolve(readTokenFile());
        });
    } else {
      resolve(readTokenFile());
    }
  });
}

function readTokenFile() {
  try {
    const p = path.join(os.homedir(), '.claude', '.credentials.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (j.claudeAiOauth && j.claudeAiOauth.accessToken) || j.accessToken || '';
  } catch { return ''; }
}

async function fetchUsage(token) {
  const res = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      'anthropic-beta': OAUTH_BETA,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// used percent -> remaining percent, clamped to 0..100
function remaining(pct) {
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - pct)));
}

// Map the labelled limits[] array to { h, w, f } remaining percentages.
function extract(data) {
  const out = { h: null, w: null, f: null };
  for (const l of data.limits || []) {
    if (l.kind === 'session') out.h = remaining(l.percent);
    else if (l.kind === 'weekly_all') out.w = remaining(l.percent);
    else if (l.kind === 'weekly_scoped'
             && l.scope?.model?.display_name === 'Fable') out.f = remaining(l.percent);
  }
  return out;
}

let lastH = null, lastW = null, lastF = null;

async function pollOnce(send) {
  let token;
  try {
    token = await readToken();
    if (!token) throw new Error('no OAuth token found');
  } catch (e) {
    console.error('[usage] token unavailable:', e.message);
    return;
  }
  try {
    const { h, w, f } = extract(await fetchUsage(token));
    if (h != null && h !== lastH) { send(`H ${h}`); lastH = h; }
    if (w != null && w !== lastW) { send(`W ${w}`); lastW = w; }
    if (f != null && f !== lastF) { send(`F ${f}`); lastF = f; }
    try {
      fs.writeFileSync(USAGE_CACHE, JSON.stringify({ h: lastH, w: lastW, f: lastF }));
    } catch {}
    console.log(`[usage] remaining  5h=${h ?? '-'}%  week=${w ?? '-'}%  fable=${f ?? '-'}%`);
  } catch (e) {
    console.error('[usage] poll failed:', e.message);
  }
}

export function startPolling(send) {
  pollOnce(send);
  return setInterval(() => pollOnce(send), POLL_INTERVAL_MS);
}
