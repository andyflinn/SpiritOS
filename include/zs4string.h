#ifndef ZS4_STRING_H
#define ZS4_STRING_H 

#include "zs4stream.h"

#ifndef ZS4_STRINGBUFFER_SIZE
#define ZS4_STRINGBUFFER_SIZE (256)
#endif

#ifndef ZS4_TEXTBUFFER_SIZE
#define ZS4_TEXTBUFFER_SIZE (ZS4_STRINGBUFFER_SIZE*ZS4_STRINGBUFFER_SIZE)
#endif

class zs4string : public zs4stream
{
public:
	inline zs4string(){
		str = NULL;
		len = pos = bufsize = 0;
	}

	inline virtual ~zs4string(){
	}

	inline zs4error clear(void){
		len = pos = 0;
		if (str != NULL)
		{
			str[0] = 0;
			return zs4SUCCESS;
		}

		return zs4FAILURE;
	}

	inline bool check(void) const{
		if (str && str[0] && len)
			return true;

		return false;
	}

	inline zs4error construct( char * s, size_t bs, size_t l ){
		if	(	( bs < 1 )
			||	( s == NULL )
			||	( l < 0 )
			||	( l > bs )
			)
		{ 
			return zs4FAILURE; 
		}

		str = s; bufsize = bs; 
		len = l; pos = 0;
			
		return zs4SUCCESS; 
	}

	inline zs4error construct( char * s, size_t bs ){
		if	( s == NULL )
			return zs4FAILURE; 

		return construct( s, bs, strlen(s) );
	}

	inline virtual size_t writeChar(char c){
		if (pos >= (bufsize-1)) 
			return zs4BUFFEROVERFLOW;

		str[pos] = c;
		
		pos++; 

		if ( pos >= len ) 
		{
			len = pos;
			str[pos] = 0;
		}

		return zs4SUCCESS;
	}

	inline virtual size_t writeBlock(const void * block, size_t size){
		if	( size == 0 )
			return zs4SUCCESS;

		if (pos >= (bufsize-size-1)) 
			return zs4BUFFEROVERFLOW;

		memcpy(&str[pos],block,size);
		pos += size; 

		if ( pos >= len ) 
		{
			len = pos;
			str[pos] = 0;
		}

		return size;
	}

	inline virtual size_t readChar(char * c){
		if ( pos >= len || pos >= bufsize ) 
			return zs4FAILURE; 

		*c = str[pos]; pos++;
		
		return zs4SUCCESS;
	}

	inline virtual size_t readBlock(void * block, size_t size){
	
		char * dst = (char*) block;
		if ((pos+size) <= len)
		{
			memcpy(block,&str[pos],size);
			return size;
		}
		
		size_t ret = 0;
		for	( size_t i = 0 ; i < size ; i++ )
		{
			if	( pos >= len )
				return zs4FAILURE;

			*dst++ = str[pos++];
			
			ret++;
		}

		return ret;
	}
	
	inline virtual zs4error seek( size_t offset, int origin ){ 
		size_t adj = len;
		if	( origin == SEEK_SET ) { adj = 0; }
		else if ( origin == SEEK_CUR ) { adj = pos; }

		offset += adj;

		if ( offset < 0 ) 
		{ 
			pos = 0; return zs4FAILURE; 
		}
		if ( offset > len ) 
		{ 
			pos = len; return zs4FAILURE; 
		}
		pos = offset; return zs4SUCCESS;
	}
	
	inline virtual zs4error set(const char*v){
		clear();
		return write(v);
	}

	inline virtual zs4error set(char c){
		clear();
		return write(c);
	}

	inline virtual zs4error set(int i, const char * fmt = "%d"){
		clear();
		return write(i,fmt);
	}
	
	inline virtual zs4error set(double d, const char * fmt = "%g"){
		clear();
		return write(d,fmt);
	}
	
	inline virtual zs4error set(zs4string * val){
		return set(val->str);
	};

	inline virtual zs4error tell( size_t * pPos ){ 
		*pPos = pos; 
		return zs4SUCCESS; 
	}
	
	inline virtual zs4error set(zs4stream*from){
		clear();
		return write(from);
	}

	inline virtual zs4error setTrim(const char * str){
		if (str == NULL)
			return zs4FAILURE;

		while (str && *str && isspace(*str)) str++;

		size_t len = strlen(str);
		while (len > 0)
		{
			if (!isspace(str[len - 1]))
				break;
			len--;
		}

		clear();

		if (writeBlock(str, len)==len)
			return zs4SUCCESS;
			
		return zs4FAILURE;
	}

