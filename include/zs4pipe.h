#ifndef ZS4_PIPE
#define ZS4_PIPE

#include "zs4ring.h"

template <class zs4stringtype>
class zs4pipe : public zs4stream
{
public:
	inline zs4pipe(void){
		reset();
	}

	virtual inline ~zs4pipe(void){
	}

	inline virtual void reset(void){
		req.reset();
		rep.reset();
	}

	inline virtual zs4error close(void){
		stream_state = CLOSED;
		reset();
		return zs4FAILURE;
	}

	zs4ring<zs4stringtype> req;
	zs4ring<zs4stringtype> rep;
};

#endif
