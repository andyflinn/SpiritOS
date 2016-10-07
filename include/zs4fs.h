/* ******************************************************************
   Copyright (C) 1996-2001  Thugs at Bay Inc, All Rights Reserved.

   This program is NOT free software; you can NOT redistribute it.

   Thugs at Bay Contact information:
   email: info@thugsatbay.com or
   phone: 416 534 3562

** *************************************************************** */

#ifndef ZS4_FS_H
#define ZS4_FS_H

#include "zs4stat.h"
//#include "zs4json.h"

#ifndef ZS4_MAX_DIR_SIZE
#define ZS4_MAX_DIR_SIZE (1024)
#endif

#ifndef TAB_FS_MAX_PATH_LENGTH
#define TAB_FS_MAX_PATH_LENGTH (4096)
#endif

class zs4fs : public zs4object
{
public:
	zs4fs::zs4fs()
	{
		count = 0;
	}

	zs4fs::~zs4fs()
	{
	}

	inline static bool IsFile(const char * path)
	{
		struct stat ino;

		if (stat(path, &ino))
			return false;

		if (S_ISREG(ino.st_mode))
			return true;

		return false;
	}

	inline static bool IsDir(const char * path)
	{
		struct stat ino;

		if (stat(path, &ino))
			return false;

		if (S_ISDIR(ino.st_mode))
			return true;

		return false;
	}

	inline static zs4error ChangeDirectory(const char * nu)
	{
		return (zs4error)chdir(nu);
	}

	inline static zs4error GetCurDir(zs4string * cd)
	{
		char * buffer;
		char buf[1024]; buf[0] = 0;
		char *getcwd(char *buf, size_t size);
		buffer = getcwd(buf, 1024);
		return cd->set(buffer);
	}

	inline static zs4error MkDir(const char * name)
	{
		char dirnam[TAB_FS_MAX_PATH_LENGTH];
		char pdir[TAB_FS_MAX_PATH_LENGTH];

		strncpy(dirnam, name, sizeof(dirnam));

		char * f = (char*)dirnam, *t = pdir;

		int ret = 1;

		while (*f != 0)
		{
			char sav = *f;
			*t++ = *f++; *t = 0;
			if ((*f == '/') || (*f == 0))
			{
				ret = mkdir(pdir);
			}
		}

		if (!IsDir(name))
		{
			return zs4FAILURE;
		}

		return zs4SUCCESS;
	}

	inline static zs4error RmFile(const char * name)
	{
		if (!unlink(name)) return zs4SUCCESS;
		return zs4FAILURE;
	}

	inline static zs4error RmDir(const char * name)
	{
		if (!rmdir(name)) return zs4SUCCESS;
		return zs4FAILURE;
	}

	inline static zs4error GetInfo(const char * objectname, zs4stat * info)
	{
		if (objectname == NULL || objectname[0] == 0 || info == NULL)
			return zs4FAILURE;

		return info->GetInfo(objectname);
	}

	inline void Sort(qsort_compare_foo* foo)
	{
		if (count < 2)
			return;

		qsort(statArray, count, sizeof(zs4stat **), foo);
	}

	inline void SortNameAscend(void)
	{
		Sort(zs4string::compareValueAscend);
	}

	inline void SortNameDescend(void)
	{
		Sort(zs4string::compareValueDescend);
	}

	inline void SortLengthAscend(void)
	{
		Sort(zs4string::compareLengthAscend);
	}

	inline void SortLengthDescend(void)
	{
		Sort(zs4string::compareLengthDescend);
	}

	inline time_t Created(const char * fnam)
	{
		zs4stat info;

		if ((!zs4fs::IsFile(fnam))
			|| (zs4SUCCESS != zs4fs::GetInfo(fnam, &info))
			)
			return 0;

		return info.created;
	}

	inline time_t Modified(const char * fnam)
	{
		zs4stat info;

		if ((!zs4fs::IsFile(fnam))
			|| (zs4SUCCESS != zs4fs::GetInfo(fnam, &info))
			)
			return 0;

		return info.modified;
	}

	static const int MAX_PATH_LENGTH;
	static const int DEFAULT_RECURSE_LIMIT;
	static const bool TAB_FS_IS_INSENSITIVE;
	static const bool TAB_FS_HAS_BACKSLASHES;

	size_t List(const char * name, zs4string * out);

#ifdef _MSC_VER
	inline size_t List(const char * name, bool hidden_files)
	{
			count = 0;

			WIN32_FIND_DATA data;

			if (IsFile(name))
				return 0;

			if (!IsDir(name))
				return 0;

			zs4stat * nu;

			zs4StringBufferWide win_name;

			if (!MultiByteToWideChar(CP_OEMCP, 0, name, -1, (LPWSTR)win_name.str, ZS4_STRINGBUFFER_SIZE))
				return 0;

			HANDLE h = FindFirstFile((LPWSTR)win_name.str, &data);
			if ( h != INVALID_HANDLE_VALUE)
			{
				zs4StringBuffer byte;

				WideCharToMultiByte(CP_OEMCP, 0, data.cFileName, -1, byte.str, ZS4_STRINGBUFFER_SIZE, NULL, NULL);

				if ((NULL == (nu = nuStat())) )//|| zs4SUCCESS != nu->GetInfo(byte.str))
				{
					FindClose(h);
					return count;
				}
				else
				{
					while (FindNextFile(h, &data))
					{
						WideCharToMultiByte(CP_OEMCP, 0, data.cFileName, -1, byte.str, ZS4_STRINGBUFFER_SIZE, NULL, NULL);

						if ((NULL == (nu = nuStat())) || zs4SUCCESS != nu->GetInfo(byte.str))
						{
							return count;
						}
					}
				}
				FindClose(h);
			}

			return count;
	}
#else
	inline size_t List(const char * name, bool hidden_files)
	{
		if (IsFile(name))
			return 0;

		if (!IsDir(name))
			return 0;

		int count = 0;

		DIR * dir = opendir(name);
		if (dir != NULL)
		{
			struct dirent * de = 0;

			while (de = readdir(dir))
			{
				if ((de->d_name && de->d_name[0])
					&& (strcmp(de->d_name, "."))
					&& (strcmp(de->d_name, ".."))
					)
				{
					if (!hidden_files && de->d_name[0] == '.')
						continue;

					tab_filebuf * nu = new tab_filebuf();
					if (nu == 0)
						break;

					if (list->AddEnd(nu))
					{
						delete nu;
						break;
					}

					nu->Set(de->d_name);
					count++;
				}
			}

			closedir(dir);
		}

		return count;
	}
#endif

	inline zs4stat * nuStat(void)
	{
		if (count >= (ZS4_MAX_DIR_SIZE - 1))
			return NULL;

		statData[count].clear();
		zs4stat * ret = statArray[count] = &statData[count];
		count++;
		return ret;
	}
	size_t count;
	zs4stat * statArray[ZS4_MAX_DIR_SIZE];
	zs4stat statData[ZS4_MAX_DIR_SIZE];
};

#endif

