#ifndef ZS4_ARRAY
#define ZS4_ARRAY

#include <zs4string.h>

#define ZS4_ARRAYBUFFER(n,s) class n:public zs4string{public:inline n(){construct(data,(s*sizeof(void*)),0);clear();};inline virtual ~n(){clear();};private:char data[(s*sizeof(void*))];}

template <class zs4buffer, class zs4type>
class zs4array : public zs4buffer
{
public:

	inline zs4array()
	{
	}
	inline virtual ~zs4array()
	{
	}

	inline zs4type** add(zs4type*obj){
		if (zs4type ** ret = zs4alloc(sizeof(zs4type*)))
		{
			*ret = obj;
			return ret;
		}
		return NULL;
	}

	inline zs4type**array(void){ return (zs4type**)str; }
	inline size_t count(void){ return (len/sizeof(zs4type*)); }
};

#endif

