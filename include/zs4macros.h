#ifndef ZS4_MACROS_H
#define ZS4_MACROS_H

#define ZS4_STRINGCONSTANT(s,v) static const char * s(void){static const char * st = #v; return st;} static size_t s ## _SIZE(void){return strlen(s());}
#define SPACE_CHAR_STRING " \a\b\f\n\r\t\v"


#endif
