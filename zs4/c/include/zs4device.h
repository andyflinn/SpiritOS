
#include <zs4error.h>

#ifndef device
#define device char
#define intclass bpi8
typedef char bpi8_t;
#endif

#ifndef ZS4LARGE
#	define ZS4LARGE unsigned long long
#endif

#ifndef EVAL_BUFSIZE
#	define EVAL_BUFSIZE (256)
#endif

#ifndef EVAL_BUFLIMIT
#	define EVAL_BUFLIMIT (EVAL_BUFSIZE-2)
#endif


typedef class intclass
{
	// temporarily replace array element;
	typedef class temporary {
		unsigned device * where;
		unsigned device saveValue;
	public:
		inline temporary(unsigned device * which, unsigned device newValue){
			where = which;
			saveValue = *which;
			*which = newValue;
		}
		inline virtual ~temporary(){
			*where = saveValue;
		}
	}temporary;
public:
	static const ZS4LARGE PRECISION = (ZS4LARGE)(sizeof(device) << 3);
	static const ZS4LARGE MASK = (ZS4LARGE)(unsigned device)(~0);
	static const ZS4LARGE MAX = MASK;
	static const ZS4LARGE MIN = (ZS4LARGE)((device)0);
	static const ZS4LARGE SIGBIT = (ZS4LARGE)(PRECISION - 1);
	static const ZS4LARGE PROBABILITY = (ZS4LARGE)(1 << PRECISION);

	static const unsigned device * zs4(){ static const unsigned device zs4[] = { 'z', 's', '4', 0 }; return zs4; }

	inline static unsigned device * NEWLINE(){ static unsigned device r[] = { '\n', 0 }; return r; }

	inline static unsigned device cmp(unsigned device c1, unsigned device c2){return c1 - c2;	}
	inline static unsigned device cmp(const unsigned device * str1, const unsigned device * str2, const unsigned device * terminator = NULL){
		if (terminator == NULL){
			for (;;)
			{
				if (*str1 == 0 && *str2 == 0)
					return 0;

				if (*str1 != *str2)
					return *str1 - *str2;

				str1++; str2++;
			}

		}
		else{
			for (;;)
			{
				if (count(str1, terminator) && count(str2, terminator))
					return 0;

				if (*str1 != *str2)
					return *str1 - *str2;

				str1++; str2++;
			}
		}
	}
	inline static unsigned device ncmp(const unsigned device * str1, const unsigned device * str2, unsigned device n){
		for (unsigned device i = 0; i < n; i++)
		{
			unsigned device c1 = *str1++;
			unsigned device c2 = *str2++;
			if (c1 == 0 && c2 == 0) return 0;
			if (c1 != c2) return c1 - c2;
		}

		return 0;
	}

	inline static unsigned device len(const unsigned device * str, const unsigned device * terminator = NULL){
		unsigned device ret = 0;
		if (terminator == NULL){
			while (*str){ str++; ret++; }
		}
		else{
			while (0 != (*str) && (0 == count(terminator, *str))){ str++; ret++; }
		}
		return ret;
	}
	inline static unsigned device count(const unsigned device * str, unsigned device c){
		if (str == 0)
			return 0;

		unsigned device ret = 0;

		while (*str != 0)
		{
			if (c == *str)
				ret++;
			str++;
		}

		return ret;
	}
	inline static unsigned device count(const unsigned device * s, const unsigned device * chrs){
		unsigned device ret = 0;
		for (const unsigned device * cp = s; cp && *cp; cp++)
		{
			for (const unsigned device * p = chrs; p && *p; p++)
			{
				if (*cp == *p)
					ret++;
			}
		}

		return ret;
	}
	inline static unsigned device swap(unsigned device org, unsigned device * str, unsigned device nu){
		unsigned device ret = 0;
		while (*str != 0) { if (*str == org) { *str = nu; ret++; } str++; }
		return ret;
	}
	inline static unsigned device ecmp(const unsigned device * str, const unsigned device * end){
		unsigned device len_str = len(str);
		unsigned device len_end = len(end);

		if (len_end > len_str)
			return 1;


		return cmp(&str[len_str - len_end], end);
	}
	inline static unsigned device cpy(unsigned device * to, const unsigned device * from){
		unsigned device ret = 0;
		while (*from != 0){ *to++ = *from++; ret++; }
		*to = 0;
		return ret;
	}

	inline static unsigned device strcmp(const unsigned device * str1, const unsigned device * str2){
		for (;;)
		{
			if (*str1 == 0 && *str2 == 0)
				return 0;

			if (*str1 != *str2)
				return *str1 - *str2;

			str1++; str2++;
		}
	}

	typedef class symbol{
	public:
		typedef class set
		{
		protected:
			inline static const unsigned device * ASCII(void){
				static const unsigned device ASCII[128] = {
					0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
					0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
					0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
					0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
					0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
					0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
					0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
					0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
				};
				return ASCII;
			}
		public:
			inline virtual const unsigned device count(void) = 0;
			inline virtual const unsigned device * data(void) = 0;
			inline e lookup(unsigned device symbol, unsigned device & value){

				for (unsigned device i = 0; i < count(); i++){
					if ((unsigned device)data()[i] == (unsigned device)symbol)
					{
						value = i;
						return SUCCESS;
					}
				}
				return NOTFOUND;
			}
			bool is(const unsigned device c){
				unsigned device lu;
				if (SUCCESS != lookup(c, lu))
					return false;
				return true;
			}
			inline unsigned device bits(void){
				unsigned device m = (unsigned device)(~0) >> 1;
				unsigned device r = (unsigned device)((unsigned device)(sizeof(unsigned device) << 3) - 1);
				while (((m >> 1)&((unsigned device)count())) >= count()){
					m >>= 1; r--;
				}
				return r;
			}
			inline unsigned device get(const unsigned device * from, unsigned device * to, unsigned device max){
				unsigned device r = 0;
				if (max < 2) return r;

				*to = 0;
				unsigned device lu;
				for (unsigned device i = 0; i < (max - 1); i++){
					if (SUCCESS != lookup(from[i],lu))
						break;
					*to++ = from[i];
					*to = 0;
					r++;
				}
				return r;
			}
		}set;
		typedef class name : public set
		{
		public:
			typedef enum {
				underscore, a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z,
				SIZE
			} index;
			inline virtual const unsigned device count(void){ return (unsigned device)SIZE; }
			inline virtual const unsigned device * data(void){
				static unsigned device data[SIZE] = { '_',
					'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z' };
				return data;
			}

		}name;
		typedef class space : public set
		{
		public:
			typedef enum {
				s, a, b, f, n, r, t, v,
				SIZE
			} index;
			inline virtual const unsigned device count(void){ return SIZE; }
			inline virtual const unsigned device * data(void){
				static unsigned device data[SIZE] = { ' ', '\a', '\b', '\f', '\n', '\r', '\t', '\v' };
				return data;
			}

		}space;

		typedef class numeric : public set
		{
		public:
			typedef enum {
				n0, n1, n2, n3, n4, n5, n6, n7, n8, n9, a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z,
				SIZE
			} index;
			inline virtual const unsigned device count(void){ return (unsigned device)SIZE; }
			inline virtual const unsigned device * data(void){
				static unsigned device data[SIZE] = { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
					'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z' };
				return data;
			}
		}numeric;
		typedef class binary : public numeric
		{
		public:
			inline virtual const unsigned device count(void){ return 2; }
		}binary;
		typedef class octal : public numeric
		{
		public:
			inline virtual const unsigned device count(void){ return 8; }
		}octal;
		typedef class decimal : public numeric
		{
		public:
			inline virtual const unsigned device count(void){ return 10; }
		}decimal;
		typedef class hexadecimal : public numeric
		{
		public:
			inline virtual const unsigned device count(void){ return 16; }
		}hexadecimal;
		typedef class error : public set
		{
		public:
			inline virtual const unsigned device count(void){ return (unsigned device)FAILURE; }
		};

		typedef class opcode : public set
		{
		public:
			typedef enum {
				_equal_, _or_, _and_, _plus_, _minus_,_multi_,_divide_,_remain_,_lt_,_gt_,_at_,
				SIZE
			} index;
			inline virtual const unsigned device count(void){ return (unsigned device)SIZE; }
			inline virtual const unsigned device * data(void){
				static unsigned device data[SIZE] = {
					'=', '|', '&', '+', '-', '*', '/', '%', '<', '>','@' };
				return data;
			}

		}opcode;

		typedef class container : public set
		{
			typedef enum {
				OPEN,CLOSE,
			SIZE};

			unsigned device arr[SIZE];
		public:
			inline container(unsigned device opn, unsigned device cls)
			{
				arr[OPEN] = opn; arr[CLOSE] = cls;
			}
			inline virtual const unsigned device count(void){ return (unsigned device)SIZE; }

			inline virtual const unsigned device * data(void){
				return arr;
			}

			inline virtual const unsigned device open(void){
				return arr[OPEN];
			}

			inline virtual const unsigned device close(void){
				return arr[CLOSE];
			}

		}container;

		template <class symbolset>
		bool is(const unsigned device c){
			symbolset set; unsigned device lu;
			if (SUCCESS!= set.lookup(c,lu))
				return false;
			return true;
		}
	}symbol;

	typedef class storage{
	public:

#		define	INLINE_BITS_FUNCTION() inline virtual ZS4LARGE bits(void)const
		INLINE_BITS_FUNCTION(){ return (sizeof(*this) << 3); }

#		define INLINE_CONNECT_FUNCTION() inline virtual e connect(stream * in, stream * out)

		inline ZS4LARGE addressBits(void)const{ ZS4LARGE w = 1; while (((ZS4LARGE)1 << w)<bits())w++; return w; }
		inline ZS4LARGE messageBits(void)const{ return (bits() - addressBits()); }

	}storage;

	typedef class stream : public storage{
	public:
		static const unsigned device seek_cur = 1;
		static const unsigned device seek_end = 2;
		static const unsigned device seek_set = 0;

#		define	INLINE_READ_FUNCTION() inline virtual e read(unsigned device & c)
		INLINE_READ_FUNCTION(){return FAILURE;}
#		define	INLINE_WRITE_FUNCTION() inline virtual e write(unsigned device c)
		INLINE_WRITE_FUNCTION(){return FAILURE;	}
#		define	INLINE_READABLE_FUNCTION() inline virtual unsigned device readable(void)
		INLINE_READABLE_FUNCTION(){	return 0; }
#		define	INLINE_WRITEABLE_FUNCTION() inline virtual unsigned device writeable(void)
		INLINE_WRITEABLE_FUNCTION(){return 0;}
#		define	INLINE_FLUSH_FUNCTION() inline virtual e flush(void)
		INLINE_FLUSH_FUNCTION(){ return SUCCESS; }
#		define	INLINE_CLOSE_FUNCTION() inline virtual e close(void)
		INLINE_CLOSE_FUNCTION(){return SUCCESS;}
#		define	INLINE_REWIND_FUNCTION() inline virtual e rewind(void)
		INLINE_REWIND_FUNCTION(){return seek(0, SEEK_SET);}
#		define	INLINE_SEEKEND_FUNCTION() inline virtual e seekEnd(void)
		INLINE_SEEKEND_FUNCTION(){return seek(0, seek_end);}
#		define	INLINE_SEEK_FUNCTION() inline virtual e seek(ZS4LARGE offset, int origin)
		INLINE_SEEK_FUNCTION(){return FAILURE;}
#		define	INLINE_TELL_FUNCTION() inline virtual e tell(ZS4LARGE & pPos)
		INLINE_TELL_FUNCTION(){return FAILURE;}
#		define	INLINE_SIZE_FUNCTION() inline virtual e size(ZS4LARGE & s)
		INLINE_SIZE_FUNCTION(){
			e err;
			ZS4LARGE pos = 0;
			ZS4LARGE size = 0;

			if ((err = tell(pos)) != SUCCESS)
				return err;

			if ((err = seek(0, SEEK_END)) != SUCCESS)
				return err;

			if ((err = tell(size)) != SUCCESS)
				return err;

			if ((err = seek(pos, SEEK_SET)) != SUCCESS)
				return err;

			s = size;

			return SUCCESS;
		}

#		define	INLINE_WRITESTRING_FUNCTION() inline virtual e write(const unsigned device * str)
		INLINE_WRITESTRING_FUNCTION(){
			if (str == NULL || (*str) == 0)
				return NODATA;

			unsigned device l = len(str);
			for (unsigned device i = 0; i < l; i++){
				if (SUCCESS != write(str[i]))
					return FAILURE;
			}
			return SUCCESS;
		}

#		define	INLINE_BYTEWRITESTRING_FUNCTION() inline virtual e byteWrite(const char * cp)
		INLINE_BYTEWRITESTRING_FUNCTION(){
			if (cp == NULL)
				return NODATA;

			e error = SUCCESS;
			unsigned device wide;
			while (char c = *cp++){
				wide = (unsigned device)c;
				if ((error = write(wide)))
					return error;
			}

			return error;
		}

		inline e writeInteger(symbol::set&set, unsigned device data){
			unsigned device base = set.count();
			unsigned device remainder = data;

			bool NOT_ZERO = false;

			unsigned device MAX = (unsigned device)(~0);
			unsigned device count = (unsigned device)1;
			ZS4LARGE large = 1;
			while (large < (MAX / base)){
				large *= base; count++;
			}

			ZS4LARGE accumulator;
			while (count)
			{
				if (0 != (accumulator = remainder / large))
				{
					remainder -= (unsigned device)(ZS4LARGE)(accumulator*large);
					NOT_ZERO = true;
				}

				if (NOT_ZERO){
					if (SUCCESS != write((char)(set.data()[accumulator])))
						return BUFFEROVERFLOW;
				}

				large /= base;
				count--;
			}

			if (!NOT_ZERO)
			{
				if (SUCCESS != write((char)(set.data()[0])))
					return BUFFEROVERFLOW;
			}
			return SUCCESS;
		}
		inline e writeJsonString(const unsigned device * out)
		{
			for (const unsigned device * str = out; str && *str; str++)
			{
				switch (*str)
				{
				case '\\': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('\\'))return FAILURE; break;
				case '"': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('\"'))return FAILURE;  break;
				case '/': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('/'))return FAILURE;  break;
				case '\b': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('b'))return FAILURE;  break;
				case '\f': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('f'))return FAILURE;  break;
				case '\n': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('n'))return FAILURE;  break;
				case '\r': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('r'))return FAILURE;  break;
				case '\t': if (SUCCESS != write('\\'))return FAILURE; if (SUCCESS != write('t'))return FAILURE;  break;
				default: if (SUCCESS != write(*str))return FAILURE; break;
				}
			}
			return SUCCESS;
		}
		inline e writeErrorText(e error){
#define eText(err) if (error==err){return byteWrite(#err);}
			eText(WAITING);
			eText(BUFFEROVERFLOW);
			eText(STACKOVERFLOW);
			eText(NODATA);
			eText(NOMEMORY);
			eText(NOTFOUND);
			eText(ALREADYEXISTS);
			eText(BADNAME);
			eText(BADOPERATOR);
			eText(BADVALUE);
			eText(NOFRAMEND);
			eText(FILEINFOERROR);
			eText(FILEOPENERROR);
			eText(DIVIDEBYZERO);
			eText(PARSERROR);
			eText(NOTIMPLEMENTED);
			eText(FAILURE);

			if (error == SUCCESS)return SUCCESS;

			eText(FAILURE);
			symbol::decimal decimal;
			return writeInteger(decimal, (unsigned device)error);
		}

		inline virtual e jInteger(const unsigned device n, unsigned device v){symbol::decimal num;jNameColon(n);return writeInteger(num, v);}
		inline virtual e jInteger(const char * n, unsigned device v){symbol::decimal num;jNameColon(n);return writeInteger(num, v);}
		inline virtual e jNameColon(const unsigned device n){symbol::name name;write('"');writeInteger(name, n);write('"');return write(':');}
		inline virtual e jNameColon(const char * n){write('"');byteWrite(n);write('"');return write(':');}
		inline virtual e jStart(const unsigned device n){jNameColon(n);return write('{');}
		inline virtual e jStart(const char * n){write('"');byteWrite(n);write('"');write(':');return write('{');}
		inline virtual e jStart(){return write('{');}
		inline virtual e jEnd(){ return write('}'); }
		inline virtual e jDone(){ return write('\n'); }
		inline virtual e jError(e error){byteWrite("error:");writeErrorText(error);write('\n');return error;}
		inline virtual e jNull(){return byteWrite("null'\n");}
		inline virtual e jComma(){return write(',');}

	}stream;

	typedef class bytestream : public stream{
		zs4::bpi8::stream * stream = NULL;
	public:
		inline bytestream(zs4::bpi8::stream * bs){
			stream = bs;
		}

		INLINE_READ_FUNCTION(){
			zs4::bpi8::integer b;
			e error = stream->read(b.data);
			if (error)return error;
			c = (unsigned device)b.data;
			return SUCCESS;
		}
		INLINE_WRITE_FUNCTION(){
			zs4::bpi8::integer b;
			b.data = (unsigned char)c;
			return stream->write(b.data);
		}
		INLINE_READABLE_FUNCTION(){
			return (unsigned device)stream->readable();
		}
		INLINE_WRITEABLE_FUNCTION(){
			return (unsigned device)stream->writeable();
		}
		INLINE_FLUSH_FUNCTION(){ return stream->flush(); }
		INLINE_CLOSE_FUNCTION(){ return stream->close(); }
		INLINE_REWIND_FUNCTION(){ return stream->rewind(); }
		INLINE_SEEKEND_FUNCTION(){ return stream->seekEnd(); }
		INLINE_SEEK_FUNCTION(){ return stream->seek(offset,origin); }
		INLINE_TELL_FUNCTION(){ return stream->tell(pPos); }
		INLINE_SIZE_FUNCTION(){ return stream->size(s); }
	}bytestream;

	typedef class integer{
	public:
		unsigned device data = 0;

		// storage support
		inline static unsigned device bitSet(unsigned device d, unsigned device i){ i %= PRECISION; d |= (unsigned device)((unsigned device)1 << (unsigned device)i); return d; }
		inline static unsigned device bitClear(unsigned device d, unsigned device i){ i %= PRECISION; d &= (unsigned device)((unsigned device)~((unsigned device)1 << (unsigned device)i)); return d; }
		inline static bool bitGet(unsigned device d, unsigned device i){ i %= PRECISION; if (d & (unsigned device)((unsigned device)1 << (unsigned device)i))return true; return false; }
		inline static bool bitGetMS(unsigned device d){ return bitGet(d, (PRECISION - 1)); }
		inline static bool bitGetLS(unsigned device d){ return bitGet(d, 0); }

#define	INLINE_RESET_FUNCTION() inline virtual void reset(void)
		INLINE_RESET_FUNCTION(){ data = 0; }
		inline unsigned device cmp(device c)const{ return data - c; }

		inline e io(const unsigned device * in, unsigned device & result){
			e error = SUCCESS;
			symbol::decimal sdec;
			symbol::opcode opcode;
			unsigned device opc[8];

			unsigned device opCount = opcode.get(in, opc, 4);
			if (opCount == 0)
				goto return_value;
			else in = &in[opCount];

			if (opCount == 1){
				if (*opc == '='){
					if (SUCCESS != (error = set(sdec, in)))
						return error;
					goto return_value;
				}
				if (*opc == '+'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data += data;
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '-'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data = (data - addval.data);
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '|'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data |= data;
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '&'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data &= data;
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '*'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data *= data;
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '/'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					if (addval.data == 0)
						return DIVIDEBYZERO;
					addval.data = (data / addval.data);
					result = addval.data;
					return SUCCESS;
				}
				if (*opc == '%'){
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					if (addval.data == 0)
						return DIVIDEBYZERO;
					addval.data = (data % addval.data);
					result = addval.data;
					return SUCCESS;
				}

				return BADOPERATOR;
			}

			if (opCount == 2){
				if (opc[1] == '=')
				{
					if (*opc == '+'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data += addval.data;
						goto return_value;
					}
					if (*opc == '-'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data -= addval.data;
						goto return_value;
					}
					if (*opc == '|'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data |= addval.data;
						goto return_value;
					}
					if (*opc == '&'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data &= addval.data;
						goto return_value;
					}
					if (*opc == '*'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data *= addval.data;
						goto return_value;
					}
					if (*opc == '/'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						if (addval.data == 0)
							return DIVIDEBYZERO;
						data /= addval.data;
						goto return_value;
					}
					if (*opc == '%'){
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						if (addval.data == 0)
							return DIVIDEBYZERO;
						data %= addval.data;
						goto return_value;
					}
					return BADOPERATOR;
				}

				if (opc[0] == '+' && opc[1] == '+')
				{
					result = data++;
                    return SUCCESS;
                }
				if (opc[0] == '-' && opc[1] == '-')
				{
					result = data--;
					return SUCCESS;
				}

				if (opc[0] == '<' && opc[1] == '<')
				{
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data = data << addval.data;
					result = addval;
					return SUCCESS;
				}
				if (opc[0] == '>' && opc[1] == '>')
				{
					integer addval; addval.data = 0;
					if (SUCCESS != (error = addval.set(sdec, in)))
						return error;
					addval.data = data >> addval.data;
					result = addval;
					return SUCCESS;
				}

				return BADOPERATOR;
			}

			if (opCount == 3){
				if (opc[2] == '=')
				{
					if (opc[0] == '<' && opc[1] == '<')
					{
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data <<= addval.data;
						goto return_value;
					}
					if (opc[0] == '>' && opc[1] == '>')
					{
						integer addval; addval.data = 0;
						if (SUCCESS != (error = addval.set(sdec, in)))
							return error;
						data >>= addval.data;
						goto return_value;
					}
					return BADOPERATOR;
				}
				return BADOPERATOR;
			}

			return_value:
			result = data;
			return SUCCESS;
		}

		inline e set(symbol::set&set, const unsigned device * s){
			e error = SUCCESS;

			unsigned device work = 0;
			unsigned device lu = 0;

			for (unsigned device i = 0; s[i] != 0 && s[i] != '\n'; i++){

				if ((error = set.lookup(s[i],lu)))
					return FAILURE;

				ZS4LARGE nu = (ZS4LARGE)((ZS4LARGE)((ZS4LARGE)work*(ZS4LARGE)set.count()) + (ZS4LARGE)lu);
				if ((ZS4LARGE)nu > (unsigned device)MAX){
					return FAILURE;
				}
				work = (unsigned device)nu;
			}

			data = work;
			return SUCCESS;
		}
		inline e write(unsigned device * out, unsigned device outlen, symbol::set & set, bool sign = false)const{
			unsigned device dta = data;
            unsigned device written = 0;
			if (sign){
				if ((ZS4LARGE)dta & (ZS4LARGE)(1 << SIGBIT))
				{
				    if ((outlen-written) < 2)return BUFFEROVERFLOW;
				    out[written++]='.'; out[written]=0;
					dta = (~dta);
				}
			}

			ZS4LARGE remainder = dta;
			bool NOT_ZERO = false;

			ZS4LARGE MAX = (ZS4LARGE)(~0);
			ZS4LARGE count = 1;
			ZS4LARGE large = 1;
			while (large < (MAX / set.count())){
				large *= set.count(); count++;
			}

			ZS4LARGE accumulator;
			while (count)
			{
				if (0 != (accumulator = remainder / large))
				{
					remainder -= (accumulator*large);
					NOT_ZERO = true;
				}

				if (NOT_ZERO){
 				    if ((outlen-written) < 2)return BUFFEROVERFLOW;
				    out[written++]=set.data()[accumulator];
                    out[written]=0;
				}

				large /= set.count();
				count--;
			}

			if (!NOT_ZERO)
			{
                if ((outlen-written) < 2)return BUFFEROVERFLOW;
                out[written++]=set.data()[0];
                out[written]=0;
			}

			return SUCCESS;
		}
		inline e write(stream & out, symbol::set & set, bool sign = false)const{
		    e error;
			unsigned device arr[EVAL_BUFSIZE];
			if (error = write(arr, (unsigned device)EVAL_BUFSIZE, set, sign))return error;
		    for (const unsigned device * ptr = arr; *ptr != 0; ptr++){
                if (error = out.write(*ptr))return error;
		    }
			return SUCCESS;
		}

		// C OPERATORS
		inline operator device()const{ return data; }
		inline operator unsigned device()const{ return data; }

		inline operator integer*()const{ return(integer*)&data; }
		inline operator integer&()const{ return(integer&)data; }

		inline unsigned device & operator &(integer &d){ data = (unsigned device) d.data; return data; }
		inline unsigned device & operator &(device &d){ data = (unsigned device) d; return data; }
		inline unsigned device & operator &(int &d){ data = (unsigned device) d; return data; }

		inline unsigned device & operator =(integer &d){ data = (unsigned device) d.data; return data; }
		inline unsigned device & operator =(device &d){ data = (unsigned device) d; return data; }
		inline unsigned device & operator =(int &d){ data = (unsigned device) d; return data; }

		inline operator bool()const{ if (data != 0) { return true; } return false; }
		inline unsigned device & operator =(bool b){ if (b) data = (unsigned device)(~0); else data = 0;  return data; }

	}integer;

	typedef class object : public stream{
		unsigned device * store;
		unsigned device storesize;
		inline unsigned device ulim(){ return (buffer() - 2); }
		inline unsigned device pointerSize(){ return (sizeof(void*) / sizeof(unsigned device)); }
		inline virtual unsigned device buffer(){ return(workingSize() >> 2); }
		inline virtual unsigned device limit(){return buffer();}

		typedef struct item { 
		public:
			typedef enum {
				DEVICE,
			flagbits}flagbit;

			unsigned device flag; 
			unsigned device nam; 
			unsigned device val; 
			inline unsigned device name(unsigned device * d = NULL){
				if (d == NULL)return nam;
				symbol::name name;
				integer w;
				if ((SUCCESS != w.set(name, d))){ return val; }
				nam = w.data;
				return val;
			}
			inline unsigned device & operator =(unsigned device * d){
				symbol::decimal decimal;
				integer w;
				if ((SUCCESS != w.set(decimal, d))){ return val; }
				val = w.data;
				return val;
			}

		}item;
		inline unsigned device itemSize(){ return 3; }
		inline unsigned device itemSpace(){ return ((limit()/itemSize())-itemCount()); }
		inline e itemAdd(unsigned device * str) {
			if (!itemSpace())return NOMEMORY;
			
			symbol::name name; integer i;
			if (SUCCESS != i.set(name, str))
				return BADNAME;

			(*stackReserved())++;

			itemArray()->flag = 0;
			itemArray()->nam = i.data;
			itemArray()->val = 0;
			return SUCCESS;
		}
		inline e itemDelete(unsigned device * str) {
			symbol::name name; integer nam;
			if (SUCCESS != nam.set(name, str))
				return BADNAME;


			item * arr = itemArray();
			bool found = false;
			unsigned device index;
			unsigned device c = itemCount();
			for (unsigned device i = 0; i < c; i++){ if (arr[i].nam == nam.data){ found = true; index = i; break; } }
			if (!found)
				return NOTFOUND;

			for (unsigned device i = index; i > 0; i--){
				arr[i] = arr[i - 1];
			}

			(*stackReserved())--; 
			return SUCCESS;
		}
		inline e itemNameSet(item & i, unsigned device * n){
			symbol::name set;
			e error = SUCCESS;
			integer w;
			if ((error = w.set((symbol::set&)set, n)))
				return error;
			i.nam = w.data;
			return SUCCESS;
		}
		inline item * itemArray(void){ return (item*)&store[workingSize() - (itemCount()*itemSize())]; }
		inline unsigned device itemCount(void){ return ((*stackReserved())); }
		inline item *  itemFind(unsigned device * str){
			item * arr = itemArray();
			unsigned device c = itemCount();
			symbol::name name; integer nam;
			if (SUCCESS != nam.set(name, str))
				return NULL;

			for (unsigned device i = 0; i < c; i++){ if (arr[i].nam == nam.data){ return &arr[i]; } }
			return NULL;
		}

		inline zs4::driver *** driverReserved(){ return (zs4::driver***)&store[storesize - (pointerSize() * 1)]; }
		inline stream ** inReserved(){ return  (stream**)&store[(storesize - pointerSize()) * 2]; }
		inline stream ** outReserved(){return (stream**)&store[storesize - (pointerSize() * 3)];}

		inline unsigned device * useReserved(){ return &store[((storesize - (pointerSize() * 3)) - 1)]; }
		inline unsigned device * stackReserved(){ return &store[((storesize - (pointerSize() * 3)) - 2)]; }
		inline unsigned device * heapReserved(){ return &store[((storesize - (pointerSize() * 3)) - 3)]; }
		
		inline unsigned device workingSize(){ return ((storesize - (pointerSize() * 3)) - 3); }
		inline unsigned device systemSize(){ return (storesize - workingSize()); }

		inline zs4::driver ** driver(){ return *driverReserved(); }
		inline stream*in(){ return *inReserved(); }
		inline stream*out(){ return *outReserved(); }

	protected:

		INLINE_BITS_FUNCTION(){	return (ZS4LARGE)(storesize << 3);}
		INLINE_RESET_FUNCTION(){unsigned device * p = store;for (unsigned device i = 0; i < storesize; i++){ p[i] = 0; }}

        bool isEndOfLine(unsigned device i){
            symbol symbol;
			for (unsigned device x = i; store[x]; x++)
				{ if (!symbol.is<symbol::space>(store[x])) return false; }
            return true;
        }

		inline e onc(){
			out()->jStart("zs4");
			{
				symbol::name name;
				out()->jStart("v"); //info
				{
					out()->jInteger("c", itemCount());
					out()->jComma();

					out()->jInteger("a", itemSpace());
				}
				out()->jEnd();  //info

				out()->jComma();

				out()->jStart("l"); //info
				{
					out()->jInteger("s", limit());
					out()->jComma();

					out()->jInteger("b", buffer());
				}
				out()->jEnd();  //info

				out()->jComma();

				out()->jStart("a"); //info
				{
					out()->jInteger("c", 0);
					out()->jComma();

					out()->jInteger("a", storesize - limit() - buffer());
				}
				out()->jEnd();  //info
			}
			return out()->jEnd(); // zs4
		}
		inline virtual e ons(void){
			return out()->jDone();
		}
		inline virtual e onv(void){

			out()->jStart();
			{
				onc();
				// and now the actual content....
				device c = itemCount();
				item * p = itemArray();

				if (c){
					for (device i = 0; i < c; i++)
					{
						//if (i)
							out()->jComma();
						out()->jInteger(p[i].nam, p[i].val);
					}

				}
			}
			out()->jEnd();	out()->jDone();

			out()->jDone();
			out()->byteWrite("available commands:\n");
			out()->byteWrite("\"+ varname\" to add var\n");
			out()->byteWrite("\"- varname\" to delete var\n");
			out()->byteWrite("\"< filename\" to read a file\n");
			out()->byteWrite("\"> filename bytecount\" to write a file\n");
			out()->byteWrite("\"! shell command string\"\n");
			out()->jDone();

			return out()->jDone();
		}

		inline e evalOpcode(integer & value, unsigned device & i, unsigned device & result){
			e error = FAILURE;
            integer r;
			integer operand;
			unsigned device _buf[EVAL_BUFSIZE];
			unsigned device counter = 0;

			symbol::container container('(', ')');
			symbol::name name;
			symbol::opcode opcode;
			symbol::space space;
			symbol::decimal decimal;

			// get all opcode symbols
			unsigned device opc = i;
			while (opcode.is(store[i])){
				if (counter > EVAL_BUFLIMIT) return BUFFEROVERFLOW;
				_buf[counter++] = store[i++];
				_buf[counter] = 0;
			};
			unsigned device arg = counter;

			if (isEndOfLine(i)){
				temporary set(&store[i], 0);
				if (error = value.io(&store[opc], r.data))return error;
                result = r.data;
                return SUCCESS;
			}

			while (space.is(store[i]))i++;

			if (name.is(store[i])){
                unsigned device start = i;
				while (name.is(store[i])){ i++; }
				item * n = NULL;
                unsigned device name_index = 0;
                {
					temporary set(&store[i], 0);
					if (NULL == (n = itemFind(&store[start])))
                        return BADNAME;
                }
                operand.data = n->val;
				if (error = operand.write(&_buf[counter], (256 - counter), decimal))return error;

				if (error = value.io(_buf, r.data))return error;
				//itemArray()[name_index].val = operand.data;
				result = value.data = r.data;
				return SUCCESS;

            }
			else if (decimal.is(store[i])){
				while (decimal.is(store[i]))
                {
					if (counter > EVAL_BUFLIMIT) return BUFFEROVERFLOW;
					_buf[counter++] = store[i++];
					_buf[counter] = 0;
                }
				
				if (error = value.io(_buf, r.data))return error;


				result = r.data;
				return SUCCESS;
			}
			else if (store[i] == container.open()){
				if (error = evalContainer(container, i, r.data))return error;
				if (error = r.write(&_buf[counter], (EVAL_BUFSIZE - counter), decimal))return error;
				if (error = value.io(_buf, r.data))return error;


				result = r.data;
				return SUCCESS;
			}
			else {
				return NOTIMPLEMENTED;
            }

			if (error = value.io(_buf, r.data))return error;
            result = r.data;
            return SUCCESS;
		}
		inline e evalContainer(symbol::container&container, unsigned device & i, unsigned device & result){
			e error = PARSERROR;
			integer value;

			if (store[i] == container.open()){
				if (len(&store[i]) >= (EVAL_BUFSIZE))return STACKOVERFLOW;

				unsigned device stash[EVAL_BUFSIZE]; 
				cpy(stash, &store[++i]);

				unsigned device count = 1;
				unsigned device c;
				for (c = 0; stash[c] != 0; c++){
					if (stash[c] == container.close()){
						if (--count == MAX) return PARSERROR;
						else if (count == 0){break;}
					}
					if (stash[c] == container.open()){ count++; }
					store[i + c] = stash[c]; store[i + c + 1] = 0;
				}
				unsigned device save_i = i;
				if (error = eval(i, value.data))return error;
				i = save_i;

				symbol::decimal decimal;
				if (error = value.write(&store[i], (*useReserved()) - i, decimal)) return error;
				count = len(&store[i]);
				cpy(&store[i + count],&stash[c+1]);

				if (error = eval(i, value.data))return error;
				result = value.data;
				return SUCCESS;
			}

			return NOFRAMEND;
		}
		inline e evalName(unsigned device & i, unsigned device & result){
			e error = PARSERROR;
			integer r;
			integer value;
			symbol::container container('(', ')');
			symbol::name name;
			symbol::opcode opcode;
			symbol::space space;

			unsigned device start = i;
			while (name.is(store[i]))i++;
			item * n;
			{
				temporary set(&store[i], 0);
				if (NULL == (n = itemFind(&store[start])))
					return BADNAME;
			}
			value.data = n->val;
			if (isEndOfLine(i)){ result = value.data; return SUCCESS; }

			while (space.is(store[i]))i++;

			if (opcode.is(store[i])){
				unsigned device opc = i;
				if (error = evalOpcode(value, i, r.data)) return error;
				n->val = value.data;
				result = r.data;
				return SUCCESS;
			}

			return NOTIMPLEMENTED;

		}
		inline e evalDecimal(unsigned device & i, unsigned device & result){
			e error = PARSERROR;
			integer r;
			integer value;
			symbol::decimal decimal;
			symbol::opcode opcode;
			symbol::space space;

			unsigned device start = i;
			while (decimal.is(store[i]))i++;
			{
				temporary set(&store[i], 0);
				if (error = value.set(decimal, &store[start])) return error;
			}
			if (isEndOfLine(i)){ result = value.data; return SUCCESS; }

			while (space.is(store[i]))i++;
			if (opcode.is(store[i])){

				if (error = evalOpcode(value, i, r.data)) return error;
				result = r.data;
				return SUCCESS;
			}

			return NOTIMPLEMENTED;

		}
		inline e eval(unsigned device & i, unsigned device & result){
			e error = PARSERROR;
			integer value;

			symbol::container container('(', ')');
			symbol::name name;
			symbol::decimal decimal;
			symbol::opcode opcode;
			symbol::space space;

			while (space.is(store[i]))i++;

			if (store[i] == container.open()){
				if (error = evalContainer(container, i, value.data))return error;
			}

			else if (name.is(store[i])){
				if (error = evalName(i, value.data)) return error;
			}

			else if (decimal.is(store[i])){
				if (error = evalDecimal(i, value.data)) return error;
			}
			
			if (isEndOfLine(i)){ result = value.data; return SUCCESS; }

			while (space.is(store[i]))i++;
			
			if (opcode.is(store[i])){
				unsigned device r;
				if (error = evalOpcode(value, i, r)) return error;
				result = r;
				return SUCCESS;
			}

			return NOTFOUND;
		}

#		define INLINE_ONSCAN_FUNCTION() inline virtual e onScan(unsigned device * str)
		INLINE_ONSCAN_FUNCTION(){
			e error = FAILURE;
			symbol symbol;
			// cut leading space;
			while (symbol.is<symbol::space>(*str))str++;
			switch (*str){
			case '+':{
				str++;
				if (e error = itemAdd(str))
					return out()->jError(error);

				out()->write('0');
				return out()->jDone();
			}
			case '-':{
				str++;
				if ( e error = itemDelete(str))
					return out()->jError(error);

				return out()->jNull();
			}
			default:{
				unsigned device parserindex = 0;
				unsigned device result = 0;
				if (error = eval(parserindex, result))
					return out()->jError(error);

				symbol::decimal number;
				out()->writeInteger(number, result);
				return out()->jDone();

			}}//switch()

			return out()->jDone();
		}
#		define INLINE_ONINTEGER_FUNCTION() inline virtual e onInteger(unsigned device & c)
		INLINE_ONINTEGER_FUNCTION(){
			if (in() == NULL || out() == NULL) return FAILURE;

			item * test = itemArray();

			if ((*useReserved()) < 1)
				return FAILURE;

			if (0 == ecmp(store,NEWLINE()))
			{
				rewind();
				if (store[0] == '?'){ return onv(); }
				if (store[0] == '!'){ return ons(); }
				else { return onScan(store); }
			}

			if ((*useReserved()) >= (ulim()))
			{
				unsigned device c;
				while (in()->readable()){
					rewind();
					in()->read(c);
					if (c == '\n')
						break;
				}
				rewind();
				return out()->jError(BUFFEROVERFLOW);
			}

			return WAITING;
		}

#		define INLINE_CONSTRUCT() inline virtual void construct(zs4::driver ** d, unsigned device * m, unsigned device s, stream * i, stream * o)
		INLINE_CONSTRUCT(){
			store = m;
			storesize = s;

			reset();

			*driverReserved() = d;
			*inReserved() = i;
			*outReserved() = o;
		}
	public:
		inline object(){
			store = NULL;
			storesize = 0;
		}
#		define INLINE_INSTANCE() inline object(zs4::driver ** driver, unsigned device * m, unsigned device s, stream * i, stream * o)
		INLINE_INSTANCE(){
			construct(driver, m, s, i, o);
		}
		inline virtual e tickle(void){
			if (in() == NULL || out() == NULL) return FAILURE;

			unsigned device c = 0;
			e error = SUCCESS;

			while (in()->readable()){
				if ((error = in()->read(c)))
					return error;

				if ((error = write(c)))
					return error;

				error = onInteger(c);
				if (error == WAITING)
					continue;

				if (error)
					return error;

				break;
			}

			return error;
		}

		INLINE_READABLE_FUNCTION(){
			return ((*useReserved()));
		}
		INLINE_WRITEABLE_FUNCTION(){
			return (ulim() - (*useReserved()));
		}

		INLINE_READ_FUNCTION(){
			if ((*useReserved()) >= ulim())
				return WAITING;

			c = store[(*useReserved())];
			store[(*useReserved())] = 0;
			(*useReserved())++;

			return SUCCESS;
		}
		INLINE_WRITE_FUNCTION(){
			if ((*useReserved()) >= ulim())
				return WAITING;

			store[(*useReserved())++] = c;
			store[(*useReserved())] = 0;

			return SUCCESS;
		}
		INLINE_SIZE_FUNCTION(){
			s = (*useReserved());
			return SUCCESS;
		}
		INLINE_REWIND_FUNCTION(){ (*useReserved()) = 0; return SUCCESS; }
	}object;

}intclass;

#undef objectclass
#undef symbolclass
#undef intclass
#undef device
