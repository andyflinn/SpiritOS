#ifndef ZS4_JSONPARSER_H
#define ZS4_JSONPARSER_H

#ifndef json_char
#define json_char char
#endif

#ifndef json_int_t
#ifndef _WIN32
#include <inttypes.h>
#define json_int_t int64_t
#else
#define json_int_t __int64
#endif
#endif

#ifdef _MSC_VER
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#endif

#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <math.h>

typedef unsigned short json_uchar;

typedef struct
{
	unsigned long max_memory;
	int settings;
} json_settings;

#define json_relaxed_commas 1

typedef enum
{
	json_none,
	json_object,
	json_array,
	json_integer,
	json_double,
	json_string,
	json_boolean,
	json_null

} json_type;

typedef struct _json_value
{
	struct _json_value * parent;

	json_type type;

	union
	{
		int boolean;
		json_int_t integer;
		double dbl;

		struct
		{
			unsigned int length;
			json_char * ptr; /* null terminated */

		} string;

		struct
		{
			unsigned int length;

			struct
			{
				json_char * name;
				struct _json_value * value;

			} *values;

		} object;

		struct
		{
			unsigned int length;
			struct _json_value ** values;

		} array;

	} u;

	union
	{
		struct _json_value * next_alloc;
		void * object_mem;

	} _reserved;


	/* Some C++ operator sugar */

public:

	inline _json_value()
	{
		memset(this, 0, sizeof (_json_value));
	}

	inline operator const char * () const
	{
		switch (type)
		{
		case json_string:
			return u.string.ptr;

		default:
			return "";
		};
	}

	inline operator json_int_t () const
	{
		switch (type)
		{
		case json_integer:
			return u.integer;

		case json_double:
			return (json_int_t)u.dbl;

		default:
			return 0;
		};
	}

	inline operator bool() const
	{
		if (type != json_boolean)
			return false;

		return u.boolean != 0;
	}

	inline operator double() const
	{
		switch (type)
		{
		case json_integer:
			return (double)u.integer;

		case json_double:
			return u.dbl;

		default:
			return 0;
		};
	}

} json_value;

#include <zs4file.h>

#define JSON_ERROR_BUF_SIZE (128)
ZS4_STRINGBUFFER(json_error, JSON_ERROR_BUF_SIZE);

template <class zs4stringtype>
class zs4jsonParser : public zs4stringtype
{
	json_error parser_error;
	json_value * JObj;
	const struct _json_value json_value_none;

public:
	inline zs4jsonParser(void){
		JObj = NULL;
	}

	inline virtual ~zs4jsonParser(void){
	}

	inline json_value * value(void){ return JObj; }
	inline json_value * parse(const char * json){

		JObj = NULL;
		parser_error.clear();
		clear();

		json_settings settings; memset(&settings, 0, sizeof (json_settings));
		settings.max_memory = bufsize;

		if (json_value * nuJv = json_parse_ex(&settings, json))
		{
			JObj = nuJv;
			return nuJv;
		}

		clear();
		if (parser_error.check())
			set(parser_error.str);

		return NULL;
	}
	inline json_value * parseFile(const char * fnam){
		zs4stringtype buf;
		if (zs4SUCCESS != zs4file::load(fnam, &buf))
			return NULL;
		return parse(buf.str);
	}
private:
	inline static unsigned char hex_value(json_char c)
	{
		if (c >= 'A' && c <= 'F')
			return (c - 'A') + 10;

		if (c >= 'a' && c <= 'f')
			return (c - 'a') + 10;

		if (c >= '0' && c <= '9')
			return c - '0';

		return 0xFF;
	}

	typedef struct
	{
		json_settings settings;
		int first_pass;

		unsigned long used_memory;

		// 2 members added by zs4
		unsigned int uint_max;
		unsigned long ulong_max;

	} json_state;

