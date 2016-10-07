/* ******************************************************************
   Copyright (C) 1996-2001  Thugs at Bay Inc, All Rights Reserved.

   This program is NOT free software; you can NOT redistribute it.

   Thugs at Bay Contact information:
   email: info@thugsatbay.com or
   phone: 416 534 3562

** *************************************************************** */

#ifndef ZS4_STAT_H
#define ZS4_STAT_H

#include "zs4string.h"

class zs4stat : public zs4StringBuffer
{
public:
	inline zs4stat()
	{
		clear();
	}

	inline virtual ~zs4stat()
	{
	}

	inline zs4error clear(void){
		zs4StringBuffer::clear();
		size = 0;
		created = modified = 0;
		readonly = hidden = isdir = false;
		slash_count = 0;
		return zs4SUCCESS;
	}

	inline static int CompareSlashCountAscend(const void * v1, const void * v2)
	{
		register zs4stat * c1 = ((zs4stat**)v1)[0];
		register zs4stat * c2 = ((zs4stat**)v2)[0];

		return c1->slash_count - c2->slash_count;
	}

	inline static int CompareSlashCountDescend(const void * v1, const void * v2)
	{
		return -CompareSlashCountAscend(v1, v2);
	}

	inline static int CompareFileSizeAscend(const void * v1, const void * v2)
	{
		register zs4stat * c1 = ((zs4stat**)v1)[0];
		register zs4stat * c2 = ((zs4stat**)v2)[0];

		if (c1->isdir)
		{
			if (c2->isdir)
				return 0;

			return -1;
		}
		else
		if (c2->isdir)
			return 1;

		if (c1->size < c2->size)
			return -1;

		if (c1->size > c2->size)
			return 1;

		return 0;
	}

	inline static int CompareFileSizeDescend(const void * v1, const void * v2)
	{
		return -CompareFileSizeAscend(v1, v2);
	}

	inline zs4error GetInfo(const char * objectname)
	{
		zs4error err = zs4SUCCESS;

		struct stat buf;
		memset(&buf, 0, sizeof(buf));

		if (stat(objectname, &buf))
			return zs4FAILURE;

		size = buf.st_size;
		created = buf.st_mtime;
		modified = buf.st_mtime;

		isdir = (S_ISDIR(buf.st_mode));

		err = set(objectname);
		slash_count = strcharcount(str, PATH_SEPARATOR_CHAR);
		return err;
	}

	size_t size;
	time_t created;
	time_t modified;
	bool readonly, hidden, isdir;
	int slash_count;
};

#endif

