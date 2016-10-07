#ifndef ZS4_STREAMHANDLER_H
#define ZS4_STREAMHANDLER_H

#include "zs4pipe.h"

template <class zs4stringtype>
class zs4streamhandler : public zs4object
{
public:
	ZS4_STRINGBUFFER(zs4HeaderLine, ZS4_SERVER_HEADER_LINE_LENGTH);
	ZS4_STRINGBUFFER(zs4HostName, ZS4_SERVER_HOSTNAME_LENGTH);
	ZS4_STRINGBUFFER(zs4MimeType, ZS4_SERVER_MIMETYPE_LENGTH);
	ZS4_STRINGBUFFER(zs4Scanbuf, 16);

	typedef enum {
		NONE,
		LINE,
		DATA,
		CLOSE,
	NUMBER_OF_EVENT_TYPES} zs4streamEventType;

	typedef enum {
		UNKNOWN,
		ZS4_CONNECT,
		HTTP_GET,
		HTTP_POST,		
	NUMBER_OF_ZS4_COMMANDS} zs4HeaderCommand;

	typedef enum {
		DEFAULT_HTML = 200,
		NOT_FOUND = 404,		
	NUMBER_OF_QUICK_RESPONSES} zs4QuickResponse;

	ZS4_STRINGCONSTANT(CONTENT_TYPE, Content - Type);
	ZS4_STRINGCONSTANT(CONTENT_LENGTH, Content - Length);
	ZS4_STRINGCONSTANT(HOST, Host);

	zs4pipe<zs4stringtype> * pipe;
	zs4Scanbuf scan;
	zs4stringtype buffer;

	zs4HeaderCommand headerCommand;
	zs4HeaderLine requestPath;
	zs4HostName requestHost;
	zs4MimeType requestMime;
	size_t requestLength;

	inline zs4streamhandler(){
		pipe = NULL;
		buffer.clear();
	}

	inline virtual ~zs4streamhandler(void){
	}

	inline virtual zs4error init(zs4pipe<zs4stringtype> * s){
		pipe = s;
		reset();
		return zs4SUCCESS;
	}

	inline virtual void reset(void){
		buffer.clear();
		scan.set("\r\n");
		requestLength = 0;
		headerCommand = UNKNOWN;
		requestPath.clear();
		requestHost.clear();
		requestMime.clear();
	}

	inline virtual zs4error handle(void){
		while (scan.check())
		{
			char c;
			bool found = false;
			for (;;)
			{
				if (!strend(buffer.str, scan.str)){found = true;break;}
				if (0 == pipe->req.readable()){ break; }
				pipe->req.readChar(&c);
				buffer.writeChar(c);
			}

			if (found)
			{
				onLine();
				buffer.clear();
			}
			else
			{
				break;
			}
		}

		return zs4SUCCESS;
	}

	inline zs4error respondQuickHtml(zs4QuickResponse how)
	{
		zs4StringBuffer head;
		zs4StringBuffer body;

		switch (how)
		{
		case NOT_FOUND:
		{
			if (pipe == NULL)
				return zs4FAILURE;

			body.set("<html><body>Not Found</body></html>");
			size_t body_len = strlen(body.str);

			head.clear();
			head.write("HTTP/1.0 404 Not Found\r\n");
			head.write("Content-Type: text/html\r\n");
			head.write("Content-Length: ");  head.write((int)body_len); head.write("\r\n");
			head.write("\r\n");
			size_t head_len = strlen(head.str);

			if (pipe->rep.writeBlock(head.str, head_len) == head_len &&
				pipe->rep.writeBlock(body.str, body_len) == body_len
				)
				return zs4SUCCESS;
		}
		case DEFAULT_HTML:
		default:
		{
			if (pipe == NULL)
				return zs4FAILURE;

			body.set("<html><body></body></html>");
			size_t body_len = strlen(body.str);

			head.clear();
			head.write("HTTP/1.0 200 OK\r\n");
			head.write("Content-Type: text/html\r\n");
			head.write("Content-Length: ");  head.write((int)body_len); head.write("\r\n");
			head.write("\r\n");
			size_t head_len = strlen(head.str);

			if (pipe->rep.writeBlock(head.str, head_len) == head_len &&
				pipe->rep.writeBlock(body.str, body_len) == body_len
				)
				return zs4SUCCESS;
		}
		}

		return zs4FAILURE;

	}

	inline virtual void onData(void){
		while (pipe->readable() && pipe->writeable())
		{
			char c;
			pipe->readChar(&c);
			pipe->writeChar(c);
		}
	}

	inline virtual void onLine(void)
	{
		if (pipe == NULL)
			return;

		buffer.trim();

		if (!buffer.check())
		{
			if (headerCommand == UNKNOWN)
			{
				pipe->write("HTTP/1.0 500 bad\r\n\r\n");
				pipe->close();
				return;
			}
			else
			if (headerCommand == HTTP_GET)
			{
				if (zs4SUCCESS != respondQuickHtml(DEFAULT_HTML))
				{
					pipe->close();
					return;
				}
			}
			else
			{
				if (zs4SUCCESS != respondQuickHtml(NOT_FOUND))
				{
					pipe->close();
					return;
				}
			}

			// cleanup for yet another header
			headerCommand = UNKNOWN;
		}
		else
		if (headerCommand == UNKNOWN)
		{
			int i = 0;
			char * str = buffer.str;

			// HTTP method
			//////////////
			if (str[0] == 'P' && str[1] == 'O' && str[2] == 'S' && str[3] == 'T' && isspace(str[4]))
			{
				str[4] = 0; i = 5;
				headerCommand = HTTP_POST;
			}
			else
			if (str[0] == 'G' && str[1] == 'E' && str[2] == 'T' && isspace(str[3]))
			{
				str[3] = 0; i = 4;
				headerCommand = HTTP_GET;
			}
			else
			if (str[0] == 'Z' && str[1] == 'S' && str[2] == '4' && isspace(str[3]))
			{
				str[3] = 0; i = 4;
				headerCommand = ZS4_CONNECT;
			}
			else
			{
				pipe->write("HTTP/1.0 500 bad\r\n\r\n");
				pipe->close();
				return;
			}

			// Request Path
			///////////////
			while (isspace(str[i]) && str[i] != '\r' && str[i] != '\n' && str[i] != 0) { str[i++] = 0; }
			requestPath.clear();
			while (!isspace(str[i]) && str[i] != 0) { requestPath.write(str[i++]); }
		}
		else if (!strnicmp(buffer.str, CONTENT_TYPE(), CONTENT_TYPE_SIZE()))
		{
			requestMime.setTrim(&buffer.str[CONTENT_TYPE_SIZE() + 1]);
		}
		else if (!strnicmp(buffer.str, HOST(), HOST_SIZE()))
		{
			requestHost.setTrim(&buffer.str[HOST_SIZE() + 1]);
		}
		else if (!strnicmp(buffer.str, CONTENT_LENGTH(), CONTENT_LENGTH_SIZE()))
		{
			zs4HeaderLine buf; buf.setTrim(&buffer.str[CONTENT_LENGTH_SIZE() + 1]);
			requestLength = atoi(buf.str);
		}
	}
};

#endif
