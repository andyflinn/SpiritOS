#ifndef ZS4_QUEUE
#define ZS4_QUEUE

#include "zs4string.h"

#ifndef ZS4_QUEUE_SIZE_DEFAULT
#define ZS4_QUEUE_SIZE_DEFAULT 256
#endif

template <class zs4stringtype>
class zs4ring : public zs4stringtype
{
public:
	inline zs4ring(void){
		reset();
	}

	virtual inline ~zs4ring(void){

	}

	inline virtual size_t readChar(char * c){
		if (!readable())
			return 0;

		*c = str[read_index];

		read_index = ((read_index + 1) % bufsize);

		return 1;
	}

	inline virtual size_t readBlock(void * block, size_t size){
		if (readable() < size)
			return 0;

		char * ptr = (char*)block;

		for (size_t i = 0; i < size; i++)
			readChar(&ptr[i]);

		return size;
	}

	inline virtual size_t writeChar(char c){
		if (!writeable())
			return 0;

		str[write_index] = c;

		write_index = ((write_index + 1) % bufsize);

		return 1;
	}

	inline virtual size_t writeBlock(const void * block, size_t size){
		if (writeable() < size)
			return 0;

		char * ptr = (char*)block;

		for (size_t i = 0; i < size; i++)
			writeChar(ptr[i]);

		return size;
	}

	inline virtual size_t readable(void){
		if (write_index == read_index)
			return 0;

		if (write_index > read_index)
			return (write_index - read_index);

		return (write_index + bufsize - read_index);
	}

	inline virtual size_t writeable(void){
		return ((bufsize - 1) - readable());
	}

	inline virtual void reset(void){
		read_index = write_index = 0;
	}

	inline virtual zs4error close(void){
		stream_state = CLOSED;
		reset();
		return zs4FAILURE;
	}

private:

	size_t read_index;
	size_t write_index;
};

#endif
