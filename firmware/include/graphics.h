#ifndef _graphics_h
#define _graphics_h

#include <pico/stdlib.h>

// Angular drawing resolution
#define ARC_ANGULAR_RES 0.005
// Distance drawing resolution (< 1/sqrt(2))
#define ARC_DISTANCE_RES 0.7

/**
 * Graphics namespace: pixel-based arc and circle drawing.
 * drawArc/drawFullCircle derived from coffeetimer (see graphics.cpp).
 */
namespace Graphics {
    /**
     * Draws an arc centered at (xCenter, yCenter) from radStart to radEnd (radians).
     * 0 rad is at the bottom of the circle (respecting display rotation).
     */
    void drawArc(uint8_t xCenter, uint8_t yCenter, uint8_t radius,
                float radStart, float radEnd, uint8_t width, uint16_t color);

    /** Draws a filled circle centered at (xCenter, yCenter). */
    void drawFullCircle(uint8_t xCenter, uint8_t yCenter, uint8_t radius, uint16_t color);

    /** drawArc with rounded caps at both ends. */
    void drawRoundedArc(uint8_t xCenter, uint8_t yCenter, uint8_t radius,
                    float radStart, float radEnd, uint8_t width, uint16_t color);
}

#endif
