#ifndef _SERIALUTILS_H
#define _SERIALUTILS_H

#include <Arduino.h>

// Template wrapper around Serial.print for std::cout-like usage.
// Overloads "<=" to append a newline to the final output.
class Serout {
public:
    template <typename T>
    friend Serout& operator<<(Serout& so, T s) { Serial.print(s); return so; };
    template <typename T>
    friend Serout& operator<=(Serout& so, T s) { Serial.println(s); return so; };
    Serout& warn();
    Serout& err();
    Serout& info();
};

extern Serout sout;

#endif
