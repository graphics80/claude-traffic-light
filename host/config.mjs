// Shared configuration for the Claude Ampel host.
// Override any value via environment variables.

export const TCP_HOST = process.env.AMPEL_TCP_HOST || '127.0.0.1';
export const TCP_PORT = Number(process.env.AMPEL_TCP_PORT || 7654);

// Serial port of the RP2040. Leave empty to auto-detect (first usbmodem/ACM).
export const SERIAL_PATH = process.env.AMPEL_SERIAL_PORT || '';
export const SERIAL_BAUD = Number(process.env.AMPEL_SERIAL_BAUD || 115200);

// How often to poll ccusage for token usage (ms).
export const POLL_INTERVAL_MS = Number(process.env.AMPEL_POLL_MS || 30000);

// Token budgets. The gauges show REMAINING = clamp(1 - used/budget).
// ccusage 'totalTokens' includes cache tokens, so these numbers are large.
// Tune them to your plan by watching `ccusage blocks --active` and
// `ccusage daily` output. See README.
export const FIVE_HOUR_TOKEN_BUDGET = Number(process.env.AMPEL_5H_BUDGET || 250_000_000);
export const WEEKLY_TOKEN_BUDGET   = Number(process.env.AMPEL_WEEK_BUDGET || 2_000_000_000);

// Disable the ccusage poller (e.g. for testing the color states only).
export const POLLER_ENABLED = process.env.AMPEL_NO_POLLER !== '1';
