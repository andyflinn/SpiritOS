/* ******************************************************************
   Copyright (C) 1996-2001  Thugs at Bay Inc, All Rights Reserved.

   This program is NOT free software; you can NOT redistribute it.

   Thugs at Bay Contact information:
   email: info@thugsatbay.com or
   phone: 416 534 3562

** *************************************************************** */

#ifndef ZS4_THREAD_H
#define ZS4_THREAD_H

#include "zs4pipe.h"

#ifndef ZS4_THREAD_HANDLE 
#define ZS4_THREAD_HANDLE unsigned int
#endif

#ifndef ZS4_MAX_THREAD_CONNECTIONS
#define ZS4_MAX_THREAD_CONNECTIONS (1024)
#endif

typedef enum {
	IDLE,
	PROCESSING,
	BOOTING,
	SHUTDOWN,
	NUMBER_OF_ZS4_THREAD_STATES
} zs4threadState;

typedef enum {
	CLIENT,
	SERVER
} zs4threadMode;

class zs4thread : public zs4object
{
	typedef zs4error(thread_function_t)(zs4thread *);
public:

	inline zs4thread(size_t count = 0, zs4pipe ** connarr = NULL)
	{
		state = BOOTING;
		join = running = false;
		conn_used = 0;

		if (count)
		{
			while ( conn_used < count && conn_used < ZS4_MAX_THREAD_CONNECTIONS){
				connection[conn_used] = connarr[conn_used];
				conn_used++;
			}
			mode = SERVER;
			create(this, zs4threadStatic, &handle);
		}
		else
		{
			mode = CLIENT;
			handle = thisThread();
		}
	}
	inline virtual ~zs4thread()
	{
		join = true;
		while (running){
			sleepMS(1);
		}
	}

	 
private:

	zs4threadMode mode;
	bool join;
	bool running;
	ZS4_THREAD_HANDLE handle;
	zs4threadState state;
	zs4pipe * connection[ZS4_MAX_THREAD_CONNECTIONS];
	size_t conn_used;

	inline zs4error zs4threadLoop(void){
		state = IDLE;
		running = true;
		while (!join)
		{
		}
		running = false;
	}

	inline static zs4error zs4threadStatic(zs4thread * this_thread){
		this_thread->zs4threadLoop();
	}

	// PLATFORM SPECIFIC MEMBERS
	//////////////////////////////////////////////////////////////
#ifdef	_MSC_VER
	inline static zs4error create(zs4thread * data, thread_function_t * f, ZS4_THREAD_HANDLE * th)
	{
		DWORD id;
		HANDLE h = CreateThread(
			NULL,
			0,
			(LPTHREAD_START_ROUTINE)f, // thread function
			data, // thread arguments
			0,
			&id);

		if (h == NULL)
			return zs4FAILURE;

		*th = (ZS4_THREAD_HANDLE)h;

		return zs4SUCCESS;

	}

	inline static void sleepMS(int ms)
	{
		Sleep(ms);
	}

	inline ZS4_THREAD_HANDLE thisThread(void)
	{
		return (ZS4_THREAD_HANDLE)GetCurrentThread();
	}
#else
#endif
	// END PLATFORM SPECIFIC MEMBERS
	//////////////////////////////////////////////////////////////

};

#endif
