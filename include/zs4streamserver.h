#ifndef ZS4_STREAMSERVER_H
#define ZS4_STREAMSERVER_H

#include "zs4string.h"
#include "zs4streamhandler.h"

#ifndef ZS4_STREAMSERVER_MAX_STREAMS 
#define ZS4_STREAMSERVER_MAX_STREAMS (64)
#endif

template <class pipetype, class streamhandlertype>
class zs4streamserver : public zs4object
{
public:

	class zs4streamseverprocess : public zs4object
	{
	public:
		pipetype stream;
		streamhandlertype handler;
		zs4streamserver * server;
		size_t id;
		inline void reset(void){
			stream.reset();
			handler.reset();
		}
	};

	inline zs4streamserver(){
		reset();
	}
	virtual inline ~zs4streamserver(void){
		reset();
	}

	inline void reset(void){
		for (size_t i = 0; i < ZS4_STREAMSERVER_MAX_STREAMS; i++){
			process[i].handler.init(&process[i].stream);
			process[i].stream.reset();
			process[i].stream.close();
			process[i].server = this;
			process[i].id = i;
		}
		allocPosition = 0;
	}

	inline zs4streamseverprocess * allocProcess(void)
	{
		zs4streamseverprocess * ret = NULL;
		for (int i = 0; i < ZS4_STREAMSERVER_MAX_STREAMS && ret == NULL; i++)
		{
			if (process[allocPosition].stream.stateGet() == zs4stream::CLOSED)
			{
				ret = &process[allocPosition];
			}
			allocPosition++;
			allocPosition %= ZS4_STREAMSERVER_MAX_STREAMS;
		}

		if (ret != NULL)
		{
			ret->stream.stateSet(zs4stream::ACTIVE);
			ret->stream.reset();
			ret->handler.reset();
		}

		return ret;
	}

	int allocPosition;
	zs4streamseverprocess process[ZS4_STREAMSERVER_MAX_STREAMS];
};

#endif
