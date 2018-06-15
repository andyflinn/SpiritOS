#include <stdio.h>
#include <include/zs4.h>
#include <include/zs4util.h>

#define P(n) printf("%s: %d\n",#n,(int)n())

int main(int argc, char **argv)
{
	util::in in;
	util::out out;

	//zs4::bpi32::bytestream bpi32in((zs4::bpi8::stream*)&in);
	//zs4::bpi32::bytestream bpi32out((zs4::bpi8::stream*)&out);

	unsigned char buffer[255];
	zs4::bpi8::object object(NULL,buffer,255, &in, &out);

	for (;;){
		if (SUCCESS != object.tickle())
		{
			//printf("press ctrl c to quit\n");
		}
	}

	DBG_GETCHAR;

	return 0;
}