	inline virtual zs4error trim(void){
		char * s = str; size_t lead = 0;
		
		if (s == NULL)
			return zs4FAILURE;

		while (s && *s && isspace(*s)) {lead++; s++; }

		if (lead>0)
			strcpy(str,s);
			
		len = strlen(str);
		while (len > 0)
		{
			if (!isspace(str[len - 1]))
				break;
				
			len--;
			str[len] = 0;
		}

		pos = len;

		return zs4SUCCESS;
	}

	inline virtual zs4error lastChar(char ec){
		char w[2];
		w[0] = ec;
		w[1] = 0;

		len = strlen(str);
		if (len < 1)
			return write(w);

		if (str[len - 1] == ec)
			return zs4SUCCESS;

		pos = len;
		return write(w);
	}

	inline static int compareNumberStringAscend(const void * v1, const void * v2)
	{
		register zs4string * fb1 = ((zs4string**)v1)[0];
		register zs4string * fb2 = ((zs4string**)v2)[0];

		int i1 = 0, i2 = 0;
		const char * p1 = (const char *)fb1->str;
		const char * p2 = (const char *)fb2->str;

		for (;;)
		{
			register char c1 = *p1;
			register char c2 = *p2;

			if (c1 == 0 && c2 == 0)
				return 0;

			c1 = charMakeLower(c1);
			c2 = charMakeLower(c2);

			if ((c1 >= '0' && c1 <= '9')
				&& (c2 >= '0' && c2 <= '9')
				)
			{
				i1 = atoi(p1); i2 = atoi(p2);
				if (i1 != i2)
					return (i1 - i2);
			}

			if (c1 != c2)
			{
				return (int)((int)c1 - (int)c2);
			}

			p1++; p2++;
		}
	}

	inline static int compareNumberStringDescend(const void * v1, const void * v2)
	{
		return -compareNumberStringAscend(v1, v2);
	}

	inline static int compareValueAscend(const void * v1, const void * v2)
	{
		register zs4string * c1 = ((zs4string**)v1)[0];
		register zs4string * c2 = ((zs4string**)v2)[0];

		return stricmp(c1->str, c2->str);
	}

	inline static int compareValueDescend(const void * v1, const void * v2)
	{
		return -compareValueAscend(v1, v2);
	}

	inline static int compareLengthAscend(const void * v1, const void * v2)
	{
		register zs4string * c1 = ((zs4string**)v1)[0];
		register zs4string * c2 = ((zs4string**)v2)[0];

		return (int)((int)strlen(c1->str) - (int)strlen(c2->str));
	}

	inline static int compareLengthDescend(const void * v1, const void * v2)
	{
		return -compareLengthAscend(v1, v2);
	}

	inline size_t tokenize(const char * s, const char * sep, const char *** arr){

		size_t count = 0;
		if ( (s == NULL) || (*s == 0) || (sep == NULL) || (*sep == 0) || (arr == NULL) )
			return count;

		clear();
		const char * dummy = NULL;

		// count separators
		int sep_count = strcharcount(s,sep)+1;

		// returned array pointer
		const char ** cpp = *arr = (const char**)str;

		// write an empty string pointer for every separator PLUS ONE
		for (int i = 0; i <= sep_count; i++)
		{
			if (sizeof(dummy) != writeBlock(&dummy, sizeof(dummy)))
				return count;
		}

		// skip leading spaces and separators;
		while ((*s) && ( isspace(*s) || strcharcount(sep,*s)) ) s++;
		if (*s == 0)
			return count;

		char * w = &str[len];
		
		write(s);
		cpp[count++] = w;

		// parser;
		while (*w)
		{
			while (*w != 0 && 0 == strcharcount(sep, *w))w++;
			while (strcharcount(sep, *w)) {
				*w = 0; w++;
			}
			if (*w == 0)
				return count;

			cpp[count++] = w;
		}

		return count;
	}

	inline virtual char * zs4alloc(size_t size)
	{
		if (size > (bufsize - len))
			return NULL;

		char * mem = &str[len];
		len += size;

		memset(mem, 0, size);

		return mem;
	}

	char * str;
	size_t len, pos, bufsize;
};

#define ZS4_STRINGBUFFER(n,s) class n:public zs4string{public:inline n(){construct(data,s,0);clear();};inline virtual ~n(){clear();};private:char data[s];}

ZS4_STRINGBUFFER(zs4StringBuffer, ZS4_STRINGBUFFER_SIZE);
ZS4_STRINGBUFFER(zs4TextBuffer, ZS4_TEXTBUFFER_SIZE);

ZS4_STRINGBUFFER(zs4StringBufferWide, (ZS4_STRINGBUFFER_SIZE*2));

#endif

