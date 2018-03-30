#ifndef ZS4_UTIL
#define ZS4_UTIL

#include <zs4.h>
#include <zs4config.h>

#define bpi8_t char 

typedef class util : public zs4::bpi8
{
public:
	typedef class json{
	protected:
		typedef long long json_int;
		typedef struct
		{
			long long max_memory;
			int settings;
		} json_settings;

#		define json_relaxed_commas 1

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
				long long integer;
				double dbl;

				struct
				{
					json_int length;
					char * ptr; /* null terminated */

				} string;

				struct
				{
					json_int length;

					struct
					{
						char * name;
						struct _json_value * value;

					} *values;

				} object;

				struct
				{
					json_int length;
					struct _json_value ** values;

				} array;

			} u;

			union
			{
				struct _json_value * next_alloc;
				void * object_mem;

			} _reserved;

		} json_value;

	public:
		typedef class parser
		{
			json_value * JObj;
			ZS4CHAR buffer[ZS4_PARSER_SIZE];
			ZS4LARGE len;

			inline virtual ZS4CHAR * zs4alloc(ZS4LARGE size){
				if (size > (ZS4_PARSER_SIZE - len))
					return NULL;

				ZS4CHAR * mem = &buffer[len];
				len += size;

				memset(mem, 0, size);

				return mem;
			}

		public:
			inline parser(void){
				len = 0;
				JObj = NULL;
			}

			inline json_value * value(void){ return JObj; }
			inline json_value * parse(const char * json){

				len = 0;
				JObj = NULL;

				json_settings settings; memset(&settings, 0, sizeof(json_settings));
				settings.max_memory = sizeof(buffer);

				if (json_value * nuJv = json_parse_ex(&settings, json))
				{
					JObj = nuJv;
					return nuJv;
				}

				return NULL;
			}
		private:
			inline static ZS4SHORT hex_value(char c)
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

				json_int used_memory;

				// 2 members added by zs4
				ZS4LARGE device_max;
				ZS4LARGE ulong_max;

			} json_state;

			inline int new_value
				(json_state * state, json_value ** top, json_value ** root, json_value ** alloc, json_type type)
			{
				json_value * value;
				ZS4LARGE values_size;

				if (!state->first_pass)
				{
					value = *top = *alloc;
					*alloc = (*alloc)->_reserved.next_alloc;

					if (!*root)
						*root = value;

					switch (value->type)
					{
					case json_array:

						if (!(value->u.array.values = (json_value **)this->zs4alloc
							(((ZS4LARGE)value->u.array.length + 1) * sizeof(json_value *))))
						{
							return 0;
						}

						value->u.array.length = 0;
						break;

					case json_object:

						values_size = (ZS4LARGE)(sizeof(*value->u.object.values) * (ZS4LARGE)value->u.object.length);

						if (!((*(void **)&value->u.object.values) = this->zs4alloc
							(values_size + ((ZS4LARGE)value->u.object.values))))
						{
							return 0;
						}

						value->_reserved.object_mem = (*(char **)&value->u.object.values) + values_size;

						value->u.object.length = 0;
						break;

					case json_string:

						if (!(value->u.string.ptr = (char *)this->zs4alloc
							((ZS4LARGE)(value->u.string.length + 1) * sizeof(char))))
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

				value = (json_value *)this->zs4alloc(sizeof(json_value));

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

			inline json_value * json_parse_ex(json_settings * settings, const char * json)
			{
				ZS4LARGE cur_line;
				const char * cur_line_begin, *i;
				json_value * top, *root, *alloc = 0;
				json_state state;
				long flags;
				long num_digits, num_fraction, num_e;

				memset(&state, 0, sizeof(json_state));
				memcpy(&state.settings, settings, sizeof(json_settings));

				memset(&state.device_max, 0xFF, sizeof(state.device_max));
				memset(&state.ulong_max, 0xFF, sizeof(state.ulong_max));

				state.device_max -= 8; /* limit of how much can be added before next check */
				state.ulong_max -= 8;

				for (state.first_pass = 1; state.first_pass >= 0; --state.first_pass)
				{
					ZS4SHORT uchar;
					ZS4CHAR uc_b1, uc_b2, uc_b3, uc_b4;
					char * string;
					ZS4LARGE string_length;

					top = root = 0;
					flags = flag_seek_value;

					cur_line = 1;
					cur_line_begin = json;

					for (i = json;; ++i)
					{
						char b = *i;

						if (flags & flag_done)
						{
							if (!b)
								break;

							switch (b)
							{
							whitespace:
								continue;

							default:
								goto e_failed;
							};
						}

						if (flags & flag_string)
						{
							if (!b)
							{
								goto e_failed;
							}

							if (string_length > state.device_max)
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

									if ((uc_b1 = (ZS4CHAR)hex_value(*++i)) == 0xFF || (uc_b2 = (ZS4CHAR)hex_value(*++i)) == 0xFF
										|| (uc_b3 = (ZS4CHAR)hex_value(*++i)) == 0xFF || (uc_b4 = (ZS4CHAR)hex_value(*++i)) == 0xFF)
									{
										goto e_failed;
									}

									uc_b1 = uc_b1 * 16 + uc_b2;
									uc_b2 = uc_b3 * 16 + uc_b4;

									uchar = ((char)uc_b1) * 256 + uc_b2;

									if (sizeof(char) >= sizeof(ZS4SHORT) || (uc_b1 == 0 && uc_b2 <= 0x7F))
									{
										string_add((char)uchar);
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
										(*(char **)&top->u.object.values) += string_length + 1;
									else
									{
										top->u.object.values[top->u.object.length].name
											= (char *)top->_reserved.object_mem;

										(*(char **)&top->_reserved.object_mem) += string_length + 1;
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
								else if (!(state.settings.settings & json_relaxed_commas))
								{
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

									if (flags & flag_need_comma && (!(state.settings.settings & json_relaxed_commas)))
									{
										goto e_failed;
									}

									flags |= flag_string;

									string = (char *)top->_reserved.object_mem;
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

							if ((++top->parent->u.array.length) > (json_int)state.device_max)
								goto e_overflow;
							top = top->parent;

							continue;
						}
					}

					alloc = root;
				}

				return root;

			e_unknown_value:
			e_alloc_failure :
			e_overflow :
				   e_failed :

							if (state.first_pass)
								alloc = root;

							while (alloc)
							{
								top = alloc->_reserved.next_alloc;
								alloc = top;
							}

							return 0;
			}
		}parser;

	}json;
	typedef class fileinfo
	{
		ZS4CHAR buffer[256];
	public:
		inline fileinfo()
		{
			clear();
		}
		inline e clear(void){
			buffer[0] = 0;
			size = 0;
			created = modified = 0;
			readonly = hidden = isdir = false;
			return SUCCESS;
		}
		inline static int CompareFileSizeAscend(const void * v1, const void * v2)
		{
			register fileinfo * c1 = ((fileinfo**)v1)[0];
			register fileinfo * c2 = ((fileinfo**)v2)[0];

			if (c1->isdir)
			{
				if (c2->isdir)
					return 0;

				return -1;
			}
			else
				if (c2->isdir)
					return 1;

			if (c1->size < c2->size)
				return -1;

			if (c1->size > c2->size)
				return 1;

			return 0;
		}
		inline static int CompareFileSizeDescend(const void * v1, const void * v2)
		{
			return -CompareFileSizeAscend(v1, v2);
		}
		inline e info(char * objectname)
		{
			if (strlen((char*)objectname) > sizeof(buffer))
				return FAILURE;

			e err = SUCCESS;

			struct stat buf;
			memset(&buf, 0, sizeof(buf));

			if (stat((const char*)objectname, &buf))
				return FAILURE;

			size = buf.st_size;
			created = buf.st_mtime;
			modified = buf.st_mtime;

			isdir = (S_ISDIR(buf.st_mode));

			strcpy((char*)buffer, (const char*)objectname);

		}

		size_t size;
		time_t created;
		time_t modified;
		bool readonly, hidden, isdir;
	}fileinfo;
	typedef class file : public zs4::bpi8::stream
	{
	protected:
		ZS4LARGE read_able;
		fileinfo info;
		FILE * handle;
		bool open_for_write;
	public:
		inline file(void){
			handle = NULL;
			close();
		};
		inline virtual ~file(void){
			close();
		};

		inline e openRead(bpi8_t * name){
			close();

			if (SUCCESS != info.info(name))
				return FILEINFOERROR;

			handle = fopen(name, "rb");
			if (handle == NULL)
				return FILEOPENERROR;

			read_able = info.size;
			open_for_write = false;
			return SUCCESS;
		}
		inline e openWrite(bpi8_t * name){
			close();
			handle = fopen(name, "w+");
			if (handle == NULL)
				return FILEOPENERROR;

			info.info(name);
			open_for_write = true;
			return SUCCESS;
		}
		inline e close(void){
			if (handle != NULL)
			{
				fclose(handle);
				handle = NULL;
			}
			read_able = 0;
			info.clear();
			open_for_write = false;
			return SUCCESS;
		}

		inline virtual unsigned bpi8_t readable(){
			if (handle == NULL) return 0;
			return read_able;
		}
		inline virtual unsigned bpi8_t writeable(void){
			if (handle == NULL) return 0;
			return (~0);
		}

		inline virtual e read(unsigned bpi8_t & c){
			if (!readable())
				return FAILURE;

			c = fgetc(handle);
			if (c == EOF)
				return FAILURE;

			return SUCCESS;
		}
		inline virtual e write(unsigned bpi8_t c){
			if (!writeable())
				return FAILURE;

			char b = c;
			if (0 == fwrite(&b, 1, 1, handle))
				return FAILURE;

			return SUCCESS;
		}
		INLINE_SEEK_FUNCTION(){
			if (handle == NULL)
				return FAILURE;

			return (e)fseek((FILE*)handle, (long)offset, (int)origin);
		}
		INLINE_TELL_FUNCTION(){
			if (handle == NULL)
			{
				pPos = 0;
				return FAILURE;
			}

			pPos = ftell((FILE*)handle);

			return SUCCESS;
		}
		INLINE_SIZE_FUNCTION(){
			if (NULL == handle)
			{
				s = 0;
				return FAILURE;
			}

			if (open_for_write)
			{
				return FAILURE;
			}

			s = info.size;
			return SUCCESS;
		}

	}file;
	typedef class in : public file
	{
	public:

		inline virtual unsigned bpi8_t readable(){ return 1; }
		inline in(void){
			handle = stdin;
		};
		inline virtual ~in(void){
			handle = NULL;
		};
	}in;
	typedef  class out : public file
	{
	public:
		inline virtual unsigned bpi8_t writeable(void){ return 1; }
		inline out(void){
			handle = stdout;
		};
		inline virtual ~out(void){
			handle = NULL;
		};
	}out;
	typedef class fs
	{
	public:
		inline fs(){
			count = 0;
		}
		inline virtual ~fs(){
		}
		static const ZS4LARGE ZS4_MAX_DIR_SIZE = 256;
		static const ZS4LARGE TAB_FS_MAX_PATH_LENGTH = 256;

		inline static bool isFile(const char * path){
			struct stat ino;

			if (stat((const char *)path, &ino))
				return false;

			if (S_ISREG(ino.st_mode))
				return true;

			return false;
		}
		inline static bool isDir(const char * path){
			struct stat ino;

			if (stat((const char *)path, &ino))
				return false;

			if (S_ISDIR(ino.st_mode))
				return true;

			return false;
		}
		inline static e cd(const char * nu){
			return (e)chdir((const char *)nu);
		}
		inline static e mkDir(const char * name){
			char dirnam[TAB_FS_MAX_PATH_LENGTH];
			char pdir[TAB_FS_MAX_PATH_LENGTH];

			strncpy(dirnam, (const char *)name, sizeof(dirnam));

			char * f = (char*)dirnam, *t = pdir;

			while (*f != 0)
			{
				//char sav = *f;
				*t++ = *f++; *t = 0;
				if ((*f == '/') || (*f == 0))
				{
#ifdef _WIN32
					_mkdir(pdir);
#else
					mkdir(pdir, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
#endif
				}
			}

			if (!isDir(name))
			{
				return FAILURE;
			}

			return SUCCESS;
		}
		inline static e rmFile(bpi8_t * name){
			if (!unlink((const char *)name)) return SUCCESS;
			return FAILURE;
		}
		inline static e rmDir(bpi8_t * name){
			if (!rmdir((const char *)name)) return SUCCESS;
			return FAILURE;
		}
		inline static e info(bpi8_t * objectname, fileinfo * info){
			if (objectname == NULL || objectname[0] == 0 || info == NULL)
				return FAILURE;

			return info->info(objectname);
		}

		inline static time_t created(bpi8_t * fnam){
			fileinfo info;

			if ((!isFile(fnam))
				|| (SUCCESS != fs::info(fnam, &info))
				)
				return 0;

			return info.created;
		}
		inline static time_t modified(bpi8_t * fnam){
			fileinfo info;

			if ((!fs::isFile(fnam))
				|| (SUCCESS != fs::info(fnam, &info))
				)
				return 0;

			return info.modified;
		}
		inline size_t list(bpi8_t * name, bool hidden_files){

			count = 0;

			if (isFile(name))
				return 0;

			if (!isDir(name))
				return 0;

			fileinfo * nu;

			tinydir_dir dir;
			if (tinydir_open(&dir, ".") == -1)
				return count;

			while (dir.has_next)
			{
				tinydir_file file;
				if (tinydir_readfile(&dir, &file) == -1)
					break;

				if (strcmp((const unsigned bpi8_t*)file.name, (const unsigned bpi8_t*)".")
					&& strcmp((const unsigned bpi8_t*)file.name, (const unsigned bpi8_t*)"..")
					&& strcmp((const unsigned bpi8_t*)file.name, (const unsigned bpi8_t*)".zs4")
					)
				{

					if ((NULL == (nu = nuStat())) || SUCCESS != nu->info(file.name))
						break;
				}
				tinydir_next(&dir);
			}

			tinydir_close(&dir);
			return count;
		}

		inline fileinfo * nuStat(void)	{
			if (count >= (ZS4_MAX_DIR_SIZE - 1))
				return NULL;

			statData[count].clear();
			fileinfo * ret = &statData[count];
			statArray[count] = &statData[count];
			count++;
			return ret;
		}
		size_t count;
		fileinfo * statArray[ZS4_MAX_DIR_SIZE];
		fileinfo statData[ZS4_MAX_DIR_SIZE];
	}fs;

}util;

#endif
