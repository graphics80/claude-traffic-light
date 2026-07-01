#include <Arduino.h>
#include <math.h>
#include <string.h>
#include <display.h>
#include <graphics.h>
#include <serialutils.h>
#include <font5x7.h>
#include <config.h>

/*
 * Claude Ampel firmware
 * ---------------------
 * Center disc  = agent state:
 *     green         idle / done
 *     amber blink   thinking
 *     blue solid    running a tool (+ tool name shown on disc)
 *     red blink     WAITING FOR YOUR INPUT (+ session name shown on disc)
 * Outer ring   = 5-hour budget remaining (drains as you use it)
 * Inner ring   = weekly budget remaining
 * Bottom text  = "5h NN%  w MM%"
 *
 * Serial line protocol (115200 baud, '\n' terminated), sent by the host bridge:
 *   C idle | C think | C tool | C input   set agent state
 *   N <text>                               center label (tool name / session name)
 *   H <0..100>                             outer gauge = 5h remaining percent
 *   W <0..100>                             inner gauge = weekly remaining percent
 *   B <0..100>                             backlight brightness
 *   P                                      ping -> replies "ampel ok"
 */

enum Ampel { IDLE = 0, THINK = 1, TOOL = 2, ATTN = 3 };

static Ampel ampel = IDLE;
static Ampel drawnAmpel = (Ampel)-1;
static bool  drawnBlinkOn = true;

static int outerPct = 0, drawnOuter = -1;
static int innerPct = 0, drawnInner = -1;
static int drawnStatsOuter = -1, drawnStatsInner = -1;
static uint16_t drawnOuterColor = 0, drawnInnerColor = 0;

static char nameBuf[32] = "";
static char drawnName[32] = "";

static bool blinkOn = true;
static unsigned long tBlink = 0;

// ---- color helpers ---------------------------------------------------------

static uint16_t ampelColor(Ampel a) {
    switch(a) {
        case THINK: return YELLOW;
        case TOOL:  return BLUE;
        case ATTN:  return RED;
        default:    return GREEN;
    }
}

// Dim an RGB565 color for the blink "off" phase.
static uint16_t dim(uint16_t c) {
    uint8_t r = (c >> 11) & 0x1F;
    uint8_t g = (c >> 5)  & 0x3F;
    uint8_t b =  c        & 0x1F;
    r = (r * 90) / 255;
    g = (g * 90) / 255;
    b = (b * 90) / 255;
    return (r << 11) | (g << 5) | b;
}

static uint16_t gaugeColor(int pct) {
    // pct = percent remaining: high = green, low = red
    if(pct > GAUGE_GREEN_MIN) return GREEN;
    if(pct > GAUGE_AMBER_MIN) return AMBER;
    return RED;
}

// ---- text ------------------------------------------------------------------

static void drawChar(int x, int y, char c, uint8_t scale, uint16_t color) {
    const uint8_t* g = glyph5x7(c);
    for(int row = 0; row < 7; row++) {
        uint8_t bits = g[row];
        for(int col = 0; col < 5; col++) {
            if(bits & (1 << (4 - col))) {
                for(int dy = 0; dy < scale; dy++)
                    for(int dx = 0; dx < scale; dx++)
                        Display::setPixel(x + col*scale + dx, y + row*scale + dy, color);
            }
        }
    }
}

// Advance per char = 6*scale (5 cols + 1 col spacing)
static void drawText(int x, int y, const char* s, uint8_t scale, uint16_t color) {
    for(int i = 0; s[i]; i++) {
        drawChar(x + i * 6 * scale, y, s[i], scale, color);
    }
}

static int textWidth(const char* s, uint8_t scale) {
    return (int) strlen(s) * 6 * scale;
}

// Clears the bottom text band, then prints "5h NN%  w MM%" centered.
static void drawStats(int h, int w) {
    for(int y = STAT_Y - 1; y < STAT_Y + 7 * STAT_SCALE + 1; y++)
        for(int x = 20; x < 220; x++)
            Display::setPixel(x, y, BLACK);

    char buf[24];
    snprintf(buf, sizeof(buf), "5h %d%%  w %d%%", h, w);
    drawText(CENTER_X - textWidth(buf, STAT_SCALE) / 2, STAT_Y, buf, STAT_SCALE, WHITE);
}

