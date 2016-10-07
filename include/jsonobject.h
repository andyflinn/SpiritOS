/* ******************************************************************
   Copyright (C) 1996-2015  Thugs at Bay Inc, All Rights Reserved.

   This program is NOT free software; you can NOT redistribute it.

   Thugs at Bay Contact information:
   email: info@thugsatbay.com or
   phone: 416 534 3562

** *************************************************************** */

#ifndef ZS4_JSON_OBJECT
#define ZS4_JSON_OBJECT

#include <zs4array.h>
#include <zs4jsonparser.h>

#ifndef JSON_MAX_CHILDREN
#define JSON_MAX_CHILDREN (16)
#endif

#ifndef JSON_NAME_SIZE
#define JSON_NAME_SIZE (32)
#endif


ZS4_ARRAYBUFFER(json_treenode, JSON_MAX_CHILDREN);
ZS4_STRINGBUFFER(json_namebuffer, JSON_NAME_SIZE);

class jsonName : private json_namebuffer
{
public:
	inline jsonName(void){}
	inline virtual ~jsonName(void){}
	inline zs4error set(const char * n){
		if (n == NULL || n[0] == 0 || strlen(n) >= JSON_NAME_SIZE)
			return zs4FAILURE;

		for (const char * p = n; *p != 0; p++)
		{
			if (*p < 'a' || *p >'z')
				return zs4FAILURE;
		}

		return json_namebuffer::setTrim(n);
	}
	inline const char * get(void){
		return str;
	}
};

class jsonValue : public zs4array<json_treenode,json_treenode>
{
public:
	inline jsonValue()
	{
		
	}
	inline virtual ~jsonValue()
	{
	}

	jsonName name;

	inline virtual zs4error init(void){
		return zs4FAILURE;
	}
	inline virtual zs4error save(zs4stream * out){
		return zs4FAILURE;
	}
	inline virtual zs4error load(const char * in){
		return zs4FAILURE;
	}
	inline virtual zs4error load(json_value * in){
		return zs4FAILURE;
	}
};

template <class parsertype>
class jsonObject : public jsonValue
{
public:
	inline jsonObject()
	{

	}
	inline virtual ~jsonObject()
	{
	}
	inline virtual zs4error load(const char * in){
		if (in == NULL || in[0]==0)
			return zs4FAILURE;

		zs4jsonParser<parsertype> parser;
		if ( const json_value * v = parser.Parse(in) )
			return load(v);

		return zs4FAILURE;
	}
	inline virtual zs4error load(json_value * in){
		if (in == NULL || in->type != json_object)
			return zs4FAILURE;

		zs4error ret = zs4SUCCESS;

		jsonValue ** arr = (jsonValue **)array();
		for (size_t i = 0; i < count(); i++)
		{
			const char * nam = arr[i]->name.get();

			bool found = false;
			for (size_t j = 0; j < in->u.object.length; j++)
			{
				if (!strcmp(nam, in->u.object.values[j].name))
				{
					found = true;
					if (zs4SUCCESS != arr[i]->load(in->u.object.values[j].value))
						ret = zs4FAILURE;
					break;
				}
			}

			if (!found)
			{
				ret = zs4FAILURE;
				arr[i]->init();
			}
		}

		return ret;
	}
	inline virtual zs4error save(zs4stream * out){
		out->write('{');
		jsonValue ** arr = (jsonValue **)array();
		for (size_t i = 0; i < count(); i++)
		{
			if (i)out->write(',');
			out->write('"');
			out->write(arr[i]->name.get());
			out->write('"');

			out->write(':');
			arr[i]->save(out);
		}
		return out->write('}');
	}
};

class jsonBool : public jsonValue
{
public:
	bool value;
	inline jsonBool()
	{

	}
	inline virtual ~jsonBool()
	{
	}
	inline virtual zs4error load(json_value * in){
		if (in == NULL || in->type != json_boolean)
			return zs4FAILURE;

		if (in->u.boolean) value = true;
		else value = false;

		return zs4SUCCESS;
	}
	inline virtual zs4error save(zs4stream * out){
		if (value) return out->write("true");
		else return out->write("false");
	}
};

class jsonInt : public jsonValue
{
public:
	json_int_t value;
	inline jsonInt()
	{

	}
	inline virtual ~jsonInt()
	{
	}
	inline virtual zs4error load(json_value * in){
		if (in == NULL || in->type != json_integer)
			return zs4FAILURE;

		value = in->u.integer;
		return zs4SUCCESS;
	}
	inline virtual zs4error save(zs4stream * out){
		char buf[64];
		snprintf(buf, sizeof(buf), "ll%d", value);
		return out->write(buf);
	}
};

class jsonFloat : public jsonValue
{
public:
	double value;
	inline jsonFloat()
	{

	}
	inline virtual ~jsonFloat()
	{
	}
	inline virtual zs4error load(json_value * in){
		if (in == NULL || in->type != json_double)
			return zs4FAILURE;

		value = in->u.dbl;
		return zs4SUCCESS;
	}
	inline virtual zs4error save(zs4stream * out){
		char buf[128];
		snprintf(buf, sizeof(buf), "%g", value);
		return out->write(buf);
	}
};

#endif

