#ifndef _DISPLAY_H
#define _DISPLAY_H

#include <Arduino.h>

// SPI configuration
#define PLL_SYS_KHZ (270 * 1000)
#define LCD_SPI_PORT    (spi1)
#define LCD_DC_PIN      (8)
#define LCD_CS_PIN      (9)
#define LCD_CLK_PIN     (10)
#define LCD_MOSI_PIN    (11)
#define LCD_RST_PIN     (12)
#define LCD_BL_PIN      (25)

// Display dimensions
#define LCD_HEIGHT 240
#define LCD_WIDTH 240
// The panel has a few extra rows near the USB port; clear() covers them.
#define LCD_HEIGHT_EXT 245

// Scan direction of display
#define HORIZONTAL 0
#define VERTICAL   1

// Colors (RGB565)
#define WHITE       0xFFFF
#define BLACK       0x0000
#define RED         0xF800
#define GREEN       0x07E0
#define YELLOW      0xFFE0
#define AMBER       0xFC00
#define GRAY        0x8430

/**
 * Display namespace: minimal driver for the Waveshare RP2040-LCD-1.28.
 * Contains source derived from the WaveShare demo code (MIT license, see display.cpp).
 */
namespace Display {
    static uint slice_num;
    static void sendCommand(uint8_t reg);
    static void sendData(uint8_t* data, uint32_t length);
    static void sendData8Bit(uint8_t data);
    static void sendData16Bit(uint16_t data);
    static void initReg();
    static void setAttributes(uint8_t scanDirection);
    static void setWindow(uint16_t xStart, uint16_t yStart, uint16_t xEnd, uint16_t yEnd);
    void init();
    void reset();
    void setBrightness(uint8_t brightness);
    void clear(uint16_t color);
    void setPixel(uint16_t x, uint16_t y, uint16_t color);
}

#endif
