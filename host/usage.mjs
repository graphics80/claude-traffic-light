// ccusage-backed token usage poller.
//
// Reads the active 5-hour block and the last 7 days of usage from ccusage,
// converts them to REMAINING percentages, and pushes "H <pct>" / "W <pct>"
// to the device through the supplied send() callback.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FIVE_HOUR_TOKEN_BUDGET,
  WEEKLY_TOKEN_BUDGET,
  POLL_INTERVAL_MS,
} from './config.mjs';

// Last known percentages are cached to disk so the bridge can show them
// immediately on start / reconnect, before the first (slow) ccusage call.
export const USAGE_CACHE = fileURLToPath(new URL('./.usage-cache.json', import.meta.url));

// Try a global `ccusage` first, fall back to `npx ccusage@latest`.
function runCcusage(args) {
  return new Promise((resolve, reject) => {
    execFile('ccusage', args, { timeout: 60000 }, (err, stdout) => {
      if (!err) return resolve(stdout);
      execFile('npx', ['-y', 'ccusage@latest', ...args], { timeout: 120000 }, (err2, stdout2) => {
        if (err2) return reject(err2);
        resolve(stdout2);
      });
    });
  });
}

// used tokens -> percent of budget REMAINING (100 = fresh, 0 = window spent)
function remainingPct(usedTokens, budget) {
  if (!budget || budget <= 0) return 100;
  const pct = Math.round((1 - usedTokens / budget) * 100);
  return Math.max(0, Math.min(100, pct));
}

function isoDaysAgo(n) {
  // Build YYYYMMDD for (today - n) without Date.now()-style helpers being an issue here.
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function fiveHourUsed() {
  const out = await runCcusage(['blocks', '--active', '--json']);
  const data = JSON.parse(out);
  const blocks = data.blocks || [];
  const active = blocks.find((b) => b.isActive) || blocks[blocks.length - 1];
  return active ? Number(active.totalTokens || 0) : 0;
}

async function weeklyUsed() {
  const since = isoDaysAgo(6);
  const out = await runCcusage(['daily', '--since', since, '--json']);
  const data = JSON.parse(out);
  if (data.totals && data.totals.totalTokens != null) {
    return Number(data.totals.totalTokens);
  }
  const daily = data.daily || [];
  return daily.reduce((sum, d) => sum + Number(d.totalTokens || 0), 0);
}

let lastH = null;
let lastW = null;

function writeCache() {
  try {
    fs.writeFileSync(USAGE_CACHE, JSON.stringify({ h: lastH, w: lastW }));
  } catch {}
}

async function pollOnce(send) {
  try {
    const used5h = await fiveHourUsed();
    lastH = remainingPct(used5h, FIVE_HOUR_TOKEN_BUDGET);
    send(`H ${lastH}`);
    console.log(`[usage] 5h used=${used5h} -> remaining ${lastH}%`);
  } catch (e) {
    console.error('[usage] 5h poll failed:', e.message);
  }
  try {
    const usedWeek = await weeklyUsed();
    lastW = remainingPct(usedWeek, WEEKLY_TOKEN_BUDGET);
    send(`W ${lastW}`);
    console.log(`[usage] week used=${usedWeek} -> remaining ${lastW}%`);
  } catch (e) {
    console.error('[usage] weekly poll failed:', e.message);
  }
  writeCache();
}

export function startPolling(send) {
  pollOnce(send);
  return setInterval(() => pollOnce(send), POLL_INTERVAL_MS);
}
