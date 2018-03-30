#ifndef ZS4_CONFIG_H
#define ZS4_CONFIG_H


#include <stdio.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>
#include <math.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <errno.h>

#include <tinydir.h>

#ifdef _WIN32
#	include <direct.h>
#	pragma warning (disable : 4996)
#	pragma warning (disable : 4244)

#	define WIN32_LEAN_AND_MEAN

#	define chdir _chdir

#	ifndef _CRT_SECURE_NO_WARNINGS
#		define _CRT_SECURE_NO_WARNINGS
#	endif

#	if !defined(S_ISREG) && defined(S_IFMT) && defined(S_IFREG)
#		define S_ISREG(m) (((m) & S_IFMT) == S_IFREG)
#	endif

#	if !defined(S_ISDIR) && defined(S_IFMT) && defined(S_IFDIR)
#		define S_ISDIR(m) (((m) & S_IFMT) == S_IFDIR)
#	endif

#else // sum kinda posix

#include <unistd.h>
#include <dirent.h>

#endif

#ifndef ZS4ANALOG
#	define ZS4ANALOG double
#endif

#ifndef ZS4CHAR
#	define ZS4CHAR unsigned char
#endif

#ifndef ZS4SHORT
#	define ZS4SHORT unsigned short
#endif

#ifndef ZS4LONG
#	define ZS4LONG unsigned long
#endif

#ifndef ZS4LARGE
#	define ZS4LARGE unsigned long long
#endif

#ifndef ZS4CLOCK
#	define ZS4CLOCK clock_t
#endif

#ifndef ZS4_PARSER_SIZE
#define ZS4_PARSER_SIZE ((ZS4LARGE)((ZS4LARGE)256*(ZS4LARGE)256))
#endif

#if defined (_DEBUG) || defined (DEBUG)
#	define DBG_GETCHAR 	getchar()
#else
#	define DBG_GETCHAR
#endif

#ifndef NULL
#define NULL 0
#endif

#endif
