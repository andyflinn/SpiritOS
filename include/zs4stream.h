#ifndef ZS4_STREAM_H
#define ZS4_STREAM_H

#include "zs4object.h"

class zs4stream : public zs4object 
{
public:
	typedef enum {
		CLOSED,
		WAITING,		
		ACTIVE,
	STREAM_STATE_COUNT}zs4streamstate;

	zs4streamstate stream_state;

	inline zs4stream(void){ stream_state = CLOSED; };
	inline virtual ~zs4stream(void){};

	inline virtual zs4streamstate stateGet(void){
		return stream_state;
	}

	inline virtual zs4streamstate stateSet(zs4streamstate ss){
		zs4streamstate old = stream_state;
		stream_state = ss;
		return old;
	}

	inline static const char * HEX_CHARS(void){
		static const char * hc = "0123456789abcdef"; return hc;
	}

	inline virtual size_t readBlock(void * block, size_t size){
		size_t ret = 0;

		char * cp = (char*) block;

		for ( size_t i = 0 ; i < size ; i++ )
		{
			if ( 0 == readChar(&cp[i]) )
				return ret;

			ret++;
		}
		
		return ret;
	}

	inline virtual size_t readChar(char * c){
		if (0 == readBlock(c,1) )
			return 0;

		return 1;
	}

	inline virtual size_t writeBlock(const void * block, size_t size){
		size_t ret = 0;

		char * cp = (char*) block;

		for ( size_t i = 0 ; i < size ; i++ )
		{
			if ( 0 == writeChar(cp[i]) )
				return ret;

			ret++;
		}
		
		return ret;
	}

	inline virtual size_t writeChar(char c){
		if (0 == writeBlock(&c,1) )
			return 0;

		return 1;
	}

	inline virtual size_t readable(void){
		return 0;
	}

	inline virtual size_t writeable(void){
		return 0;
	}

	inline virtual zs4error flush(void){
		return zs4FAILURE;
	}

	inline virtual zs4error close(void){
		stream_state = CLOSED;
		return zs4FAILURE;
	}

	inline virtual zs4error rewind(void){
		return seek(0,SEEK_SET); 
	}

	inline virtual zs4error seekEnd(void){ 
		return seek(0,SEEK_END); 
	}

	inline virtual zs4error seek( size_t offset, int origin ){ 
		return zs4FAILURE; 
	}

	inline virtual zs4error tell( size_t * pPos ){ 
		return zs4FAILURE; 
	}

	inline virtual zs4error size(size_t * s){
		zs4error err;
		size_t pos = 0;
		size_t size = 0;

		if ( ( err = tell(&pos) ) != zs4SUCCESS )
			return err;

		if ( ( err = seek(0,SEEK_END) ) != zs4SUCCESS )
			return err;

		if ( ( err = tell(&size) ) != zs4SUCCESS )
			return err;

		if ( ( err = seek(pos,SEEK_SET) ) != zs4SUCCESS )
			return err;

		*s = size;
		
		return zs4SUCCESS;
	}

	inline virtual zs4error write(const char * s){
		size_t l = strlen(s);
		if (l == writeBlock(s,l))
			return zs4SUCCESS;
		return zs4FAILURE; 
	}
	
	inline virtual zs4error write(char c ){
		if (writeChar(c))
			return zs4SUCCESS;
		return zs4FAILURE;
	}
	
	inline virtual zs4error write(int i, const char * fmt = "%d"){
		char buf[128];
		snprintf(buf,sizeof(buf),fmt,i);
		return write(buf);
	}
	
	inline virtual zs4error write(double d, const char * fmt = "%g"){
		char buf[128];
		snprintf(buf,sizeof(buf),fmt,d);
		return write(buf);
	}
	
	inline virtual zs4error write(zs4stream * from){
		if	( from == 0 )
			return zs4FAILURE;

		zs4error err = zs4SUCCESS;

		size_t size = 0;
		if ( ( err = from->size(&size) ) != zs4SUCCESS )
			return err;

		if ( ( err = from->seek(0,SEEK_SET) ) != zs4SUCCESS )
			return err;

		if	( size == 0 )
			return zs4SUCCESS;

		return write(from,size);
	}

	inline virtual zs4error write(zs4stream * from, size_t length )	{
		char buf[4096];

		while ( length > sizeof(buf) )
		{
			if 	( from->readBlock(buf,sizeof(buf)) != sizeof(buf) 
				||writeBlock(buf,sizeof(buf)) != sizeof(buf)
				)
				return zs4FAILURE;

			length -= sizeof(buf);
		}

		if ( length > 0 )
		{
			if 	( from->readBlock(buf,length) != length 
				||writeBlock(buf,length) != length
				)
				return zs4FAILURE;
		}		

		return zs4SUCCESS;
	}

	inline static zs4error copy( zs4stream * from, zs4stream * to ){
		zs4error err = zs4FAILURE;

		size_t size = 0;
		if ( ( err = from->size(&size) ) != zs4SUCCESS )
			return err;

		if ( ( err = from->seek(0,SEEK_SET) ) != zs4SUCCESS )
			return err;

		return to->write(from,size);
	}

	inline zs4error writeJson(const char * out)
	{
		for (const char * str = out; str && *str; str++)
		{
			switch (*str)
			{
			case '\\': write("\\\\"); break;
			case '"': write("\\\""); break;
				//case '\'': Write("\\\'"); break;
			case '/': write("\\/"); break;
			case '\b': write("\\b"); break;
			case '\f': write("\\f"); break;
			case '\n': write("\\n"); break;
			case '\r': write("\\r"); break;
			case '\t': write("\\t"); break;
			default: write(*str); break;
			}
		}
		return zs4SUCCESS;
	}

	inline zs4error writeHex(const char * str, int len)
	{
		if (len < 1)
			return zs4FAILURE;

		zs4error err = zs4SUCCESS;

		for (int i = 0; i < len; i++)
		{
			if (err = writeHex(str[i]))
				return err;
		}

		return zs4SUCCESS;
	}

	inline zs4error writeHex(const char * str)
	{
		if (str == 0 || str[0] == 0)
			return zs4SUCCESS;

		while (str && *str)
		if (zs4SUCCESS != writeHex(*str))
			return zs4FAILURE;

		return zs4SUCCESS;
	}

	inline zs4error writeHex(char c)
	{
		int hi = (c >> 4) & 0x0f;
		if (zs4SUCCESS != write(HEX_CHARS()[(c >> 4) & 0x0f]))
			return zs4FAILURE;

		return write(HEX_CHARS()[c & 0x0f]);
	}
};


#endif