static int labelTop() { return CENTER_Y - (7 * NAME_SCALE) / 2; }
static bool labelFits() { return textWidth(nameBuf, NAME_SCALE) <= MARQUEE_W; }

// Draws the current label centered over the disc (used when it fits).
// Tool name in tool state, session name in input state.
static void drawName() {
    if(nameBuf[0] == '\0') return;
    char buf[NAME_MAX_CHARS + 1];
    strncpy(buf, nameBuf, NAME_MAX_CHARS);
    buf[NAME_MAX_CHARS] = '\0';
    drawText(CENTER_X - textWidth(buf, NAME_SCALE) / 2, labelTop(), buf, NAME_SCALE, WHITE);
}

// Like drawChar but only paints pixels within [clipL, clipR).
static void drawCharClip(int x, int y, char c, uint8_t scale, uint16_t color,
                         int clipL, int clipR) {
    const uint8_t* g = glyph5x7(c);
    for(int row = 0; row < 7; row++) {
        uint8_t bits = g[row];
        for(int col = 0; col < 5; col++) {
            if(bits & (1 << (4 - col))) {
                for(int dy = 0; dy < scale; dy++)
                    for(int dx = 0; dx < scale; dx++) {
                        int px = x + col*scale + dx;
                        if(px < clipL || px >= clipR) continue;
                        Display::setPixel(px, y + row*scale + dy, color);
                    }
            }
        }
    }
}

static int scrollOffset = 0;
static unsigned long tScroll = 0;

// Draws one marquee frame of nameBuf inside the disc window, over background bg.
static void drawMarquee(uint16_t bg) {
    const int W = MARQUEE_W;
    const int top = labelTop();
    const int left = CENTER_X - W / 2;
    const int h = 7 * NAME_SCALE;

    // Clear the window band to the disc color.
    for(int y = top; y < top + h; y++)
        for(int x = left; x < left + W; x++)
            Display::setPixel(x, y, bg);

    const int adv = 6 * NAME_SCALE;
    const int glyphs = (int) strlen(nameBuf);
    const int total = glyphs * adv + MARQUEE_GAP;
    const int off = total > 0 ? (scrollOffset % total) : 0;

    // Two copies for a seamless wrap-around.
    for(int rep = 0; rep < 2; rep++) {
        for(int i = 0; i < glyphs; i++) {
            int x = left - off + rep * total + i * adv;
            if(x + adv < left || x > left + W) continue;
            drawCharClip(x, top, nameBuf[i], NAME_SCALE, WHITE, left, left + W);
        }
    }
}

// ---- shapes ----------------------------------------------------------------

static void drawGauge(uint8_t radius, uint8_t width, int pct, uint16_t color) {
    if(pct < 0) pct = 0;
    if(pct > 100) pct = 100;
    Graphics::drawArc(CENTER_X, CENTER_Y, radius, GAUGE_START, GAUGE_END, width, TRACK_COLOR);
    if(pct > 0) {
        float end = GAUGE_START + (pct / 100.0f) * (GAUGE_END - GAUGE_START);
        Graphics::drawRoundedArc(CENTER_X, CENTER_Y, radius, GAUGE_START, end, width, color);
    }
}

static void drawCenter(uint16_t color) {
    Graphics::drawFullCircle(CENTER_X, CENTER_Y, AMPEL_RADIUS, color);
}

// ---- serial parsing --------------------------------------------------------

static char lineBuf[48];
static uint8_t lineLen = 0;

static void handleLine(char* s) {
    while(*s == ' ') s++;
    char cmd = *s;
    char* arg = s + 1;
    while(*arg == ' ') arg++;

    switch(cmd) {
        case 'C':
            if(strncmp(arg, "idle", 4) == 0)       ampel = IDLE;
            else if(strncmp(arg, "think", 5) == 0)  ampel = THINK;
            else if(strncmp(arg, "tool", 4) == 0)   ampel = TOOL;
            else if(strncmp(arg, "input", 5) == 0)  ampel = ATTN;
            break;
        case 'N':
            strncpy(nameBuf, arg, sizeof(nameBuf) - 1);
            nameBuf[sizeof(nameBuf) - 1] = '\0';
            break;
        case 'H': outerPct = atoi(arg); break;
        case 'W': innerPct = atoi(arg); break;
        case 'B': Display::setBrightness((uint8_t) atoi(arg)); break;
        case 'P': sout.info() <= "ampel ok"; break;
        default: break;
    }
}

