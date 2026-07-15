// Shared configuration for the Claude Ampel host.
// Override any value via environment variables.

export const TCP_HOST = process.env.AMPEL_TCP_HOST || '127.0.0.1';
export const TCP_PORT = Number(process.env.AMPEL_TCP_PORT || 7654);

// Serial port of the RP2040. Leave empty to auto-detect (first usbmodem/ACM).
export const SERIAL_PATH = process.env.AMPEL_SERIAL_PORT || '';
export const SERIAL_BAUD = Number(process.env.AMPEL_SERIAL_BAUD || 115200);

// ---------------------------------------------------------------------------
// Usage gauges
//
// Primary source (host/usage-oauth.mjs): Claude's own usage endpoint
// (/api/oauth/usage), authenticated with the OAuth token Claude Code already
// stores. It reports the EXACT remaining percentages the Claude UI shows for
// all three limits -- 5h (H), weekly (W) and weekly Fable (F) -- needs no
// calibration, and keeps updating between sessions. On by default.
//
// How often the usage endpoint is polled (ms).
export const POLL_INTERVAL_MS = Number(process.env.AMPEL_POLL_MS || 30000);

// Turn the authenticated usage poller off with AMPEL_OAUTH_POLLER=0.
export const OAUTH_POLLER_ENABLED = process.env.AMPEL_OAUTH_POLLER !== '0';

// ---------------------------------------------------------------------------
// Legacy ccusage fallback poller (host/usage.mjs). Off by default. Estimates
// usage from token counts, so it is LESS accurate and needs plan-specific
// budgets. Only for setups where the OAuth token isn't available. Enable with
// AMPEL_POLLER=1 -- do not run both pollers at once (they fight over H/W).
export const POLLER_ENABLED = process.env.AMPEL_POLLER === '1';
export const FIVE_HOUR_TOKEN_BUDGET = Number(process.env.AMPEL_5H_BUDGET || 140_000_000);
export const WEEKLY_TOKEN_BUDGET   = Number(process.env.AMPEL_WEEK_BUDGET || 1_100_000_000);
