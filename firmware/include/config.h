#ifndef _CONFIG_H
#define _CONFIG_H

// *******************************
//        Display settings
// *******************************
// Display rotation. USB port location relative to viewer:
//   Bottom: 0 | Left: 270 | Right: 90 | Top: 180
#define ROTATION 0
// Backlight brightness [0..100] (host can override via "B <val>")
#define BRIGHTNESS_DEFAULT 90

// *******************************
//        Ampel (center) geometry
// *******************************
#define CENTER_X 120
#define CENTER_Y 120
// Radius of central traffic-light disc in pixels
#define AMPEL_RADIUS 56
// Blink interval for active states (think/tool) in ms. 0 = no blink.
#define BLINK_MS 500

// *******************************
//        Gauge geometry
// *******************************
// Both gauges are near-full rings with a gap at the bottom.
// Angles in radians; 0 = bottom of circle, increasing clockwise.
#define GAUGE_START (0.30f * PI)
#define GAUGE_END   (1.70f * PI)
// Outer ring = 5-hour token budget remaining
#define OUTER_RADIUS 106
#define OUTER_WIDTH  16
// Inner ring = weekly token budget remaining
#define INNER_RADIUS 80
#define INNER_WIDTH  14
// Track color (empty portion of a gauge)
#define TRACK_COLOR 0x2104   // dim gray
// Gauge fill = percent of the budget REMAINING (drains with usage).
// Color by remaining: > GREEN_MIN green, > AMBER_MIN amber, else red.
#define GAUGE_GREEN_MIN 50   // >50% left -> green
#define GAUGE_AMBER_MIN 20   // 20..50% left -> amber, below -> red

// *******************************
//        Bottom stats text
// *******************************
// "5h NN%  w MM%" printed in the bottom gap below the center disc.
#define STAT_SCALE 2         // pixel scale of the 5x7 font
#define STAT_Y     188       // top y of the text line

// *******************************
//        Session name (input state)
// *******************************
// Shown centered on the disc when the agent is waiting for your input.
#define NAME_SCALE     2     // pixel scale of the 5x7 font
#define NAME_MAX_CHARS 8     // truncate longer names to fit the disc

// Marquee (scrolling tool name in the tool state).
// If the label is wider than MARQUEE_W it scrolls instead of being truncated.
#define MARQUEE_W    (2 * AMPEL_RADIUS - 12)  // visible window width in px
#define MARQUEE_GAP  14      // px gap between loops
#define SCROLL_MS    110     // time per scroll step
#define SCROLL_STEP  2       // px advanced per step

#endif