static void pollSerial() {
    while(Serial.available()) {
        char c = (char) Serial.read();
        if(c == '\n' || c == '\r') {
            if(lineLen > 0) {
                lineBuf[lineLen] = '\0';
                handleLine(lineBuf);
                lineLen = 0;
            }
        } else if(lineLen < sizeof(lineBuf) - 1) {
            lineBuf[lineLen++] = c;
        }
    }
}

// ---- Arduino entry points --------------------------------------------------

void setup() {
    Serial.begin(115200);
    Display::init();
    Display::clear(BLACK);
    Display::setBrightness(BRIGHTNESS_DEFAULT);

    drawGauge(OUTER_RADIUS, OUTER_WIDTH, outerPct, gaugeColor(outerPct));
    drawGauge(INNER_RADIUS, INNER_WIDTH, innerPct, gaugeColor(innerPct));
    drawnOuter = outerPct; drawnOuterColor = gaugeColor(outerPct);
    drawnInner = innerPct; drawnInnerColor = gaugeColor(innerPct);
    drawCenter(ampelColor(ampel));
    drawnAmpel = ampel; drawnBlinkOn = true;

    drawStats(outerPct, innerPct);
    drawnStatsOuter = outerPct; drawnStatsInner = innerPct;

    sout.info() <= "Claude Ampel ready";
}

void loop() {
    pollSerial();

    if(BLINK_MS > 0 && (millis() - tBlink) >= BLINK_MS) {
        tBlink = millis();
        blinkOn = !blinkOn;
    }
    // Only thinking and input blink; tool is solid red, idle solid green.
    bool blinkActive = (ampel == THINK || ampel == ATTN);
    bool wantBlink = blinkActive ? blinkOn : true;

    // Center + optional session name
    bool hasLabel = (ampel == ATTN || ampel == TOOL);
    bool centerRedraw = (ampel != drawnAmpel) || (wantBlink != drawnBlinkOn);
    if(hasLabel && strcmp(nameBuf, drawnName) != 0) centerRedraw = true;
    if(centerRedraw) {
        uint16_t base = ampelColor(ampel);
        drawCenter(wantBlink ? base : dim(base));
        if(hasLabel) {
            if(ampel == TOOL && !labelFits()) {
                scrollOffset = 0;
                tScroll = millis();
                drawMarquee(base);           // start scrolling frame
            } else {
                drawName();                   // static centered label
            }
        }
        drawnAmpel = ampel;
        drawnBlinkOn = wantBlink;
        strncpy(drawnName, nameBuf, sizeof(drawnName));
    }

    // Scroll the tool name when it is too long to fit.
    if(ampel == TOOL && nameBuf[0] && !labelFits()) {
        if(millis() - tScroll >= SCROLL_MS) {
            tScroll = millis();
            scrollOffset += SCROLL_STEP;
            drawMarquee(ampelColor(TOOL));
        }
    }

    uint16_t oc = gaugeColor(outerPct);
    if(outerPct != drawnOuter || oc != drawnOuterColor) {
        drawGauge(OUTER_RADIUS, OUTER_WIDTH, outerPct, oc);
        drawnOuter = outerPct;
        drawnOuterColor = oc;
    }

    uint16_t ic = gaugeColor(innerPct);
    if(innerPct != drawnInner || ic != drawnInnerColor) {
        drawGauge(INNER_RADIUS, INNER_WIDTH, innerPct, ic);
        drawnInner = innerPct;
        drawnInnerColor = ic;
    }

    if(outerPct != drawnStatsOuter || innerPct != drawnStatsInner) {
        drawStats(outerPct, innerPct);
        drawnStatsOuter = outerPct;
        drawnStatsInner = innerPct;
    }

    sleep_ms(10);
}
