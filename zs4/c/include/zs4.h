#ifndef ZS4_TYPES_H
#define ZS4_TYPES_H

#include <zs4error.h>

typedef class zs4
{
public:
	class driver;
#define device char
#define intclass bpi8
#define symbolclass bpi8Event
#define objectclass bpi8Object
	typedef char bpi8_t;
#include <zs4device.h>

#define device short
#define intclass bpi16
#define symbolclass bpi16Event
#define objectclass bpi16Object
	typedef short bpi16_t;
#include <zs4device.h>

#define device long
#define intclass bpi32
#define symbolclass bpi32Event
#define objectclass bpi32Object
	typedef long bpi32_t;
#include <zs4device.h>

#define device long long
#define intclass bpi64
#define symbolclass bpi64Event
#define objectclass bpi64Object
	typedef long long bpi64_t;
#include <zs4device.h>

	class driver : public zs4::bpi8::object
	{
		bpi8_t _buf_[bpi8::MAX];
	protected:
#define DRIVER_TYPE(t) inline virtual const char * type(void){static const char * t = #t; return t;}
		DRIVER_TYPE(zs4)

	public:

		inline driver(zs4::bpi8::stream * in, zs4::bpi8::stream * out){
			zs4::bpi8::object::construct(NULL,(unsigned char*)_buf_, bpi8::MAX, in, out);
		}
	};

}zs4;

#endif
