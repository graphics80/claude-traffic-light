#!/usr/bin/env node
// Cross-platform installer for the Claude Traffic Light host.
//   - installs host npm deps
//   - writes claude-settings-generated.json (hooks with absolute path filled in)
//   - prints platform-specific next steps
// Works on macOS, Linux and Windows (needs Node.js + npm on PATH).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const hostDir = path.join(root, 'host');
const hook = path.join(hostDir, 'hook-client.mjs');
const bridge = path.join(hostDir, 'serial-bridge.mjs');

console.log('==> Installing host dependencies');
// npm is npm.cmd on Windows and needs a shell there; POSIX runs it directly.
const r = spawnSync('npm', ['install'], {
  cwd: hostDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.error('npm install failed');
  process.exit(1);
}

// Build the hooks block. JSON.stringify escapes backslashes/quotes, so Windows
// paths (with spaces) survive correctly. Node accepts the quoted path on all OSes.
const cmd = (state) => ({ type: 'command', command: `node "${hook}" C ${state}` });
const hooks = {
  SessionStart:     [{ hooks: [cmd('idle')] }],
  UserPromptSubmit: [{ hooks: [cmd('think')] }],
  PreToolUse: [
    { matcher: 'AskUserQuestion',       hooks: [cmd('input')] },
    { matcher: '^(?!AskUserQuestion).*', hooks: [cmd('tool')] },
  ],
  PostToolUse:  [{ matcher: '*', hooks: [cmd('think')] }],
  Stop:         [{ hooks: [cmd('idle')] }],
  Notification: [{ hooks: [cmd('input')] }],
};

const out = path.join(root, 'claude-settings-generated.json');
fs.writeFileSync(out, JSON.stringify({ hooks }, null, 2) + '\n');
console.log(`\n==> Wrote ${out}`);

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const settingsPath = isWin
  ? '%USERPROFILE%\\.claude\\settings.json'
  : '~/.claude/settings.json';

console.log(`
Next steps
----------
1) Merge the "hooks" block from the generated file into your Claude settings:
     ${settingsPath}
   (source: ${out})

2) Start the bridge and keep it running:
     node "${bridge}"
`);

if (isMac) {
  console.log(`   Autostart (macOS): copy com.claude.ampel.plist to ~/Library/LaunchAgents/,
   adjust the paths inside, then:
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude.ampel.plist`);
} else if (isWin) {
  console.log(`   Autostart (Windows): register a logon task (run once):
     schtasks /create /tn ClaudeAmpel /sc onlogon /tr "node \\"${bridge}\\""
   Remove later with:  schtasks /delete /tn ClaudeAmpel /f`);
} else {
  console.log(`   Autostart (Linux): create a systemd --user service running:
     node "${bridge}"`);
}

console.log(`
That's it -- the bridge reads the exact remaining usage (5h, weekly, weekly
Fable) straight from Claude's own usage endpoint using the OAuth token Claude
Code already stores. No calibration, and it keeps updating between sessions.
`);
