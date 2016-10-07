#ifndef ZS4_FILE_H
#define ZS4_FILE_H

#include "zs4string.h"
#include "zs4stat.h"

class zs4file : public zs4stream 
{
public:
	inline zs4file(void){
		stream=NULL;
		close();
	};
		
	inline virtual ~zs4file(void){
		close();
	};

	inline zs4error openRead(const char * name){
		close();

		if (zs4SUCCESS != info.GetInfo(name))
			return zs4FILEINFOERROR;

		stream = fopen(name,"rb");
		if	( stream== NULL )
			return zs4FILEOPENERROR;

		read_able = info.size;
		open_for_write = false;
		return zs4SUCCESS;
	}

	inline zs4error openWrite(const char * name){
		close();
		stream = fopen(name, "w+");
		if	( stream == NULL )
			return zs4FILEOPENERROR;

		write_able = ZS4_TEXTBUFFER_SIZE;
		info.GetInfo(name);
		open_for_write = true;
		return zs4SUCCESS;
	}

	inline virtual size_t readable(void){
		if (stream == NULL) return 0;
		return read_able;
	}

	inline virtual size_t writeable(void){
		if (stream == NULL) return 0;
		return write_able;
	}

	inline zs4error close(void){
		if (stream!=NULL)
		{
			fclose(stream);
			stream = NULL;
		}
		read_able = write_able = 0;
		info.clear();
		open_for_write = false;
		return zs4SUCCESS;
	}

	inline virtual size_t readBlock(void * block, size_t size){
		
		if (stream == NULL)
			return 0;
			
		size_t ret = ::fread(block,1,size,stream);

		if (ret > read_able) read_able = 0;
		read_able -= ret;

		return ret;
	}

	inline virtual size_t writeBlock(const void * block, size_t size){
		
		if (stream == NULL)
			return 0;
			
		return ::fwrite(block,1,size,stream); 
	}

	inline virtual zs4error seek(size_t offset, int origin){
		if	( stream == NULL )
			return zs4FAILURE;

		return (zs4error) ::fseek((FILE*)stream,(long)offset,(int) origin);
	}

	inline virtual zs4error tell(size_t * pPos){
		if	( stream == NULL || pPos == NULL )
			return zs4FAILURE;

		*pPos = ::ftell((FILE*)stream);

		return zs4SUCCESS;
	}

	inline virtual zs4error size(size_t * s){
		if (NULL == stream)
		{
			*s = 0;
			return zs4FAILURE;
		}

		if (open_for_write)
		{
			zs4StringBuffer n;
			n.set(info.str);
			if (zs4SUCCESS != info.GetInfo(n.str))
			{
				*s = 0;
				info.set(n.str);
				return zs4FAILURE;
			}

			*s = info.size;
			return zs4SUCCESS;
		}

		*s = info.size;
		return zs4SUCCESS;
	}

	inline virtual zs4error copyTo(zs4stream*to){
		return copy(this, to);
	}

	inline static zs4error load(const char * filename, zs4stream*to){
		zs4file file;
		zs4error err = file.openRead(filename);
		if (zs4SUCCESS != err)
			return err;

		return file.copyTo(to);
	}

protected:
	size_t read_able, write_able;
	zs4stat info;
	FILE * stream;
	bool open_for_write;
};

class zs4stdin : public zs4file 
{
public:
	inline zs4stdin(void){
		stream=stdin;
	};
		
	inline virtual ~zs4stdin(void){
		stream=NULL;
	};
};

class zs4stdout : public zs4file 
{
public:
	inline zs4stdout(void){
		stream=stdout;
	};
		
	inline virtual ~zs4stdout(void){
		stream=NULL;
	};
};

#endif
