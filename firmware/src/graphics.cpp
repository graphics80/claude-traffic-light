#include <stdlib.h>
#include <graphics.h>
#include <math.h>
#include <Arduino.h>
#include <serialutils.h>
#include <display.h>

// Arc/circle drawing derived from the coffeetimer project.

namespace Graphics {

    void drawArc(uint8_t xCenter, uint8_t yCenter, uint8_t radius,
                float radStart, float radEnd, uint8_t width, uint16_t color) {

        if(radStart >= radEnd) {
            sout.err() <= "drawArc called with radStart >= radEnd";
            return;
        };
        if(width < 1) {
            sout.err() <= "drawArc called with width < 1";
            return;
        }

        int prevX, prevY = -1;

        float radiusCur = max(((float)radius) - (((float)width)/2), 1);
        float radiusEnd = ((float)radius) + (((float)width)/2);

        while(radiusCur < radiusEnd) {
            float angularRes = asinf(1/((float) radiusCur)) * ARC_DISTANCE_RES;
            float radCur = radStart;

            while(radCur < radEnd) {
                int x = xCenter + sinf(radCur)*radiusCur;
                int y = yCenter + cosf(radCur)*radiusCur;

                if(x > 0 && y > 0 && x < LCD_HEIGHT && y < LCD_WIDTH && !(prevX == x && prevY == y)) {
                    Display::setPixel(x, y, color);
                }

                prevX = x;
                prevY = y;
                radCur += angularRes;
            }
            radiusCur += ARC_DISTANCE_RES;
        }
    }

    void drawFullCircle(uint8_t xCenter, uint8_t yCenter, uint8_t radius, uint16_t color) {
        drawArc(xCenter, yCenter, 0, 0, 2*PI, 2*radius, color);
    }

    void drawRoundedArc(uint8_t xCenter, uint8_t yCenter, uint8_t radius,
                    float radStart, float radEnd, uint8_t width, uint16_t color) {
        int x_start = xCenter + sinf(radStart)*radius;
        int y_start = yCenter + cosf(radStart)*radius;
        int x_end = xCenter + sinf(radEnd)*radius;
        int y_end = yCenter + cosf(radEnd)*radius;

        drawFullCircle(x_start, y_start, width/2, color);
        drawArc(xCenter, yCenter, radius, radStart, radEnd, width, color);
        drawFullCircle(x_end, y_end, width/2, color);
    }

}