	inline int new_value
		(json_state * state, json_value ** top, json_value ** root, json_value ** alloc, json_type type)
	{
		json_value * value;
		int values_size;

		if (!state->first_pass)
		{
			value = *top = *alloc;
			*alloc = (*alloc)->_reserved.next_alloc;

			if (!*root)
				*root = value;

			switch (value->type)
			{
			case json_array:

				if (!(value->u.array.values = (json_value **)zs4alloc
					((value->u.array.length + 1) * sizeof (json_value *))))
				{
					return 0;
				}

				value->u.array.length = 0;
				break;

			case json_object:

				values_size = sizeof (*value->u.object.values) * value->u.object.length;

				if (!((*(void **)&value->u.object.values) = zs4alloc
					(values_size + ((unsigned long)value->u.object.values))))
				{
					return 0;
				}

				value->_reserved.object_mem = (*(char **)&value->u.object.values) + values_size;

				value->u.object.length = 0;
				break;

			case json_string:

				if (!(value->u.string.ptr = (json_char *)zs4alloc
					((value->u.string.length + 1) * sizeof (json_char))))
				{
					return 0;
				}

				value->u.string.length = 0;
				break;

			default:
				break;
			};

			return 1;
		}

		value = (json_value *)zs4alloc(sizeof (json_value));

		if (!value)
			return 0;

		if (!*root)
			*root = value;

		value->type = type;
		value->parent = *top;

		if (*alloc)
			(*alloc)->_reserved.next_alloc = value;

		*alloc = *top = value;

		return 1;
	}

#define e_off \
	((int)(i - cur_line_begin))

#define whitespace \
   case '\n': ++cur_line;  cur_line_begin = i; \
   case ' ': case '\t': case '\r'

#define string_add(b)  \
	do { if (!state.first_pass) string[string_length] = b;  ++string_length; } while (0);

	const static long
		flag_next = 1, flag_reproc = 2, flag_need_comma = 4, flag_seek_value = 8,
		flag_escaped = 16, flag_string = 32, flag_need_colon = 64, flag_done = 128,
		flag_num_negative = 256, flag_num_zero = 512, flag_num_e = 1024,
		flag_num_e_got_sign = 2048, flag_num_e_negative = 4096;

