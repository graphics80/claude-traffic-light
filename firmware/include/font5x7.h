#ifndef _FONT5X7_H
#define _FONT5X7_H

#include <pico/stdlib.h>

/**
 * Returns a pointer to 7 bytes describing glyph `c` in a 5x7 bitmap font.
 * Each byte is one row, low 5 bits used, MSB = leftmost column.
 * Lowercase letters map to uppercase. Unknown chars render as blank.
 */
const uint8_t* glyph5x7(char c);

#endif
