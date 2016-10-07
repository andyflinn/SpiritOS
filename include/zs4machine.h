#ifndef ZS4_MACHINE_H
#define ZS4_MACHINE_H

#include "zs4jsonparser.h"

typedef int (zs4transform)(const json_value * request, const json_value * state, zs4stream * out);

class zs4machine : public zs4string
{
public:
	inline zs4machine(){
	}

	inline virtual ~zs4machine(){
	}



};



#endif