	inline json_value * json_parse_ex(json_settings * settings, const json_char * json)
	{
		json_char error[128];
		unsigned int cur_line;
		const json_char * cur_line_begin, *i;
		json_value * top, *root, *alloc = 0;
		json_state state;
		long flags;
		long num_digits, num_fraction, num_e;

		error[0] = '\0';

		memset(&state, 0, sizeof (json_state));
		memcpy(&state.settings, settings, sizeof (json_settings));

		memset(&state.uint_max, 0xFF, sizeof (state.uint_max));
		memset(&state.ulong_max, 0xFF, sizeof (state.ulong_max));

		state.uint_max -= 8; /* limit of how much can be added before next check */
		state.ulong_max -= 8;

		for (state.first_pass = 1; state.first_pass >= 0; --state.first_pass)
		{
			json_uchar uchar;
			unsigned char uc_b1, uc_b2, uc_b3, uc_b4;
			json_char * string;
			unsigned int string_length;

			top = root = 0;
			flags = flag_seek_value;

			cur_line = 1;
			cur_line_begin = json;

			for (i = json;; ++i)
			{
				json_char b = *i;

				if (flags & flag_done)
				{
					if (!b)
						break;

					switch (b)
					{
					whitespace:
						continue;

					default:
						sprintf(error, "%d:%d: Trailing garbage: `%c`", cur_line, e_off, b);
						goto e_failed;
					};
				}

				if (flags & flag_string)
				{
					if (!b)
					{
						sprintf(error, "Unexpected EOF in string (at %d:%d)", cur_line, e_off);
						goto e_failed;
					}

					if (string_length > state.uint_max)
						goto e_overflow;

					if (flags & flag_escaped)
					{
						flags &= ~flag_escaped;

						switch (b)
						{
						case 'b':  string_add('\b');  break;
						case 'f':  string_add('\f');  break;
						case 'n':  string_add('\n');  break;
						case 'r':  string_add('\r');  break;
						case 't':  string_add('\t');  break;
						case 'u':

							if ((uc_b1 = hex_value(*++i)) == 0xFF || (uc_b2 = hex_value(*++i)) == 0xFF
								|| (uc_b3 = hex_value(*++i)) == 0xFF || (uc_b4 = hex_value(*++i)) == 0xFF)
							{
								sprintf(error, "Invalid character value `%c` (at %d:%d)", b, cur_line, e_off);
								goto e_failed;
							}

							uc_b1 = uc_b1 * 16 + uc_b2;
							uc_b2 = uc_b3 * 16 + uc_b4;

							uchar = ((json_char)uc_b1) * 256 + uc_b2;

							if (sizeof (json_char) >= sizeof (json_uchar) || (uc_b1 == 0 && uc_b2 <= 0x7F))
							{
								string_add((json_char)uchar);
								break;
							}

							if (uchar <= 0x7FF)
							{
								if (state.first_pass)
									string_length += 2;
								else
								{
									string[string_length++] = 0xC0 | ((uc_b2 & 0xC0) >> 6) | ((uc_b1 & 0x7) << 2);
									string[string_length++] = 0x80 | (uc_b2 & 0x3F);
								}

								break;
							}

							if (state.first_pass)
								string_length += 3;
							else
							{
								string[string_length++] = 0xE0 | ((uc_b1 & 0xF0) >> 4);
								string[string_length++] = 0x80 | ((uc_b1 & 0xF) << 2) | ((uc_b2 & 0xC0) >> 6);
								string[string_length++] = 0x80 | (uc_b2 & 0x3F);
							}

							break;

						default:
							string_add(b);
						};

						continue;
					}

					if (b == '\\')
					{
						flags |= flag_escaped;
						continue;
					}

					if (b == '"')
					{
						if (!state.first_pass)
							string[string_length] = 0;

						flags &= ~flag_string;
						string = 0;

						switch (top->type)
						{
						case json_string:

							top->u.string.length = string_length;
							flags |= flag_next;

							break;

						case json_object:

							if (state.first_pass)
								(*(json_char **)&top->u.object.values) += string_length + 1;
							else
							{
								top->u.object.values[top->u.object.length].name
									= (json_char *)top->_reserved.object_mem;

								(*(json_char **)&top->_reserved.object_mem) += string_length + 1;
							}

							flags |= flag_seek_value | flag_need_colon;
							continue;

						default:
							break;
						};
					}
					else
					{
						string_add(b);
						continue;
					}
				}

				if (flags & flag_seek_value)
				{
					switch (b)
					{
					whitespace:
						continue;

					case ']':

						if (top->type == json_array)
							flags = (flags & ~(flag_need_comma | flag_seek_value)) | flag_next;
						else if (!state.settings.settings & json_relaxed_commas)
						{
							sprintf(error, "%d:%d: Unexpected ]", cur_line, e_off);
							goto e_failed;
						}

						break;

					default:

						if (flags & flag_need_comma)
						{
							if (b == ',')
							{
								flags &= ~flag_need_comma;
								continue;
							}
							else
							{
								sprintf(error, "%d:%d: Expected , before %c", cur_line, e_off, b);
								goto e_failed;
							}
						}

						if (flags & flag_need_colon)
						{
							if (b == ':')
							{
								flags &= ~flag_need_colon;
								continue;
							}
							else
							{
								sprintf(error, "%d:%d: Expected : before %c", cur_line, e_off, b);
								goto e_failed;
							}
						}

						flags &= ~flag_seek_value;

						switch (b)
						{
						case '{':

							if (!new_value(&state, &top, &root, &alloc, json_object))
								goto e_alloc_failure;

							continue;

						case '[':

							if (!new_value(&state, &top, &root, &alloc, json_array))
								goto e_alloc_failure;

							flags |= flag_seek_value;
							continue;

						case '"':

							if (!new_value(&state, &top, &root, &alloc, json_string))
								goto e_alloc_failure;

							flags |= flag_string;

							string = top->u.string.ptr;
							string_length = 0;

							continue;

						case 't':

							if (*(++i) != 'r' || *(++i) != 'u' || *(++i) != 'e')
								goto e_unknown_value;

							if (!new_value(&state, &top, &root, &alloc, json_boolean))
								goto e_alloc_failure;

							top->u.boolean = 1;

							flags |= flag_next;
							break;

						case 'f':

							if (*(++i) != 'a' || *(++i) != 'l' || *(++i) != 's' || *(++i) != 'e')
								goto e_unknown_value;

							if (!new_value(&state, &top, &root, &alloc, json_boolean))
								goto e_alloc_failure;

							flags |= flag_next;
							break;

						case 'n':

							if (*(++i) != 'u' || *(++i) != 'l' || *(++i) != 'l')
								goto e_unknown_value;

							if (!new_value(&state, &top, &root, &alloc, json_null))
								goto e_alloc_failure;

							flags |= flag_next;
							break;

						default:

							if (isdigit(b) || b == '-')
							{
								if (!new_value(&state, &top, &root, &alloc, json_integer))
									goto e_alloc_failure;

								if (!state.first_pass)
								{
									while (isdigit(b) || b == '+' || b == '-'
										|| b == 'e' || b == 'E' || b == '.')
									{
										b = *++i;
									}

									flags |= flag_next | flag_reproc;
									break;
								}

								flags &= ~(flag_num_negative | flag_num_e |
									flag_num_e_got_sign | flag_num_e_negative |
									flag_num_zero);

								num_digits = 0;
								num_fraction = 0;
								num_e = 0;

								if (b != '-')
								{
									flags |= flag_reproc;
									break;
								}

								flags |= flag_num_negative;
								continue;
							}
							else
							{
								sprintf(error, "%d:%d: Unexpected %c when seeking value", cur_line, e_off, b);
								goto e_failed;
							}
						};
					};
				}
				else
				{
					switch (top->type)
					{
					case json_object:

						switch (b)
						{
						whitespace:
							continue;

						case '"':

							if (flags & flag_need_comma && (!state.settings.settings & json_relaxed_commas))
							{
								sprintf(error, "%d:%d: Expected , before \"", cur_line, e_off);
								goto e_failed;
							}

							flags |= flag_string;

							string = (json_char *)top->_reserved.object_mem;
							string_length = 0;

							break;

						case '}':

							flags = (flags & ~flag_need_comma) | flag_next;
							break;

						case ',':

							if (flags & flag_need_comma)
							{
								flags &= ~flag_need_comma;
								break;
							}

						default:

							sprintf(error, "%d:%d: Unexpected `%c` in object", cur_line, e_off, b);
							goto e_failed;
						};

						break;

					case json_integer:
					case json_double:

						if (isdigit(b))
						{
							++num_digits;

							if (top->type == json_integer || flags & flag_num_e)
							{
								if (!(flags & flag_num_e))
								{
									if (flags & flag_num_zero)
									{
										sprintf(error, "%d:%d: Unexpected `0` before `%c`", cur_line, e_off, b);
										goto e_failed;
									}

									if (num_digits == 1 && b == '0')
										flags |= flag_num_zero;
								}
								else
								{
									flags |= flag_num_e_got_sign;
									num_e = (num_e * 10) + (b - '0');
									continue;
								}

								top->u.integer = (top->u.integer * 10) + (b - '0');
								continue;
							}

							num_fraction = (num_fraction * 10) + (b - '0');
							continue;
						}

						if (b == '+' || b == '-')
						{
							if ((flags & flag_num_e) && !(flags & flag_num_e_got_sign))
							{
								flags |= flag_num_e_got_sign;

								if (b == '-')
									flags |= flag_num_e_negative;

								continue;
							}
						}
						else if (b == '.' && top->type == json_integer)
						{
							if (!num_digits)
							{
								sprintf(error, "%d:%d: Expected digit before `.`", cur_line, e_off);
								goto e_failed;
							}

							top->type = json_double;
							top->u.dbl = (double)top->u.integer;

							num_digits = 0;
							continue;
						}

						if (!(flags & flag_num_e))
						{
							if (top->type == json_double)
							{
								if (!num_digits)
								{
									sprintf(error, "%d:%d: Expected digit after `.`", cur_line, e_off);
									goto e_failed;
								}

								top->u.dbl += ((double)num_fraction) / (pow(10, (double)num_digits));
							}

							if (b == 'e' || b == 'E')
							{
								flags |= flag_num_e;

								if (top->type == json_integer)
								{
									top->type = json_double;
									top->u.dbl = (double)top->u.integer;
								}

								num_digits = 0;
								flags &= ~flag_num_zero;

								continue;
							}
						}
						else
						{
							if (!num_digits)
							{
								sprintf(error, "%d:%d: Expected digit after `e`", cur_line, e_off);
								goto e_failed;
							}

							top->u.dbl *= pow(10, (double)(flags & flag_num_e_negative ? -num_e : num_e));
						}

						if (flags & flag_num_negative)
						{
							if (top->type == json_integer)
								top->u.integer = -top->u.integer;
							else
								top->u.dbl = -top->u.dbl;
						}

						flags |= flag_next | flag_reproc;
						break;

					default:
						break;
					};
				}

				if (flags & flag_reproc)
				{
					flags &= ~flag_reproc;
					--i;
				}

				if (flags & flag_next)
				{
					flags = (flags & ~flag_next) | flag_need_comma;

					if (!top->parent)
					{
						/* root value done */

						flags |= flag_done;
						continue;
					}

					if (top->parent->type == json_array)
						flags |= flag_seek_value;

					if (!state.first_pass)
					{
						json_value * parent = top->parent;

						switch (parent->type)
						{
						case json_object:

							parent->u.object.values
								[parent->u.object.length].value = top;

							break;

						case json_array:

							parent->u.array.values
								[parent->u.array.length] = top;

							break;

						default:
							break;
						};
					}

					if ((++top->parent->u.array.length) > state.uint_max)
						goto e_overflow;

					top = top->parent;

					continue;
				}
			}

			alloc = root;
		}

		return root;

	e_unknown_value:

		sprintf(error, "%d:%d: Unknown value", cur_line, e_off);
		goto e_failed;

	e_alloc_failure:

		strcpy(error, "Buffer overrun");
		goto e_failed;

	e_overflow:

		sprintf(error, "%d:%d: Too long (caught overflow)", cur_line, e_off);
		goto e_failed;

	e_failed:

		if (*error)
			parser_error.set(error);
		else
			parser_error.set("Unknown error");

		if (state.first_pass)
			alloc = root;

		while (alloc)
		{
			top = alloc->_reserved.next_alloc;
			alloc = top;
		}

		return 0;
	}
};


#endif


