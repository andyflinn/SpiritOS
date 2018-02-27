'use strict';

var isWindow = new Function("try {return this===window;}catch(e){ return false;}");
var isNode = new Function("try {return this===global;}catch(e){return false;}");

var zs4;
zs4 = new Object();
if (isNode()) {
    zs4 = exports;
    zs4.debug = require('debug')('zs4');
}
else {
    zs4 = new Object();
    zs4.debug = function(){};
}

zs4.host = {
  window:{

  },
  node:{

  },
}

zs4.const = {
  API:{
    NAME:{
      MINLENGTH:2,
      MAXLENGTH:32,
      ADMIN:'admin',
      FS:'fs',
      INITIALIZE:'initialize',
      QUERY:'query',
    },
  },
  DEFAULT:{
    MESSAGE:{
      EXPIRY:{
        MS:1000,
      },
    },
  },
  EMAIL:{
    MINLENGTH:5,
    MAXLENGTH:64,
    ROOT:'root@zs4.zs4',
    PUBLIC:'public@zs4.zs4',
  },
  MS:{
    SECOND:1000,
    MINUTE:(1000*60),
    HOUR:(1000*60*60),
    DAY:(1000*60*60*24),
    WEEK:(1000*60*60*24*7),
    YEAR:(1000*60*60*24*365.25),
  },
  OBJECT:{
    OWNER:'owner@zs4.zs4',
  },
  PATH:{
    MINLENGTH:1,
    MAXLENGTH:255,
  },
  NAME:{
    MINLENGTH:1,
    MAXLENGTH:32,
  },
  STRING:{
    MINLENGTH:0,
    MAXLENGTH:255,
  },
  TEXT:{
    DFTLENGTH:((8*1024)-1),
    MINLENGTH:0,
    MAXLENGTH:((256*256)-1),
  },
  SPACECHARS:' \n\r\t',
  SPECIALCHARS:' \n\r\t\"\'\\/,.?<>[]=-_+()*&^%$#@!0123456789;:',
  NOATTRCHARS:'\n\r\t\"\'',
  MAXLENGTH:{
    META:160,
    TITLE:70,
    LANG:10,
  },
};

zs4.console = {
  arr:[],
  on:true,
  log:function(v){
    if (this.on)zs4.debug(v);
  },
};

zs4.is = {
      array:function (a){
        if	(a==null)return false;
        return (a instanceof Array);
      },
      boolean:function(b){
        if	(b==null)return false;
        if	(typeof(b)!='boolean')return false;
        return true;
      },
      function:function(f){
        if (f==null)return false;
        return (f instanceof Function);
      },
      string:function(s){
        if	(s==null)return false;
        if	(typeof(s)!='string')return false;
        return true;
      },
      email:function(str){
        if (!zs4.is.string(str)||str.length<zs4.const.EMAIL.MINLENGTH||str.length>zs4.const.EMAIL.MAXLENGTH)return false;
        var at = str.indexOf('@');
        if (at < 1 || at > (str.length-(zs4.const.EMAIL.MINLENGTH-1)) || str.lastIndexOf('@') != at)return false;
        var nam = str.substr(0,at);
        var dom = str.substr((at+1),(str.length-at-1));
        var dot = dom.indexOf('.');
        if (dot < 1 || dot > (dom.length-2))return false;
        dot = dom.lastIndexOf('.');
        if (dot > (dom.length-2))return false;
        return true;
      },
      password:function(s){
        if	(!zs4.is.string(s) || s.trim()!=s || s.length < 4)return false;
        return true;
      },
      number:function(b){
        if	(b==null)return false;
        if	(typeof(b)!='number')return false;
        return true;
      },
      object:function(o){
        //debugger;
        if	(o==null)return false;
        if	(o instanceof Object){
          if (typeof(o)=='function')return false;
          if	(typeof(o.length)=='number' || (o instanceof Array)==true)return false;
          return true;
        }
        return false;
      },
      error:function(o){if (!zs4.is.object(o) || !zs4.is.object(o.error))return false;return true;},
      done:function(o){if (!zs4.is.object(o) || !zs4.is.object(o.done))return false;return true;},
      name:function(n){
        if	(!zs4.is.string(n))return false;
        if	(n=="zs4")return true;
        var l=n.length;
        if	(l<1)return false;
        for (var i=0;i<l;i++){
          if(n.charAt(i)<'a'||n.charAt(i)>'z')return false;
        }
        return true;
      },
      objectProperty:function(o,p){
        if(!zs4.is.object(o)||!zs4.is.string(p))return null;
        var a = p.split('.');
        var l = a.length;
        var p = '';
        if (l<1)return null;
        if ((l>=2)&&(a[0]=='zs4')&&(a[1]=='zs4'))return null;

        for (var i = 0 ; i < l ; i++){
          if (p!='')p+='.'; p+=a[i];

          if (!o.hasOwnProperty(a[i])){return null;}
          o=o[a[i]];
        }
        return o;
      },
      space:function(ch){
        if (ch=='\n'||ch=='\r'||ch=='\t'||ch==' ')return true;
        return false;
      },
      numchar:function(ch){
        if (ch>='0'&&ch<='9')return true;
        return false;
      },
      type:function(o){
        if (!zs4.is.object(o)
        || !zs4.is.object(o._)
        || !zs4.is.name(o._.name)
        || !zs4.is.name(o._.typename)
        //|| !zs4.is.function(o.type)
        )return false;
        return true;
      },
};

if (isNode()){
  zs4.is.node = function(){return true;}
  zs4.is.window = function(){return false;}
}
else {
  zs4.is.node = function(){return false;}
  zs4.is.window = function(){return true;}
}

zs4.string = {
  addKeyWord:function(o,n,k){
    k = zs4.string.to.lower(k);
    if (!zs4.is.name(k))return;
    if ((o[n].length + k.length + 1)>zs4.const.MAXLENGTH.META){
      return;
    }
    if (o[n]==''){
      o[n] = k;
    }
    else {
      o[n]+= ','+k;
    }
  },
  startsWith:function(s,w){
    if (!zs4.is.string(s) || !zs4.is.string(w))return false;
    var b = s.substr(0,w.length);
    if (b == w)return true;
    return false;
  },
  endsWith:function(s,w){
    if (!zs4.is.string(s) || !zs4.is.string(w) || w.length<s.length)return false;
    var b = s.substr(s.length-w.length,w.length);
    if (b == w)return true;
    return false;
  },
  split:{
    names:function(str){
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if ((c >= 'a' && c <= 'z')){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    words:function(str){
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if ((c >= 'a' && c <= 'z')||(c >= 'A' && c <= 'Z')){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    separators:function(str,sep){
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if (sep.indexOf(c)== -1){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    spaces:function(str){
      return zs4.string.split.separators(str,zs4.const.SPACECHARS);
    }
  },
  strip:{
    chars:function(s,x){
      var r='';
      for (var i=0;i<s.length;i++){
        var c = s.charAt(i);
        if (x.indexOf(c)== -1)r+=c;
      }
      return r;
    },
  },
  to:{
    lower:function(str){return str.toLowerCase();},
    upper:function(str){return str.toUpperCase();},
  },
  array:{
    is:{
      element:function(arr,str){
        var trimmed = str.trim();
        for (var i = 0 ; i < arr.length ; i++){
          if (arr[i] == trimmed)return true;
        }
        return false;
      },
    },
    add:{
      new:function(arr,str){
        if (zs4.string.array.is.element(arr,str.trim()))return arr;
        arr.push(str.trim());
        return arr;
      },
    },
    remove:{
      string:function(arr,str){
        var trimmed = str.trim();
        for (var i = (arr.length-1) ; i >= 0 ; i--){
          if (arr[i]==trimmed)
            arr.splice(i,1);
        }
      },
    },
    trimToArray:function (arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        if (!zs4.string.array.is.element(to,arr[i]))
          arr.splice(i,1);
      }
    },
    addToArray:function(arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        zs4.string.array.add.new(to,arr[i]);
      }
    },
    sort:{
      value:{
        ascend:function(arr){
          arr.sort(function(a,b){
            return a.localeCompare(b);
          });
        },
        descend:function(arr){
          arr.sort(function(a,b){
            return b.localeCompare(a);
          });
        },
      },
      length:{
        ascend:function(arr){
          arr.sort(function(a,b){
            return a.length - b.length;
          });
        },
        descend:function(arr){
          arr.sort(function(a,b){
            return b.length - a.length;
          });
        },
      },
    },
  },
  search:function(s,f){
    var a = zs4.string.split.spaces(f);
    if (a.length==0)return true;
    for (var i = 0 ; i < a.length;i++){
      if (s.toLowerCase().search(a[i].toLowerCase())>=0)return true;
    }
    return false;
  },
  escape:{
    html:function(plain){
      var html = ''
      for (var i = 0; i < plain.length; i++){
        var ch = plain.charAt(i);
        if (ch=='\n'){ html += '<br>\n';}
        else if (ch=='&'){html += '&amp;'}
        else if (ch=='<'){html += '&lt;'}
        else if (ch=='>'){html += '&gt;'}
        else if (ch=='&'){html += '&quot;'}
        else if (ch=='"'){html += '&amp;'}
        else if (ch=='\''){html += '&apos;'}
        else {html += ch;}
      }

      return html;
    },
  },
  from:{
    date:function(time){
      var d = new Date(time);
      return ( d.toLocaleDateString() + ' ' + d.toLocaleTimeString() );
    }
  },
};

zs4.parse = {
  int:function(v){
    var n = parseInt(v);
    if (n==NaN)return 0;
    return n;
  },
  float:function(v){
    var n = parseFloat(v);
    if (n==NaN)return 0;
    return n;
  },

};
zs4.count = {
    object:{
      properties:function(o){
        if (!zs4.is.object(o))return 0;
        var count = 0;
        for (var n in o)count++;
        return count;
      },
    },
};

zs4.copy = {
    noncircular:function(from,limit,functions){
      if (!zs4.is.object(from))return null;

      if (!zs4.is.number(limit))limit = 0;
      limit = parseInt(limit);
      if (limit>10)limit = 10;

      var a = [from];
      function c(o){
        for (var i = 0 ; i < a.length ; i++){
          if (a[i]==o)return true;return false;
        }
      }

      function recurse(f,t,level){
        for (var n in f){
          if (zs4.is.function(f[n])){
            if (functions)t[n] = f[n];
            //zs4.debug(n+' is function.');
            continue;
          }
          if (zs4.is.object(f[n])){
            if(c(f[n]))continue;
            //zs4.debug(n+' is object.');
            a.push(f[n]);
            if (level<limit){
              var nu = new Object();
              recurse(f[n],nu,level+1);
              if (zs4.count.object.properties(nu)>0)t[n] = nu;
            }
          }
          else{
            t[n] = f[n];
          }
        }
        return t;
      };
      return recurse(from,new Object(),0);
    },
    schemabasics:function(from,to){
      if (!zs4.is.type(from)||!zs4.is.type(to))return;

      if (zs4.is.number(from._.min))to._.min=from._.min;
      if (zs4.is.number(from._.max))to._.max=from._.max;

      if (zs4.is.number(from._.minlength))to._.minlength=from._.minlength;
      if (zs4.is.number(from._.maxlength))to._.maxlength=from._.maxlength;
      if (zs4.is.array(from._.enum)&&from._.enum.length>0)to._.enum = from._.enum;

    },
    trim:function(f,t){
      //debugger;
      for (var n in f){
        if (zs4.is.object(f[n])){
          if (!zs4.is.object(t[n])){
            t[n] = new Object();
          }
          zs4.copy.trim(f[n],t[n]);
        }
        else {
          t[n] = f[n];
        }
      }

      for (var n in t){
        if (!f.hasOwnProperty(n))
          t[n] = null;
      }
    },
};

zs4.json =  {
  stringify:function(o){return JSON.stringify(zs4.copy.noncircular(o,15));},
  textify:function(o){
    o = zs4.copy.noncircular(o,15);

    var text = ''; var level = 0; var ipl = 2;
    function recurse(o){
      var indent = ''; for (var i = 0;i<level;i++){indent += ' ';}
      if (zs4.is.object(o)){
        text += '{'
        var count = 0; for (var n in o){count += 1;}
        if (count>0)text+='\r\n';
        var c2 = 0;
        for (var n in o){
          c2 += 1;
          text += indent + '\"'+ n + '\":';

          if (zs4.is.object(o[n])||zs4.is.array(o[n])){
            level += ipl;
            recurse(o[n]);
            level -= ipl;
          }
          else {
            text += JSON.stringify(o[n]);
          }
          if (c2 < count)text += ',';
          text += '\r\n';
        }
        text += indent+'}';
      }
      else if (zs4.is.array(o)){
        text += '['
        if (o.length>0)text+='\r\n';
        for (var i = 0; i<o.length; i++){
          text += indent; // + '\"'+ n + '\":';

          if (zs4.is.object(o[i])||zs4.is.array(o[i])){
            level += ipl;
            recurse(o[i]);
            level -= ipl;
          }
          else {
            text += JSON.stringify(o[i]);
          }
          if (i < (o.length-1))text += ',';
          text += '\r\n';
        }
        text += indent+']';
      }
      else {
        text += JSON.stringify(o);
      }
    }

    recurse(o);
    return text;
  },
  parse:function(string,output){
    try {
      var r = JSON.parse(string);
      if (zs4.is.function(output))output(null,r);
      return r;
    }
    catch(err) {
        if (zs4.is.function(output))output(err,null);
        return null;
    }
  },
};

zs4.path = {
  resolve:function(obj,path){
    var ret = obj;
    if (path == null || path.length == 0)return ret;
    var a = zs4.string.split.separators(path,'./\\_-');
    if (a == null || a.length == 0)return ret;
    for (var i = 0 ; i < a.length ; i++){
      if (!zs4.is.name(a[i])||!ret.hasOwnProperty(a[i])) return null;
      ret = ret[a[i]];
    }
    zs4.debug('path resolved: '+path);
    return ret;
  },
};

zs4.error = function(o){
  this.error = {
    text:'unknown error',
    data:null,
  }
  if (zs4.is.object(o)){
    if (zs4.is.string(o.text)){this.error.text = o.text.trim();}
    this.error.data = o.data;
  }
  else if (zs4.is.string(o)){
    this.error.text = o;
  }
}

zs4.done = function(o){
  if (zs4.is.object(o))this.done=o;
  else this.done={};
}

zs4.integer = {
  to:{
    name:function(i){
      if (!zs4.is.number(i))return null;
      var s = parseInt(i).toString();
      var r = '';
      for (var i=0;i<s.length;i++){
        if(s.charAt(i)=='0')r+='a';
        if(s.charAt(i)=='1')r+='b';
        if(s.charAt(i)=='2')r+='c';
        if(s.charAt(i)=='3')r+='d';
        if(s.charAt(i)=='4')r+='e';
        if(s.charAt(i)=='5')r+='f';
        if(s.charAt(i)=='6')r+='g';
        if(s.charAt(i)=='7')r+='h';
        if(s.charAt(i)=='8')r+='i';
        if(s.charAt(i)=='9')r+='j';
      }
      return r;
    },
  },
};

zs4.name = {
  to:{
    integer:function(n){
      if (!zs4.is.name(i))return null;
      r = '';
      for (var i=0;i<s.length;i++){
        if(n.charAt(i)=='a')r+='0';
        if(n.charAt(i)=='b')r+='1';
        if(n.charAt(i)=='c')r+='2';
        if(n.charAt(i)=='d')r+='3';
        if(n.charAt(i)=='e')r+='4';
        if(n.charAt(i)=='f')r+='5';
        if(n.charAt(i)=='g')r+='6';
        if(n.charAt(i)=='h')r+='7';
        if(n.charAt(i)=='i')r+='8';
        if(n.charAt(i)=='j')r+='9';
      }
      return parseInt(r);
    },
  },
};

zs4.time = {
  driver:{
    ticks:{
      now:0,
    },
  },

};

zs4.processor = {
  sequential:function(){
    this.count = 0;
    //this.run = 0;
    this.call = function(THIS,foo,arg){
      var foo_this = 'foo'+this.count;
      var foo_next = 'foo'+(this.count+1);
      var cb_this = 'cb'+this.count;
      var cb_next = 'cb'+(this.count+1);
      this[cb_this] = (function(){
        //zs4.debug('inside '+cb_this);
        this[foo_next](this[cb_next]);
      }).bind(this);

      this[foo_this] = function(cb){foo.call(THIS,arg,cb);};
      this.count++;
    };
    this.run = function(cb){
      if (this.count==0){cb(this);return;}
      var cb_end = 'cb'+(this.count-1);
      this[cb_end] = (function(){
        //zs4.debug('inside '+cb_end);
        cb(this);
      }).bind(this);

      this.foo0(this.cb0);
    };
  },
  parallel:function(){
    this.callback = (function(){
      //zs4.debug('parallel callback '+this.count);
      this.count--;
      if (this.count==0){
        //zs4.debug('all parallels ('+this.arr.length+') complete');
        this.cb();
      }
    }).bind(this);
    this.arr = [];
    this.count = 0;
    this.call = function(THIS,foo,arg){
      this.arr.push({t:THIS,f:foo,a:arg});
      this.count++;
    };
    this.run = function(cb){
      //zs4.debug('running parallel');
      if (this.count==0){
        cb();
      }
      else{
        var limit = this.count;
        this.cb = cb;
        for (var i = 0 ; i < limit ; i++){
          this.arr[i].f.call(this.arr[i].t,this.arr[i].a,this.callback);
        }
      }
    }
  },
}

zs4.sequence = function(){
  var SEQ = this;
  SEQ.eventype = new Object({
    text:function(){
      var TEXT = this;
      TEXT.string = new String();
      TEXT.load = function(input){
        if (zs4.is.string(input))TEXT.string = input;
        else TEXT.string = '';
      }
      TEXT.save = function(){
        if (TEXT.string=='')return null;
        else return TEXT.string;
      }
    }
  });
  SEQ.util = new Object();
  SEQ.data = new Object({head:{},event:[]});

  SEQ.util.bits = 0;
  SEQ.util.bit = new zs4.util.bits(SEQ.util,'bits');
  SEQ.util.bit.addBit('running',0);
  SEQ.util.bit.addBit('paused',0);
  SEQ.util.position = 0;

  SEQ.compile = function(){
    for (var i = 0 ; i < SEQ.data.event.length; i++){
      var e = SEQ.data.event[i];
      e.sequence = i;
    }
  }

  SEQ.load = function(input){
    if (!zs4.is.object(input))return;

    if (zs4.is.object(input.head)){

    }
    if (zs4.is.array(input.event)){
      for (var i = 0 ; i < input.event.length; i++){
        var e = new SEQ.event();
        e.load(input.event[i]);
      }
    }
    SEQ.compile();
    return SEQ;
  }
  SEQ.save = function(){
      var ret = new Object({head:{},event:[]});

      for (var i = 0 ; i < SEQ.data.event.length; i++){
        ret.event.push(SEQ.data.event[i].save());
      }

      return ret;
  }

  SEQ.event = function(){
    var EVENT = this;
    EVENT.bits = 0;
    EVENT.bit = new zs4.util.bits(EVENT,'bits');
    EVENT.bit.addBit('bar',0);
    EVENT.bit.addBit('beat',1);
    EVENT.bit.addBit('tick',2);

    EVENT.payload = new Object();

    EVENT.sequence = 0;
    EVENT.time = 0;
    if (SEQ.util.position==SEQ.data.event.length){
      SEQ.data.event.push(this);
      SEQ.util.position++;
    }
    else {
      SEQ.data.event.splice(SEQ.util.position++,0,this);
    }

    EVENT.load = (function(input){
      EVENT.bits = input.bits;
      EVENT.sequence = input.sequence;
      if (input.hasOwnProperty('payload')){
        for (var n in input.payload){
          if (SEQ.eventype.hasOwnProperty(n)&&zs4.is.function(SEQ.eventype[n])){
            EVENT.payload[n] = new SEQ.eventype[n]();
            EVENT.payload[n].load(input.payload[n]);
          }
        }
      }
      return EVENT;
    }).bind(EVENT);

    EVENT.save = (function(input){
      var ret = new Object();
      ret.bits = EVENT.bits;
      ret.sequence = EVENT.sequence;
      if (EVENT.hasOwnProperty('payload')){
        for (var n in EVENT.payload){
          if (!ret.hasOwnProperty('payload'))ret.payload=new Object();
          ret.payload[n] = EVENT.payload[n].save();
        }
      }
      return ret;
    }).bind(EVENT);
  };

};

zs4.location = {
  get:function(){
    var ret = zs4.THIS;

    if (!zs4.is.string(zs4.location.path)||zs4.location.path.length==0) return ret;
    var a = zs4.string.split.separators(zs4.location.path,'.');
    if (a.length == 0)return ret;

    for (var i = 0 ; i < a.length ;i++){
      if (!ret.hasOwnProperty(a[i])||!zs4.is.type(ret[a[i]]))break;
      ret = ret[a[i]];
    }

    if (zs4.is.type(ret._.scope))return ret._.scope;
    return ret;
  }
}
// Create base64 Object
zs4.base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=zs4.base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=zs4.base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"\n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}

zs4.util = {
  flags:function(){
    this.value = 0;
    this.set = new Object();
    this.get = new Object();
    this.nodeflags = 0x0ffffffffffff;

    this.addFlag = function(flagname,value){
      this[flagname] = value;

      this.set[flagname] = (function(tof){
        if (tof==true)this.value |= this[flagname];
        else if (tof==false)this.value &= (~(this[flagname]));
        return this.value;
      }).bind(this);
      this.get[flagname] = (function(){
        if ((this.value & this[flagname])==this[flagname])return true; return false;
      }).bind(this);

    }

    this.addFlag('trim',0x0001);
    this.addFlag('nosort',0x0002);
    this.addFlag('notrans',0x0004);
    this.addFlag('scope',0x0008);

    this.addFlag('noset',0x0010);
    this.addFlag('api',0x0020);
    this.addFlag('required',0x0040);
    this.addFlag('nostore',0x0080);

    this.addFlag('noget',0x0100);
    this.addFlag('am',0x0200);
    this.addFlag('own',0x0400);
    this.addFlag('noprune',0x0800);

    this.addFlag('nodisplay',0x1000);
    this.addFlag('index',0x2000);
    this.addFlag('unique',0x4000);
    this.addFlag('authgetpublic',0x8000);

    this.addFlag('authget',0x10000);
    this.addFlag('authset',0x20000);
    this.addFlag('authgetauth',0x40000);
    this.addFlag('authsetauth',0x80000);

    this.addFlag('authsetself',0x100000);
    this.addFlag('authsetpublic',0x200000);
    this.addFlag('deletable',0x400000);
    this.addFlag('textsearch',0x800000);

    this.addFlag('local',0x1000000);
    this.addFlag('authroot',0x2000000);
    this.addFlag('quickupdate',0x4000000);
    this.addFlag('prune',0x8000000);

    this.addFlag('authgetuser',0x10000000);
    this.addFlag('authsetuser',0x20000000);
    this.addFlag('nogetall',0x40000000);
    this.addFlag('priced',0x80000000);

    //this.addFlag('scopestats',0x100000000);
    //this.addFlag('priced',0x200000000);

    //combo flags
    this.addFlag('authuser',this.authgetuser|this.authsetuser);
    this.addFlag('apiarg',this.authgetpublic|this.authsetpublic);

    this.getString = function(mask){
      var int = mask;
      if (!zs4.is.number(int))int=this.value;
      var ret = '';
      function addFlag(s){
        if (ret.length == 0) ret = s; else ret += (' '+s);
      }
      if (int & this.trim) addFlag('trim');
      if (int & this.nosort) addFlag('nosort');
      if (int & this.notrans) addFlag('notrans');
      if (int & this.scope) addFlag('scope');

      if (int & this.noset) addFlag('noset');
      if (int & this.api) addFlag('api');
      if (int & this.required) addFlag('required');
      if (int & this.nostore) addFlag('nostore');

      if (int & this.noget) addFlag('noget');
      if (int & this.am) addFlag('am');
      if (int & this.own) addFlag('own');
      if (int & this.noprune) addFlag('noprune');

      if (int & this.nodisplay) addFlag('nodisplay');
      if (int & this.index) addFlag('index');
      if (int & this.unique) addFlag('unique');
      if (int & this.authgetpublic) addFlag('authgetpublic');

      if (int & this.authget) addFlag('authget');
      if (int & this.authset) addFlag('authset');
      if (int & this.authgetauth) addFlag('authgetauth');
      if (int & this.authsetauth) addFlag('authsetauth');

      if (int & this.authsetself) addFlag('authsetself');
      if (int & this.authsetpublic) addFlag('authsetpublic');
      if (int & this.deletable) addFlag('deletable');
      if (int & this.textsearch) addFlag('textsearch');

      if (int & this.local) addFlag('local');
      if (int & this.authroot) addFlag('authroot');
      if (int & this.quickupdate) addFlag('quickupdate');
      if (int & this.prune) addFlag('prune');

      if (int & this.authgetuser) addFlag('authgetuser');
      if (int & this.authsetuser) addFlag('authsetuser');
      if (int & this.nogetall) addFlag('nogetall');
      if (int & this.priced) addFlag('priced');

      //if (int & this.scopestats) addFlag('scopestats');
      //if (int & this.priced) addFlag('priced');


      return ret;
    };

    this.setString = function(s){
      //zs4.debug(this.value);
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        //zs4.debug(a[i]+': ');
        if (zs4.is.function(this.set[a[i]])){
          //zs4.debug('  ...is a function');
          this.set[a[i]](true);
        }
      }
      return this.value;
    };

  },
  bits:function(po,name){
    const BITLIMIT = 32;
    const BITMASK = 0x0ffffffff;

    var THIS = this;
    THIS._ = new Object({po:po,n:name});

    this.addBit = (function(n,v){
      if (!zs4.is.name(n) || v < 0 || v >= BITLIMIT)return null;
      this[n] = new Object({v:v,m:(1<<v),});
      this[n].true = (function(){THIS._.po[THIS._.n] |= (this[n].m);}).bind(this);
      this[n].false = (function(){THIS._.po[THIS._.n] &= (~(this[n].m));}).bind(this);
      this[n].get = (function(){if(THIS._.po[THIS._.n] & this[n].m)return true;return false;}).bind(this);
      return this[n];
    }).bind(this);

    this.getString = (function(v){
      var ret = ''
      if (v == null)v = THIS._.po[THIS._.n];
      for (var n in this)if(zs4.is.object(this[n])&&zs4.is.number(this[n].m)){
        if (v & this[n].m){
          if (ret == '')ret += n;
          else ret += (' '+n);
        }
      }
      return ret;
    }).bind(this);

    this.setString = (function(s){
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        //zs4.debug(a[i]+': ');
        if (zs4.is.object(this[a[i]])&&zs4.is.number(this[a[i]].m)){
          //zs4.debug('  ...is a function');
          this[a[i]].true();
        }
      }
      return THIS._.po[THIS._.n];

    }).bind(this);
    return this;
  },
  select:function(){
    this.sc = 'all';
    this.itemConstant = function(){

    };

  },
};

zs4.scope = {
  /*
  doctype:function(){
    var APP = this;
    zs4.type.scope.call(APP);
    APP._.create = zs4.scope.doctype;
    APP.zs4.head.typename._.value = 'doctype';
    APP.zs4.head.typename._.default = 'doctype';
    APP._.name = 'doctype';

    APP._.property(new zs4.type.object({name:'document',flags:'apiarg',}));
    APP.document._.property(new zs4.type.object({name:'new',flags:'api',}));
    APP.document._.property(new zs4.type.object({name:'list',flags:'api apiarg',}));
  },
  document:function(){
    var DOCUMENT = this;
    zs4.type.scope.call(DOCUMENT);
    DOCUMENT._.create = zs4.scope.document;
    DOCUMENT.zs4.head.typename._.value = 'document';
    DOCUMENT.zs4.head.typename._.default = 'document';
    DOCUMENT._.name = 'document';

  },
  */
};

zs4.folder = new Object();
zs4.array = new Object();

zs4.type = {

  unknown:function(input){
    if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
      return new zs4.error({text:'bad input',data:input});
    }

    this._ = new Object();
    this._.path = '';
    this._.name = input.name;
    this._.price = new Array();

    //if (input.value != null)this._.value=input.value;

    this._.flags = new zs4.util.flags();
    if (zs4.is.string(input.flags))this._.flags.setString(input.flags);

    if (zs4.is.type(input.inscope)&&input.inscope._.flags.get.scope())this._.inscope = input.inscope;

    if (zs4.is.array(input.authGet)){
      this._.authGet = input.authGet;
    }
    else {
      this._.authGet = new Array();
    }
    if (zs4.is.array(input.authSet)){
      this._.authSet = input.authSet;
    }
    else {
      this._.authSet = new Array();
    }
    if (zs4.is.array(input.authGetAuth)){
      this._.authGetAuth = input.authGetAuth;
    }
    else {
      this._.authGetAuth = new Array();
    }
    if (zs4.is.array(input.authSetAuth)){
      this._.authSetAuth = input.authSetAuth;
    }
    else {
      this._.authSetAuth = new Array();
    }

    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else {
      this._.enum = new Array();
    }

    if (zs4.is.array(input.addTypes)){
      this._.addTypes = input.addTypes;
    }
    else {
      this._.addTypes = new Array();
    }
    this._.addId = 0;

    if (zs4.is.window()){
      this._.cbarr = new Array();
    }

    this._.onchange_call = (function(){
      if (!zs4.is.array(this._.onchange_arr))return;
      for (var i = 0; i < this._.onchange_arr.length; i++){
        this._.onchange_arr[i](this);
      }
    }).bind(this);
    this._.onchange = (function(f){
      if (!zs4.is.array(this._.onchange_arr))this._.onchange_arr = new Array();
      this._.onchange_arr.push(f);
    }).bind(this);

    this._.localRefresh = (function(){
      for (var n in this)if (zs4.is.type(this[n])){
        this[n]._.localRefresh();
      }
      if (zs4.is.function(this._.onLocalChange)){
        this._.onLocalChange();
      }
    }).bind(this);
    //if (zs4.is.number(input.min))this._.min = input.min;
    //if (zs4.is.number(input.max))this._.max = input.max;
    //if (zs4.is.number(input.minlength))this._.minlength = input.minlength;
    //if (zs4.is.number(input.maxlength))this._.maxlength = input.maxlength;
    this._.parseInt = (function(v){
      var n = parseInt(v);
      if (n==NaN){
        if (zs4.is.number(this._.default))n = this._.default;
        else n = 0;
      }
      return n;
    }).bind(this);
    this._.parseFloat = (function(v){
      var n = parseFloat(v);
      if (n==NaN){
        if (zs4.is.number(this._.default))n = this._.default;
        else n = 0;
      }
      return n;
    }).bind(this);

    this._.zs4checkfail = (function(req,text){
      if (req != null)req.error(this,text);
      zs4.debug('ZS4 CHECK FAIL!!!: '+ this._.path+' error:'+text);
      return false;
    }).bind(this);
    this._.zs4checkinit = (function(req,input){
      if (this._.flags.get.notrans()){
        return this._.zs4checkfail(req,'notrans');
      }
      if (this._.flags.get.required()&&input==null){
        return this._.zs4checkfail(req,'required');
      }
      return true;
    }).bind(this);

    this._.zs4check = (function(req,input){return this._.zs4checkinit(req,input);}).bind(this);

    this._.console = new Object({switch:false,})

    this._.wrapRequest = (function(r){
      var patharr = zs4.string.split.separators(this._.path,'.');
      if (patharr.length>0)for (var i = 0 ; i < patharr.length ; i++){
        var n = patharr[patharr.length-1-i];
        var w = new Object();
        w[n] = r;
        r = w;
      }
      return r;
    }).bind(this);

    this._.store = (function(){

      //zs4.debug(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //zs4.debug(this._.path+'.NO_store()');
        return null;
      }
      //zs4.debug(this._.path+'.actually_store()');

      //zs4.debug(this._.path+'value_store('+this._.typename +')');
      return this._.value;
    }).bind(this);

    this._.elementConnect = (function(p,e){
      if (p==null)e._.path = e._.name;
      else e._.path = p._.path +'.'+e._.name;
      if (e._.type == Object){
          for (var n in e){
            if (!zs4.is.type(e[n]))continue;
            this._.elementConnect(e,e[n]);
          }
      }
      return e;
    }).bind(this);

    this._.loadAuth = (function(input){
      if (zs4.is.object(input)&&zs4.is.object(input._))
      if (zs4.is.object(input)){
        if (zs4.is.array(input._.get)){
          zs4.string.array.addToArray(input._.get,this._.authGet);
        }
        if (zs4.is.array(input._.set)){
          zs4.string.array.addToArray(input._.set,this._.authSet);
        }
        if (zs4.is.array(input._.getAuth)){
          zs4.string.array.addToArray(input._.getAuth,this._.authGetAuth);
        }
        if (zs4.is.array(input._.setAuth)){
          zs4.string.array.addToArray(input._.setAuth,this._.authSetAuth);
        }
        for(var n in this)if(zs4.is.type(this[n])&&zs4.is.object(input[n])){
          this[n]._.loadAuth(input[n]);
        }
      }
    }).bind(this);
    this._.saveAuth = (function(){
      var ret = new Object({_:{}});
      var count = 0;
      if (this._.authGet.length>0){
        ret._.get = new Array();
        zs4.string.array.addToArray(this._.authGet,ret._.get);
        count++;
      }
      if (this._.authSet.length>0){
        ret._.set = new Array();
        zs4.string.array.addToArray(this._.authSet,ret._.set);
        count++;
      }
      if (this._.authGetAuth.length>0){
        ret._.getAuth = new Array();
        zs4.string.array.addToArray(this._.authGetAuth,ret._.getAuth);
        count++;
      }
      if (this._.authSetAuth.length>0){
        ret._.setAuth = new Array();
        zs4.string.array.addToArray(this._.authSetAuth,ret._.setAuth);
        count++;
      }
      for (var n in this)if(zs4.is.type(this[n])){
        var r = this[n]._.saveAuth();
        if (zs4.is.object(r)){
          ret[n] = r;
          count++;
        }
      }
      if (count > 0)return ret;
      return null;
    }).bind(this);

    this._.new = (function(){
      if (zs4.is.function(this._.create)){
        //zs4.debug('FROM CONSTRUCTIST!!!!');
        var r = new this._.create(this._);
        return r;
      }
      var ret = new zs4.type[this._.typename](this._);
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        var prop = this[n]._.new(this);
        if (prop != null) ret._.property(prop);
      }
      return ret;
    }).bind(this);

    this._.clone = (function(parent){
      var ret = this._.new();
      if (this._.type == Object){
        ret._.load(this._.store());
      }
      return ret;
    }).bind(this);

    this._.zs4Parent = (function(){
      var arr = zs4.string.split.separators(this._.path,'.');
      var result = zs4.THIS;
      var scan = zs4.THIS;
      for (var i = 0; i < arr.length ; i++){
        if (!scan.hasOwnProperty(arr[i])
        ||!zs4.is.type(scan[arr[i]]))
        return result;
        scan = scan[arr[i]];

        if (
            scan.hasOwnProperty('zs4')
          && zs4.is.type(scan.zs4)
          && scan.zs4._.type == Object
        )result = scan;
      }
      return result;
    }).bind(this);
    this._.shouldBeSaved = (function(req){
      //zs4.debug('this.shouldBeSaved()');
      if (this._.flags.get.nostore()||req.noneedsaving==true)return;
      this._.print('this.shouldBeSaved('+this._.path+')',req);
      req.request.needsSaving = true;
      this._.scope.zs4.head.updated._.value = Date.now();
      if (this._.scope._.path != '')this._.scope._.getTree(req);
    }).bind(this);

    this._.getInitialize = (function(req){

      if (this._.flags.get.noget())return null;
      this._.print('getInitialize() req.flags=\''+req.flags.getString()+'\'',req)

      //if (!req.flags.get.authgetpublic()&&!req.flags.get.authsetself()&&!req.flags.get.authget())return null;
      if (!req.flags.get.authget())return null;

      var get = req.get(this);
      get._.name = this._.name;
      get._.typename = this._.typename;
      zs4.copy.schemabasics(this,get);

      if (this._.typename=='enum'&&zs4.is.array(this._.enum)&&this._.enum.length>0)get._.enum = this._.enum;

      if (zs4.is.type(this._.inscope)&&this._.inscope._.flags.get.scope()){
        get._.inscope = this._.inscope._.path;
      }

      if (this._.flags.get.noprune())req.flags.set.prune(false);
      if (this._.price.length>0)req.flags.set.priced(true);
      else req.flags.set.priced(false);

      get._.flags = req.flags.value;

      if (this._.flags.get.api())get._.flags |= req.flags.api;
      if (this._.flags.get.scope())get._.flags |= req.flags.scope;
      if (this._.flags.get.noset())get._.flags |= req.flags.noset;
      if (this._.flags.get.index())get._.flags |= req.flags.index;
      if (this._.flags.get.unique())get._.flags |= req.flags.unique;
      if (this._.flags.get.notrans())get._.flags |= req.flags.notrans;
      if (this._.flags.get.authgetpublic())get._.flags |= req.flags.authgetpublic;
      if (this._.flags.get.authsetpublic())get._.flags |= req.flags.authsetpublic;
      if (this._.flags.get.authsetself())get._.flags |= req.flags.authsetself;
      if (this._.flags.get.local())get._.flags |= req.flags.local;
      if (this._.flags.get.required())get._.flags |= req.flags.required;
      if (this._.flags.get.authroot())get._.flags |= req.flags.authroot;
      if (this._.flags.get.quickupdate())get._.flags |= req.flags.quickupdate;
      if (this._.flags.get.nosort())get._.flags |= req.flags.nosort;
      if (this._.flags.get.textsearch())get._.flags |= req.flags.textsearch;
      if (this._.flags.get.priced())get._.flags |= req.flags.priced;

      if (!req.flags.get.authset()
      ||  this._.flags.get.noset()
      ){
        get._.flags |= req.flags.noset;
        get._.flags &= (~(req.flags.api));
      }

      if (this._.price.length>0){
        get._.flags |= req.flags.priced;
        zs4.debug('PRICED: '+this._.flags.getString(get._.flags));
      }
      else {
        get._.flags &= (~(req.flags.priced));
      }

      this._.print('getinit: \''+req.flags.getString(get._.flags)+'\'',req);

      if (this._.path == 'zs4.email.message'){
        zs4.debug('zs4.email.message._.price.length='+this._.price.length);
        zs4.debug('PRICES!!:' + this._.flags.getString());
        //zs4.debug('get PRICED: '+'\''+get._.flags.getString(get._.flags)+'\'')
      }

      return get;

    }).bind(this);
    this._.getValue = (function(){ return this._.value;}).bind(this);
    this._.get = (function(req,po){
      var get = this._.getInitialize(req);
      if (get == null) return null;
      if (this._.type != Object){
        get._.value = this._.getValue();

      }
      req.stat(this,{read:1,},0);
      return get;
    }).bind(this);
    this._.getTree = (function(req){
      req.setScope(this);
      var get = this._.get(req);
      if (get == null) return null;

      for (var n in this)if (zs4.is.type(this[n])){
        this[n]._.getTree(req);
      }

      return get;
    }).bind(this);

    this._.got = (function(req,o){
      //zs4.debug(this);
      if (!zs4.is.type(o))return;

      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        zs4.debug('this._.name:'+this._.name+',o._.name: '+o._.name);
        zs4.debug('this._.typename:'+this._.typename+',o._.typename: '+o._.typename);
        zs4.debug('missmatching type or name');
      }

      this._.name = o._.name;
      this._.typename = o._.typename;

      if (zs4.is.array(o._.enum))this._.enum = o._.enum;

      zs4.copy.schemabasics(o,this);
      this._.flags.value = o._.flags;// & (~(this._.flags.nodisplay));

      if (zs4.is.string(o._.inscope)){// &&this._.inscope._.flags.get.scope()){
        var is = this._.scope._.resolvePath(o._.inscope);
        if (is != null  && is._.flags.get.scope()) {
          this._.inscope = is;
          this._.print('got inscope: \''+o._.inscope+'\'');
          //zs4.debug('got inscope: \''+o._.inscope+'\'');
        }
      }
      if (this._.flags.get.nosort())this._.sortDefault = this._.sortNot;
      this._.print('got: \''+this._.flags.getString(o._.flags)+'\'');

      if (this._.type==Object){

        for (var n in o){
          if (!zs4.is.type(o[n]))continue;

          if (!this.hasOwnProperty(n)||!zs4.is.type(this[n])){
            var nu =new zs4.type[o[n]._.typename](o[n]._);
            nu._.name = o[n]._.name;
            nu._.typename = o[n]._.typename;
            this._.property(nu);
          }

          this[n]._.got(req,o[n]);//,this);
        }

        if (this._.flags.get.prune()&&!this._.flags.get.local()){
          //zs4.debug('pruning '+this._.path);

          for (var n in this){
            if (!zs4.is.type(this[n]))continue;

            //this[n]._.flags.set.nodisplay(false);

            if (zs4.is.type(o[n]))continue;

            if (!this[n]._.flags.get.noprune()){
              //zs4.debug('pruning '+this[n]._.path);
              if (zs4.is.function(this[n]._.cleanup))this[n]._.cleanup();
              this._.value[n]==null;
              this[n]==null;
            }
            else if (!this[n]._.flags.get.local()){
              this[n]._.print('got noprune: \''+this._.flags.getString(o._.flags)+'\'');
              this[n]._.flags.set.nodisplay(true);
            }
          }
        }
        //this._.flags.set.prune(false);
      }
      else {
        this._.value = o._.value;

        this._.onchange_call();
      }

    }).bind(this);

    this._.dcb = (function(req,input){
      this._.cberror = null;
      this._.cbresult = null;

      if (zs4.is.object(input)){
        this._.print('got callback: '+JSON.stringify(input));
        if (zs4.is.object(input)&&zs4.is.object(input._)){
          for (var n in input._){
            //this._.print('callbacking '+JSON.stringify(input._));
            if (n=='auth'){
              if (input._.auth.type == 'getauth' && zs4.is.array(input._.auth.arr)){
                this._.authGet = input._.auth.arr;
              }
              else if (input._.auth.type == 'setauth' && zs4.is.array(input._.auth.arr)){
                this._.authSet = input._.auth.arr;
              }
              else if (input._.auth.type == 'authgetauth' && zs4.is.array(input._.auth.arr)){
                this._.authGetAuth = input._.auth.arr;
              }
              else if (input._.auth.type == 'authsetauth' && zs4.is.array(input._.auth.arr)){
                this._.authSetAuth = input._.auth.arr;
              }
            }
            else if (n=='console'){
              this._.console.switch = input._.console.switch;
              if (zs4.is.array(input._.console.output)){
                for (var i = 0 ; i < input._.console.output.length ; i++){
                  zs4.zs4.debug(input._.console.output[i]);
                }
              }
            }
          }

        }
        if (zs4.is.object(input.error)){
          this._.print('got error: '+JSON.stringify(input.error));
          this._.cberror = input.error;
        }
        if (input.result != null){
          this._.print('got result: '+JSON.stringify(input.result));
          this._.cbresult = input.result;
        }
      }

      if (this._.flags.value & this._.flags.notrans)return;

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (zs4.is.object(input)&&zs4.is.object(input[n])) this[n]._.dcb(req,input[n]);
        else this[n]._.dcb(req,null);
      }

      if (zs4.is.object(input)){
        if (zs4.is.function(this._.callback)){
          this._.callback(input);
        }
        else if (zs4.is.object(input.result)){
          if (zs4.is.string(input.result.goscope)){
            //zs4.debug('NAV: '+input.result.goscope);
            zs4.navigate(input.result.goscope);
          }
        }
      }
    }).bind(this);

    this._.print = (function(m,req){

        if (!zs4.string.array.is.element(zs4.console.arr,this._.path))return;
        var r = new String();

        if (zs4.is.window())r = 'window.zs4.THIS';
        else  r = 'node.zs4.THIS';
        if (this!=zs4.THIS) r += ('.'+this._.path);
        r += ': ';

        r += ('flags: \''+this._.flags.getString()+'\'\n')

        r += m;
        r += '\n';
        zs4.zs4.debug(r);

        if (zs4.is.node()&&req != null){

          //zs4.debug('pushing ')
          var res = req.internalResultPath(this);
          if (res == null)return;
          if (!zs4.is.object(res.console))res.console = new Object();
          if (!zs4.is.array(res.console.output))res.console.output = new Array();
          res.console.output.push(r);
        }

      ;}).bind(this);

    this._.transformInternal = (function(req,input){
      if (!zs4.is.object(req.input)||!zs4.is.object(req.input._))return;
      var am = req.flags.get.am();
      var own = req.flags.get.own();
      var root = req.flags.get.authroot();
      for (var n in req.input._){
        if (n=='auth'){
          var res = req.internalResultPath(this);

          //zs4.debug(req.input._[n]);
          if (req.input._.auth.type == 'getauth'){
            if (am||own){
              if (zs4.is.string(req.input._.auth.add)&&req.input._.auth.add.length>0){
                //zs4.debug('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authGet,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //zs4.debug('removing auth '+req.input._.auth.remove);
                zs4.string.array.remove.string(this._.authGet,req.input._.auth.remove);
                this._.shouldBeSaved(req);
              }
              var ret = new Array();
              for (var i = 0 ; i < this._.authGet.length ; i++)ret.push(this._.authGet[i])
              res.auth = {type:req.input._.auth.type,arr:ret,};
            }
            else {
              req.error(this,'owner or self only');
            }
          }
          else if (req.input._.auth.type == 'setauth'){
            if (own || req.flags.get.authsetauth()){
              if (zs4.is.string(req.input._.auth.add)&&req.input._.auth.add.length>0){
                //zs4.debug('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authSet,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //zs4.debug('removing auth '+req.input._.auth.remove);
                zs4.string.array.remove.string(this._.authSet,req.input._.auth.remove);
                this._.shouldBeSaved(req);
              }
              var ret = new Array();
              for (var i = 0 ; i < this._.authSet.length ; i++)ret.push(this._.authSet[i])
              res.auth = {type:req.input._.auth.type,arr:ret,};
            }
            else {
              req.error(this,'owner only');
            }
          }
          else if (req.input._.auth.type == 'authgetauth'){
            if (am||own){
              if (zs4.is.string(req.input._.auth.add)&&req.input._.auth.add.length>0){
                //zs4.debug('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authGetAuth,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //zs4.debug('removing auth '+req.input._.auth.remove);
                zs4.string.array.remove.string(this._.authGetAuth,req.input._.auth.remove);
                this._.shouldBeSaved(req);
              }
              var ret = new Array();
              for (var i = 0 ; i < this._.authGetAuth.length ; i++)ret.push(this._.authGetAuth[i])
              res.auth = {type:req.input._.auth.type,arr:ret,};
            }
            else {
              req.error(this,'owner or self only');
            }
          }
          else if (req.input._.auth.type == 'authsetauth'){
            if (own){
              if (zs4.is.string(req.input._.auth.add)&&req.input._.auth.add.length>0){
                //zs4.debug('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authSetAuth,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //zs4.debug('removing auth '+req.input._.auth.remove);
                zs4.string.array.remove.string(this._.authSetAuth,req.input._.auth.remove);
                this._.shouldBeSaved(req);
              }
              var ret = new Array();
              for (var i = 0 ; i < this._.authSetAuth.length ; i++)ret.push(this._.authSetAuth[i])
              res.auth = {type:req.input._.auth.type,arr:ret,};
            }
            else {
              req.error(this,'owner only');
            }
          }
        }
        else if (n=='console'){
          if (root){
            zs4.debug('console: '+JSON.stringify(req.input._) + '  req.input._.console.switch:'+req.input._.console.switch);
            if (zs4.is.boolean(req.input._.console.switch)){
              if (req.input._.console.switch == true){
                zs4.string.array.add.new(zs4.console.arr,this._.path)
                this._.shouldBeSaved(req);
                this._.print('turned ON console');
              }
              else if (req.input._.console.switch == false){
                zs4.string.array.remove.string(zs4.console.arr,this._.path)
                this._.shouldBeSaved(req);
                this._.print('turned OFF console');
              }
            }

            var res = req.internalResultPath(this);
            if (res == null)return;
            if (!zs4.is.object(res.console))res.console = new Object();
            if (!zs4.is.object(res.console.switch))res.console.switch = new Object();

            if (zs4.string.array.is.element(zs4.console.arr,this._.path))
              res.console.switch = true;
            else
              res.console.switch = false;

            //zs4.debug('transformInternal() returns '+JSON.stringify(res.result._));
            this._.print('transformInternal() returns '+JSON.stringify(res));
          }
          else {
            req.error(this,'root only');
          }
        };
      }
    }).bind(this);

    this._.resolvePath = (function(path){
      var arr = zs4.string.split.separators(path,'./\\-_');
      if (arr.length == 0)return this;
      var ret = this;
      for (var i = 0 ; i < arr.length; i++){
        if (!zs4.is.type(ret[arr[i]]))return null;
        ret = ret[arr[i]];
      }
      return ret;
    }).bind(this);

    this._.flagTree = (function(flag,tof){
      if (tof)this._.flags.value |= flag;
      else this._.flags.value &= (~(flag));
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        this[n]._.flagTree(flag,tof);
      }
    }).bind(this);

    this._.inscopeTree = (function(is){
      this._.inscope = is;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        this[n]._.inscopeTree(is);
      }
    }).bind(this);

    this._.search = (function(s){

      if (this._.type==Object){
        for (var n in this)if (zs4.is.type(this[n])){
          var ret = this[n]._.search(s);
          if (ret==true)return true;
        }
        return false;
      }
      else if (this._.type==String){
        if (!this._.flags.get.textsearch())return false;
        if (s==null||s=='')return true;
        return zs4.string.search(this._.value,s);
        //var a = zs4.string.split.spaces(s);
        //if (a.length==0)return true;
        //for (var i = 0 ; i < a.length;i++){
        //  if (this._.value.toLowerCase().search(a[i].toLowerCase())>=0)return true;
        //}
        return false;
      }

      return false;
    }).bind(this);

    this._.transformValue = (function(req,cb){
      this._.print('transform('+req.input+')',req);
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}

      //zs4.debug(this._.path + '.transformValue() //'+ this._.flags.getString());
      //zs4.debug(req.flags.getString());
      //zs4.debug(req.flags.get.authset());
      //zs4.debug(this._.flags.getString());

      if (req.flags.get.authset()){
        if (!this._.zs4check(req,req.input)){
          this._.get(req,req.parent);cb();return;
        }
        //zs4.debug(this._.path+'._.transform(\''+req.input+'\')');
        if (zs4.is.object(this._.opcode)&&zs4.is.function(this._.opcode.convert)){
          var v = this._.opcode.convert(req.input);
          if (v!=null && v != this._.value){
            if (zs4.is.function(req.request.unique)
            &&!req.request.unique(this,v)){
              req.error(THIS,'already exists');
              this._.get(req,req.parent);cb();return;
            }
            this._.value=v;
            this._.shouldBeSaved(req);
            req.stat(this,{update:1,},0);
            req.result(this,v);
          }
        }
      }
      else{
        zs4.debug('returning error (not authorized)')
        req.error(this._.scope,'not authorized');
        this._.get(req,req.parent);cb();return;
      }

      this._.get(req,req.parent);
      cb();
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.transformValue(req,cb);
    }).bind(this);

    if (zs4.is.node()){
      this._.getScript = (function(req,cb){
        zs4.debug('default getScript() called');
        cb('');
      }).bind(this);
      this._.getStyle = (function(req,cb){
        zs4.debug('default getStyle() called');
        cb('');
      }).bind(this);
      this._.getZS4js = (function(req,cb){
        var SCOPE = this;
        var js = '';

        function script(str){
          js += '\n{\n';
          js += str;
          js += '\n}\n\n'
        };
        js += zs4.THIS.zs4.js._.js.bowser; js += '\n';
        js += zs4.THIS.zs4.js._.js.js; js += '\n';

        if (req.request.token&&req.request.payload){
          js += 'zs4.window.token=\''+req.request.token+'\'\n';
        }
        js += 'zs4.location.path = \"'+this._.path+'\"\n';
        js += 'zs4.style.sheet = '+zs4.THIS.zs4.css._.css.css+';\n';
        zs4.debug('calling getStyle('+SCOPE._.path+')');
        this._.getStyle(req,function(style){

          js += 'zs4.style.sheet += '+JSON.stringify(style)+';\n'

          js += 'zs4.style.refresh();\n\n';

          script(zs4.THIS.zs4.js._.js.um);
          script(zs4.THIS.zs4.js._.js.admin);
          script(zs4.THIS.zs4.js._.js.onwindow);

          zs4.debug('calling getScript('+SCOPE._.path+')');
          SCOPE._.getScript(req,function(Skript){

            script(Skript);

            req.request.html = js;
            cb();
          });

        });
      }).bind(this);
      this._.getHTML = (function(req){
        zs4.debug('getHTML('+this._.path+')');
        var title = this._.path;
        var description = '';
        var keywords = '';
        var lang = 'en';
        if (title=='')title = 'zs4 web app';
        if (this._.flags.get.scope()&&zs4.is.object(this.zs4.head)){
          //zs4.debug('gettin scope.head html...');
          // title
          if (this.zs4.head.title._.value!=''){
            title = zs4.string.strip.chars(this.zs4.head.title._.value,zs4.const.NOATTRCHARS);
          }
          if (this.zs4.head.lang._.value!='')lang = this.zs4.head.lang._.value;
          // description
          if (this.zs4.head.title._.description!=''){
            description = zs4.string.strip.chars(this.zs4.head.description._.value,zs4.const.NOATTRCHARS);
          }

          // keywords
          var arr = this._.getKeyWordArray();
          zs4.string.array.sort.length.descend(arr);
          var o = {k:''};
          for (var i = 0; i < arr.length;i++){zs4.string.addKeyWord(o,'k',arr[i]);}
          keywords = o.k;

        }
        var ampath = this._.path; if (ampath!='')ampath+='.';ampath+='amp';
        var html = '<!DOCTYPE html>\n';
        html += '<html lang="'+lang+'">\n';
          html += ' <head>\n';
            html += '<meta charset="UTF-8">\n';
            html += '  <title>'+title+'</title>\n';
            html += '  <link rel="amphtml" href="https://'+zs4.THIS.zs4.express.host._.value+'/'+ampath+'">\n';
            if (description != ''){
              html+= '  <meta name="description" content="'+description+'">\n';
            }
            if (keywords != ''){
              html+= '  <meta name="keywords" content="'+keywords+'">\n';
            }
            var js = this._.path; if (js!='')js+='.';
            html += '  <script src="/'+js+'zs4.js"></script>\n';
          html += ' </head>\n';
          if (true){
            //html += ' <body onload="zs4.admin()">\n';
            html += ' <body>\n';
            html += ' </body>\n';
          }
        html += '</html>\n';
        req.request.html = html;
        this._.print('HTML RESPONSE FROM '+this._.path,req);

        return(html);
      }).bind(this);
      this._.getAmpPlainTextDecorated= (function(req,plain,cb){
        return cb(zs4.string.escape.html(plain));
      }).bind(this);
      this._.getAmpStyle= (function(req,cb){
        return cb('');
      }).bind(this);
      this._.getAmpBody= (function(req,cb){
        var SCOPE = this;
        var query = new Object({
          path:'zs4.search',
          input:{
            value:'',
            type:'',
            owner:'',
          },
          wantreply:true,
        });

        var OWNER = '';
        if (this.zs4.head.typename._.value=='user'){
          query.input.owner = OWNER = this._.path;
        }
        zs4.debug('AMP query',query);
        req.call(query,function(r){
          var r = req.getReply().reply;
          //zs4.debug('AMP result',zs4.json.textify(r));

          var arr = new Array();

          for (var type in r.zs4.type){
            if (!zs4.is.type(r.zs4.type[type]))continue;

            zs4.debug('collecting '+type)
            for (var scope in r.zs4.type[type].array){
              if (!zs4.is.type(r.zs4.type[type].array[scope]))continue;
              zs4.debug('zs4.type.'+type+'.array.'+scope);
              r.zs4.type[type].array[scope]._.path = 'zs4.type.'+type+'.array.'+scope;
              arr.push(r.zs4.type[type].array[scope]);
            }
          }

          arr.sort(function(a,b){
            return b.zs4.head.updated._.value-a.zs4.head.updated._.value;
          });

          zs4.debug('collected '+arr.length+' items');
          for (var i = 0 ; i < arr.length; i++){
            zs4.debug(arr[i].zs4.head.title._.value);
          }

          zs4.debug(arr[0]);
          var html = '<h3>The Newest Items for '+SCOPE.zs4.head.title._.value+'</h3>\n';
          html += '<table>\n';
          for (var i = 0 ; i < arr.length; i++){
            html+='<tr>';

            html+='<td><amp-img src="/gfx/icons/'+arr[i].zs4.head.typename._.value+'.svg" alt="Welcome" height="1em" width="1em"></amp-img></td>\n';
            html+='<td><a href="/'+arr[i]._.path+'.amp">'+arr[i].zs4.head.title._.value+'</a></td>\n';

            html+='</tr>';
          }
          html += '</table>\n';

          return cb(html);
        });
      }).bind(this);
      this._.getAMP = (function(req,cb){
        zs4.debug('getAMP('+this._.path+')');
        var title = this._.path;
        var description = '';
        var keywords = '';
        var lang = 'en';
        const BODY_WIDTH = 800;
        var TABINDEX = 0;
        if (title=='')title = 'zs4 web app';

        if (this._.flags.get.scope()&&zs4.is.object(this.zs4.head)){
          var SCOPE = this;
          //zs4.debug('gettin scope.head html...');
          // title
          if (this.zs4.head.title._.value!=''){
            title = zs4.string.strip.chars(this.zs4.head.title._.value,zs4.const.NOATTRCHARS);
          }
          if (this.zs4.head.lang._.value!='')lang = this.zs4.head.lang._.value;

          // description
          if (this.zs4.head.title._.description!=''){
            description = zs4.string.strip.chars(this.zs4.head.description._.value,zs4.const.NOATTRCHARS);
          }

          // keywords
          var arr = this._.getKeyWordArray();
          zs4.string.array.sort.length.descend(arr);
          var o = {k:''};
          for (var i = 0; i < arr.length;i++){zs4.string.addKeyWord(o,'k',arr[i]);}
          keywords = o.k;

          var html = '<!DOCTYPE html>\n';
          html += '<html amp lang="'+lang+'">\n';

          html += ' <head>\n';

          html += '  <meta charset="UTF-8">\n';
          html += '  <script async src="https://cdn.ampproject.org/v0.js"></script>\n';
          html += '  <script async custom-element="amp-sidebar" src="https://cdn.ampproject.org/v0/amp-sidebar-0.1.js"></script>\n';
          html += '  <script async custom-element="amp-accordion" src="https://cdn.ampproject.org/v0/amp-accordion-0.1.js"></script>\n';
          html += '  <script async custom-element="amp-fit-text" src="https://cdn.ampproject.org/v0/amp-fit-text-0.1.js"></script>\n';
          html += '  <title>'+title+'</title>\n';
          html += '  <link rel="canonical" href="https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path+'">\n';
          html += '  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">\n';

          var dateCreated = new Date(this.zs4.head.created._.value);
          var datePublished = new Date(this.zs4.head.updated._.value);
          var author = this.zs4.head.author._.value;
          if (description=='')description = 'zs4 AMP page';

          if (author=='')author = 'zs4 User';
          var ld = new Object({
            '@context':'http://schema.org',
            '@type':'Webpage',
            url:'https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path,
            headline:title,
            datePublished:dateCreated.toJSON(),
            dateModified:datePublished.toJSON(),
            author:{
              '@type':'Person',
              name:author,
            },
            mainEntityOfPage:{
              '@type':'Webpage',
              '@id':'https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path,
            },
            publisher:{
              '@type':'Organization',
              name:'zs4 Project',
              logo:{
                '@type':'ImageObject',
                url:'https://'+zs4.THIS.zs4.express.host._.value+'/gfx/icons/zs4.svg',
                width:132,
                height:132,
              },
            },
            image:{
              '@type':'ImageObject',
              url:'https://'+zs4.THIS.zs4.express.host._.value+'/gfx/icons/zs4.svg',
              width:132,
              height:132,
            },
            description:description,
          });

          html += '  <script type="application/ld+json">\n';
          html += zs4.json.textify(ld);
          html += '  </script>\n';

          html += '  <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>\n';
          html += '  \n';

          html += '<style amp-custom>\n';
          html += 'h1{}';
          html += 'body{background-color:white;color:black;padding:0;border:0;margin:0px;background-image:url("/gfx/images/winterfooter.svg");background-repeat:no-repeat;background-position:bottom;background-attachment:fixed;background-size:100%;}';
          html += 'amp-sidebar{width:"'+(BODY_WIDTH*3/4)+'px";padding:0em;border:2px solid black;margin:0px;background-image:url("/gfx/images/winterpattern.jpg");} ';
          //html += 'amp-fit-text.sidebar{background-color:black;display:block;color:white;padding:0px;border:0px;margin:0px;}';
          html += 'div.sidebar{display:block;font-size:2em;color:black;padding:10px;border:0px;margin:0px;}';
          html += 'div.sidebarcontent{display:block;color:black;padding:10px;border:0px;margin:0px;}';
          html += 'amp-accordion section[expanded] .show-more {display:none}';
          html += 'amp-accordion section:not([expanded]) .show-less {display:none}';
          html += 'div.titlebar{background-color:darkblue;display:block;font-size:2em;color:white;padding:0px;border:0px;margin:0px;}';
          html += 'ul.docinfo{background-color:lightblue;}';
          html += 'div.scope{padding:2em;border:0px;margin:0px;} ';
          html += 'div.footer{margin-top:2em;}';
          html += 'a.footer{text-decoration:none;}';

          SCOPE._.getAmpStyle(req,function(style){
            html += style;
            html += '</style>\n';

            html += ' </head>\n';

            html += ' <body>\n';
            html += '  <amp-sidebar id="sidebar" layout="nodisplay" side="left">\n';
            html += '   <div class="sidebar"><amp-img tabindex='+(TABINDEX++)+' role="button" on="tap:sidebar.toggle" src="/gfx/icons/prev.svg" alt="Welcome" height="1em" width="1em"></amp-img>options</div>\n';
            html += '   <div class="sidebarcontent">\n';
            html += '   <h3>More from '+zs4.THIS.zs4.express.host._.value+'</h3>\n';
            html += '   <ul>\n';
            if (SCOPE._.path!='')html += '    <li><a href="/amp">Home</a></li>\n';
            else html += '    <li>Home (You are here now)</li>\n';
            html += '    <li><a href="/'+SCOPE._.path+'">Interactive Version of this Page</a></li>\n';
            html += '    \n';
            html += '    \n';
            html += '   </ul>\n';
            html += '   \n';
            html += '  </div>\n';
            html += '  </amp-sidebar>\n';
            html += '  <div class="titlebar"><amp-img tabindex='+(TABINDEX++)+' role="button" on="tap:sidebar.toggle" src="/gfx/icons/zs4.svg" alt="Welcome" height="1em" width="1em"></amp-img>'+title+'</div>\n';
            html += '  <amp-accordion><section>\n';
                        html += '<h4>';
                        html += '<span class="show-more"><amp-img src="/gfx/icons/info.svg" alt="image" height="1em" width="1em"></amp-img></span>';
                        html += '<span class="show-less"><amp-img src="/gfx/icons/prev.svg" alt="image" height="1em" width="1em"></amp-img></span>';
                        html += 'Document Information</h4>\n';
            html += '   <ul class="docinfo">\n';
            html += '    <li><b>Language:</b> '+SCOPE.zs4.head.lang._.value+'</li>\n';
            if (author!='')html += '    <li><b>Author:</b> '+author+'</li>\n';
            if (description!='')html += '    <li><b>Description:</b> '+description+'</li>\n';
            html += '    <li><b>Created:</b> '+zs4.string.from.date(SCOPE.zs4.head.created._.value)+'</li>\n';
            html += '    <li><b>Last Update:</b> '+zs4.string.from.date(SCOPE.zs4.head.updated._.value)+'</li>\n';
            html += '   \n';
            html += '   \n';
            html += '   \n';
            html += '   </ul>\n';
            html += '   \n';
            html += '  </section></amp-accordion>\n';

            html += '  <amp-accordion><section expanded>\n';
            html += '<h4>';
            html += '<span class="show-more"><amp-img src="/gfx/icons/toonsmith.svg" alt="image" height="1em" width="1em"></amp-img></span>';
            html += '<span class="show-less"><amp-img src="/gfx/icons/toonsmith.svg" alt="image" height="1em" width="1em"></amp-img></span>';
            html += 'Document Content</h4>\n';
            html += ' <div class="scope">\n';

            SCOPE._.getAmpBody(req,function(body){
              html += body;
              //html += '  <amp-img layout="responsive" src="/gfx/icons/zs4.svg" alt="Welcome" height="400" width="400"></amp-img>\n';
              html += ' </div>\n';
              html += '  </section></amp-accordion>\n';

              html += ' <div class="footer">\n';
              //html += '  <a  class="footer" href="/'+SCOPE._.path+'">See full zs4 version of this page</a>\n';
              html += ' </div>\n';

              html += ' </body>\n';
              html += '</html>\n';

              req.request.html = html;

              return cb();
            });
          });
        }

      }).bind(this);
      this._.call = (function(req,input,cb){
        req.call({path:this._.path,input:input},cb);
      }).bind(this);
    }
    if (zs4.is.window()){
      this._.call = (function(input,cb){
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,cb);
      }).bind(this);
    }
  },

  array:function(input){
    zs4.type.object.call(this,input);
    this._.typename = 'array';

    //if (zs4.is.window())return;

    if (!zs4.is.type(input.template))input.template = new zs4.type.scope({name:'template'});

    var THIS = this;

    THIS._.array = new Object();
    THIS._.array.elementConnect = this._.elementConnect;

    if (zs4.is.node()){
      THIS._.property(new zs4.type.object({name:'config',flags:'noprune',authSet:['zs4.owner'],}));
      THIS.config._.property(new zs4.type.integer({name:'maxlength',flags:'noprune quickupdate',authSet:['zs4.owner'],}));
      THIS.config._.property(new zs4.type.integer({name:'lastid',flags:'noset noprune',}));
      THIS.config._.property(new zs4.type.enum({name:'driver',flags:'noprune quickupdate',}));
      THIS.config.driver._.get = (function(req){
        var arr = new Array();
        arr.push('');
        for (var n in zs4.array){
          arr.push((' '+n+' ').trim());
        }
        this._.enum = arr;
        var get = this._.getInitialize(req);
        if (get == null) return null;
        if (this._.type != Object){
          get._.value = this._.value;
        }
        return get;

      }).bind(THIS.config.driver);
    }

    var template = input.template._.new();
    template._.name = 'template'
    THIS._.property(template);
    THIS.template._.flagTree((
      this._.flags.authgetpublic
      |this._.flags.notrans
      |this._.flags.noprune
      |this._.flags.nostore
      |this._.flags.local
    ),true);

    THIS._.property(new zs4.type.object({name:'array',flags:'noprune authgetpublic nogetall',}));
    THIS.array._.load = (function(input){
      //zs4.debug('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var id in input)if(zs4.is.object(input[id])){

        var nu = THIS.template._.new();
        nu._.name = id; nu._.flags.set.notrans(false);
        nu._.flags.set.scope(true);

        THIS.array._.property(nu);

        THIS.array[id]._.load(input[id]);

        //zs4.debug('load('+THIS.array[id]._.path+')')
      }
    }).bind(THIS.array);

    THIS.array._.sortArray = (function(a,b){
      var va = a._.resolvePath(THIS.method.query.sort.item._.value);
      var vb = b._.resolvePath(THIS.method.query.sort.item._.value);
      if (va == null){
        if (vb == null)return 0;
        return -1;
      }
      else if (vb == null){
        return 1;
      }

      if (THIS.method.query.sort.descend._.value==true){
        var swap = va; va = vb; vb = swap;
      }
      if (va._.opcode.eq(vb._.value))return 0;
      if (va._.opcode.lt(vb._.value))return -1;
      return 1;
    }).bind(this);

    THIS.array._.sortDefault = THIS.array._.sortArray;

    THIS.array._.elementLoad = (function(req,cb){
      //zs4.debug('elementLoad '+this._.path+'.'+req.elenam);

      if (THIS.array._.value.hasOwnProperty(req.elenam)){
        var ret = new Object();
        zs4.copy.trim(THIS.array._.value[req.elenam],ret);
        cb(ret);return;
      }
      cb(null);
    }).bind(THIS.array);
    THIS.array._.elementSave = (function(req,cb){
      //zs4.debug('elementSave '+this._.path+'.'+req.elenam);
      THIS.array._.value[req.elenam] = req.elesav;
      THIS.array._.shouldBeSaved(req);
      cb();
    }).bind(THIS.array);
    THIS.array._.driverTransform = (function(req,cb){
      var starttime = Date.now();

      zs4.debug(req.elenam);
      zs4.array[THIS.config.driver._.value].getID.call(THIS,req.elenam,function(ret){
        if (ret == null){
          req.error(THIS.array,req.elenam+' not found');cb();return;
        }

        var item = THIS.template._.new();
        item._.name = req.elenam;
        item._.load(ret);
        THIS._.array.elementConnect(THIS.array,item);

        item._.transform(req,function(){
          var now = Date.now();
          item.zs4.head.updated._.value = Date.now();

          zs4.array[THIS.config.driver._.value].updateID.call(
          THIS,req.elenam,item._.store(),
          function(ret){
            if (ret == null){
              req.error(THIS.array,req.elenam+' update fail');cb();return;
            }
            req.stat(this,{update:1,},(Date.now()-starttime));
            req.result(item,true);
            cb();
          });
        });
      });
    }).bind(THIS.array);

    THIS.array._.findOne = (function(path,value){
      var arr = THIS.array._.value;
      for (var n in arr){
        var prop = zs4.path.resolve(arr[n],path);
        if (prop == null || zs4.is.object(prop))continue;
        if (prop == value)return ((' '+n+' ').trim());
      }
      return null;
    }).bind(THIS.array);

    THIS.array._.unique = function(type,value){
      //zs4.debug('checking uniqueness of: '+type._.path+':'+value);
        if  (!type._.flags.get.unique()){
          //zs4.debug('not a unique property: '+type._.name);
          return true;
        }

        var spath = type._.scope._.path;
        var tpath = type._.path;
        var vpath = tpath.substring((spath.length+1),(tpath.length));
        //zs4.debug('checking uniqueness of: '+vpath);
        var arr = THIS.array._.value;
        for (var n in arr){
          var v = zs4.path.resolve(arr[n],vpath);
          if (v == null){
            //zs4.debug(n+'.'+vpath+' NOT FOUND!!!!!');
            continue;
          }
          if (v==value){
            //zs4.debug(n+'.'+vpath+' MATCH '+v+' and '+value);
            if (n!=type._.name)return false;

          }
        }
        return true;
    };

    THIS.array._.callback = (function(o){
      //zs4.debug('THIS.array._.callback()');
      //zs4.debug(o);
      if (zs4.is.object(o.result)){
        if (o.result.deleteall==true){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            zs4.debug('deleting '+THIS.array[n]._.path);

            if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
            delete THIS.array[n];
          }

        }
        if (zs4.is.array(o.result.deletearr)){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            if (!zs4.string.array.is.element(o.result.deletearr,n))continue;
            zs4.debug('deleting '+THIS.array[n]._.path);

            if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
            delete THIS.array[n];
          }

        }
        if (zs4.is.function(THIS._.refresh)){
          THIS._.refresh();
        }
      }
    }).bind(THIS.array);

    if (zs4.is.node()){

      THIS.array._.oldTransform = this.array._.transform;

      THIS.array._.transform = (function(req,cb){

        var TABLE = this;

        if (THIS.config.driver._.value == ''){
          THIS.array._.oldTransform(req,cb);
          return;
        }

        req.setScope(TABLE);
        TABLE._.transformInternal(req);

        if (!zs4.is.object(req.input)
        ||  zs4.count.object.properties(req.input)==0
        ){
          TABLE._.get(req); cb(); return;
        }

        var parallel = new zs4.processor.parallel();
        var input = req.input;
        for (var n in input){
          if (!zs4.is.object(input[n]))continue;

          var name = (' '+n+' ').trim();
          var request = req.create({input:input[name],});
          request.elenam = name;
          request.noneedsaving = true;

          parallel.call(TABLE,THIS.array._.driverTransform,request);
        }

        parallel.run(function(){

          TABLE._.get(req);
          cb();
        });

      }).bind(THIS.array);


      THIS._.property(new zs4.type.object({name:'method',flags:'noprune nostore authgetpublic',}));

      THIS.method._.property(new zs4.type.object({name:'new',flags:'api noprune nostore authuser authsetself',}));
      this.method.new._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = THIS.method.new;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(THIS.method.new,err);
          this._.print(err,req);
          this._.get(req); cb(); return;
        }
        if (!req.tokenExists()&&!req.userIsRoot()){
          var err = 'not logged in';
          req.error(THIS.method.new,err);
          this._.print(err,req);
          this._.get(req); cb(); return;
        }

        if (zs4.is.object(req.input)){
          if (THIS.config.driver._.value != ''){
            var nu = THIS.template._.new();
            nu._.load(req.input);
            nu._.flags.set.notrans(false);
            nu._.flags.set.scope(true);
            //nu.zs4.head.title._.value = '(untitled)';
            nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();
            if (!req.userIsRoot())nu.zs4.head.owner._.value = req.request.payload.scope;
            else nu.zs4.head.owner._.value = '';

            zs4.array[THIS.config.driver._.value].new.call(THIS,nu,function(ret){
              if (zs4.is.type(ret)){
                THIS._.array.elementConnect(THIS.array,ret);

                ret._.transform(REQUEST.create({input:{}}),function(){

                  REQUEST.result(NEW,ret._.path);
                  zs4.debug('DB CREATED ',ret._.path);

                  NEW._.get(REQUEST);

                  REQUEST.setScope(THIS.array);
                  THIS.array._.get(REQUEST);

                  cb(); return;
                });
              }
              else {
                NEW._.get(REQUEST);
                cb(); return;
              }
            });

            zs4.debug('END DB DRIVER NEW FUNCTION');
            return;
          }
          else {
            var length = zs4.count.object.properties(THIS.array._.value);
            if (THIS.config.maxlength._.value > 0 && length >= THIS.config.maxlength._.value){
              req.error(this,{text:'array limit reached'})
              this._.get(req); cb(); return;
            }

            var id = zs4.integer.to.name(THIS.config.lastid._.value++);
            var nu = THIS.template._.new();
            nu._.load(req.input);
            nu._.name = id; nu._.flags.set.notrans(false);
            nu._.flags.set.scope(true);
            nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();
            nu.zs4.head.owner._.value = req.request.payload.scope;
            //nu.zs4.email._.value = id+'@zs4.zs4';
            THIS.array._.property(nu);
            nu._.transform(REQUEST.create({input:{}}),function(){
              THIS._.shouldBeSaved(REQUEST);
              REQUEST.result(THIS.method.new,nu._.path);

              NEW._.get(REQUEST);
              REQUEST.setScope(THIS.array);
              THIS.array._.get(REQUEST);
              cb(); return;
            });

          }
        }
        else {
          this._.get(req); cb(); return;
        }
      }).bind(this.method.new);

      THIS.method._.property(new zs4.type.object({name:'query',flags:'api noprune nostore apiarg',}));
      THIS.method.query._.property(new zs4.type.string({name:'search',flags:'apiarg'}));
      THIS.method.query._.property(new zs4.type.select());
      THIS.method.query.select._.flags.value |= (THIS._.flags.nostore);
      THIS.method.query.select._.inscope = THIS.template;
      THIS.method.query._.property(new zs4.type.object({name:'sort',flags:'noprune nostore authgetpublic local nosort',}));
      THIS.method.query.sort._.property(new zs4.type.scopeindex({name:'item',flags:'required nostore noprune apiarg local',inscope:THIS.template,default:'zs4.head.updated'}));
      THIS.method.query.sort._.property(new zs4.type.boolean({name:'descend',flags:'required nostore noprune apiarg local',default:true,}));
      THIS.method.query._.flagTree((
        this._.flags.apiarg
        |this._.flags.nostore
      ),true);
      THIS.method.query._.transform = (function(req,cb){
        var QUERY = this;
        var REQUEST = req;
        req.setScope(QUERY);
        QUERY._.transformInternal(req);
        if (req.getall){
          QUERY._.get(req); cb(); return;
        }
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(THIS.method.query,err);
          QUERY._.print(err,req);
          QUERY._.get(req); cb(); return;
        }

        if (zs4.is.object(req.input)){
          //zs4.debug(QUERY._.path+'.transform()',req.input);

          if (zs4.count.object.properties(req.input)==0){
            //zs4.debug(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }

          var sel = null;
          if (zs4.is.object(REQUEST.input.select)){
            //zs4.debug('QUERY-SELECT: ',JSON.stringify(REQUEST.input.select,null,1));
            sel = new zs4.type.select();
            sel._.parse(REQUEST.input.select);
          }
          else {
            //zs4.debug(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }
          var search = null;
          if (zs4.is.string(REQUEST.input.search)&&REQUEST.input.search!=''){
            search = REQUEST.input.search;
          }

          //zs4.debug(QUERY._.path+'.transform()',REQUEST.input);

          if (THIS.config.driver._.value != ''){
            var args = new Object({request:req,select:sel,search:search,sort:REQUEST.input.sort,});
            zs4.array[THIS.config.driver._.value].query.call(THIS,args,function(ret){
              if (!zs4.is.array(ret)){

              }
              else {
                //zs4.debug(ret);
              }

              QUERY._.get(req);
              THIS.array._.get(req);
              cb();
            });

            return;
          }
          else {
            for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
              //zs4.debug(this._.path+'.'+n+'.query()');
              if (sel!= null){
                sel._.inscopeTree(THIS.array[n]);
                if (!sel._.select.check())continue;
              }

              if (search != null){
                if (!THIS.array[n]._.search(REQUEST.input.search))continue;
              }

              req.setScope(THIS.array[n]);
              THIS.array[n]._.getTree(req);
            }

            req.setScope(this);
            this._.get(req);
            req.setScope(THIS.array);
            THIS.array._.get(req);
            cb();
            return;
          }
        }

        req.setScope(this);
        this._.get(req);
        cb(); return;
      }).bind(THIS.method.query);
      THIS.method.query._.get = (function(req,cb){
        var QUERY = this;
        req.setScope(this);
        var get = this._.getInitialize(req);
        if (get == null)return null;
        this.search._.get(req);
        this.select._.get(req);
        this.sort._.get(req);
        this.sort.item._.get(req);
        this.sort.descend._.get(req);
      }).bind(THIS.method.query);

      THIS.method._.property(new zs4.type.object({name:'deleteall',flags:'api noprune nostore',}));
      THIS.method.deleteall._.property(new zs4.type.boolean({name:'sure',flags:'required nostore noprune',}));
      THIS.method.deleteall.sure._.zs4check = THIS.method.deleteall.sure._.zs4checkTrue;
      THIS.method.deleteall._.transform = (function(req,cb){
        var DELETEALL = this;
        req.setScope(this);
        this._.transformInternal(req);
        function get(){
          req.setScope(DELETEALL);
          DELETEALL._.get(req);

          req.setScope(DELETEALL.sure);
          DELETEALL.sure._.get(req,DELETEALL);

          var ga = THIS.array._.get(req);
          if (ga != null)ga._.flags != THIS._.flags.prune;
          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(THIS.method.deleteall,{text:'not authorized'});
          return get();
        }
        if (zs4.is.object(req.input)){
          //zs4.debug(this._.path+'.transform('+JSON.stringify(req.input)+')');
          if (req.input.sure!=true){
            req.error(this,{text:'not sure'});
            return get();
          }
          //zs4.debug(this.sure);

          for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
            delete THIS.array[n];
          }

          req.result(this,true);
          THIS._.shouldBeSaved(req);

          //req.setScope(THIS.array);
          //req.result(THIS.array,{deleteall:true,})
          //THIS.array._.get(req);
        }
        return get();
      }).bind(this.method.deleteall);

      var arr = THIS.template._.getScopeItems(THIS.template,THIS._.flags.index|THIS._.flags.unique);
      THIS.method._.property(new zs4.type.object({name:'getone',flags:'api noprune nostore noprune apiarg',}));
      THIS.method.getone._.property(new zs4.type.scopeindexunique({name:'item',flags:'required nostore noprune apiarg',inscope:THIS.template,}));
      THIS.method.getone._.property(new zs4.type.string({name:'eq',flags:'required nostore noprune apiarg',}));
      this.method.getone._.transform = (function(req,cb){
        var REQUEST = req;
        var GETONE = this;
        req.setScope(this);
        this._.transformInternal(req);
        function get(){
          GETONE._.get(req);
          GETONE.item._.get(req,GETONE);
          GETONE.eq._.get(req,GETONE);
          THIS.array._.get(req);
          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(this.method.getone,{text:'not authorized'});
          return get();
        }

        if (!zs4.is.object(req.input)){
          return get();
        }

        if (!zs4.is.string(req.input.item)||req.input.item.length==0){
          var err = 'no item specified'
          req.error(this,err);
          this._.print(err,req);
          return get();
        }
        if (!zs4.is.string(req.input.eq)||req.input.eq.length==0){
          var err = 'no eq value'
          req.error(this,err);
          this._.print(err,req);
          return get();
        }
        var item = THIS.template._.resolvePath(req.input.item);
        if (item==null){
          var err = 'template has no '+req.input.item;
          req.error(this,err);
          this._.print(err,req);
          return get();
        }

        if (THIS.config.driver._.value != ''){
          var args = new Object({request:req,});
          zs4.array[THIS.config.driver._.value].getOne.call(THIS,req,function(ret){
            if (ret == null){
              REQUEST.error(GETONE,'not found');
              return get();
            }
            REQUEST.result(GETONE,ret._.path);
            return get();
          });
        }
        else {
          var item = req.input.item;
          var eq = req.input.eq;

          for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
            GETONE._.print('   scanning '+THIS.array._.path+'.'+n,req);
            var val = THIS.array[n]._.resolvePath(item);
            if (val == null){
              continue;
            }
            if (val._.opcode.eq(eq)){
              GETONE._.print('   MATCH! -> transform() '+item,req);

              REQUEST.result(GETONE,THIS.array[n]._.path);
              THIS.array[n]._.getTree(req);
              THIS.array._.get(req);
              return get();
            }
          }

          REQUEST.error(GETONE,'not found');
          return get();
        }

      }).bind(this.method.getone);

      THIS.method._.property(new zs4.type.object({name:'deleteone',flags:'api noprune nostore noprune',}));
      THIS.method.deleteone._.property(new zs4.type.string({name:'id',flags:'apiarg required nostore noprune apiarg',}));
      this.method.deleteone._.transform = (function(req,cb){
        var DELONE = this;
        var DELREQ = req;
        req.setScope(this);
        this._.transformInternal(req);
        function get(){
          DELONE._.get(req);
          DELONE.id._.get(req,DELONE);
          THIS.array._.get(req);

          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(this.method.deleteone,{text:'not authorized'});
          return get();
        }

        if (!zs4.is.object(req.input)){
          return get();
        }

        if (!zs4.is.name(req.input.id)){
          var err = 'no valid id';
          req.error(this,err);
          this._.print(err,req);
          return get();
        }

        var id = req.input.id;

        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(this,err);
          this._.print(err,req);
          return get();
        }

        if (THIS.config.driver._.value != ''){
          zs4.array[THIS.config.driver._.value].getID.call(THIS,id,function(ret){
            if (ret==null){
              var err = id+' not found';
              req.error(DELONE,err);
              DELONE._.print(err,DELREQ);
              return get();
            }

            if (!req.flags.get.authroot()){
              if (req.request.payload.scope != ret.zs4.head.owner){
                var err = 'not authorized';
                req.error(DELONE,err);
                DELONE._.print(err,req);
                return get();
              }
            }
            zs4.array[THIS.config.driver._.value].deleteID.call(THIS,id,function(ret){
              if (ret==null){
                var err = 'not authorized';
                req.error(DELONE,err);
                DELONE._.print(err,req);
              }
              else{
                req.result(THIS.array,new Object({deletearr:[id,]}));
              }
              return get();
            });

          });
        }
        else {
          if (!THIS.array.hasOwnProperty(id)){
            var err = id+' not found';
            req.error(this,err);
            this._.print(err,req);
            return get();
          }

          if (!req.flags.get.authroot()){
            if (!req.request.payload.scope != THIS.array[id].zs4.head.owner._.value){
              var err = 'not authorized';
              req.error(this,err);
              this._.print(err,req);
              return get();
            }
          }

          delete THIS.array[id];

          req.result(THIS.array,new Object({deletearr:[id,]}));
          THIS._.shouldBeSaved(req);
          return get();
        }

      }).bind(this.method.deleteone);

    }
  },
  auth:function(input){
    zs4.type.object.call(this,{name:'auth',flags:'api noget noset',})
    this._.typename = 'auth';
    this._.create = zs4.type.auth;
    this._.load = (function(input){

      this._.print('load('+JSON.stringify(input)+')');

      if (!zs4.is.object(input)){
        return;
      }

      this._.scope._.loadAuth(input);

    }).bind(this);
    this._.store = (function(){
      this._.print('store()');
      if (this._.flags.get.nostore()){return null;}

      return this._.scope._.saveAuth(input)
    }).bind(this);
  },
  bits:function(input){
    var THIS = this;
    zs4.type.integer.call(this,input);
    this._.typename = 'bits';
    THIS._.bits = new zs4.util.bits(THIS._,'value');
  },
  boolean:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = Boolean;
    this._.typename = 'boolean';
    this._.default = new Boolean();
    if (zs4.is.boolean(input.default))this._.default = input.default; else this._.default = false;
    this._.value = this._.default;
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.boolean(input)) return this._.zs4checkfail(req,'not boolean');

      return true;
    }).bind(this);
    this._.zs4checkTrue = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.boolean(input)||input!=true) return this._.zs4checkfail(req,'not '+this._.name);

      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.boolean(v))return v;
        if (zs4.is.string(v)){
          if (v=='true')return true;
          if (v=='false')return false;
        }
        return null;
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value==true && v==false)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value==false && v==true)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==false)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==true)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);
      if (v==null){
          if (zs4.is.boolean(this._.default))this._.value=this._.default;
          else this._.value=new Boolean(false);
      }
      else {
        this._.value = v;
      }
    }).bind(this);

  },
  bye:function(input){
    var THIS = this;
    zs4.type.object.call(this,{name:'bye',flags:'api nostore apiarg',})
    this._.typename = 'bye';
    this._.create = zs4.type.bye;
    this._.property(new zs4.type.boolean({name:'sure',flags:'required noprune',}));
    this.sure._.zs4check = this.sure._.zs4checkTrue;

    this._.transform = (function(req,cb){
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input == null || (!zs4.is.boolean(req.input.sure))){
        this._.get(req); cb(); return;
      }
      zs4.debug('bye('+THIS._.path+')');
      if (!(req.flags.value & req.flags.authset)){
        req.error(THIS,'not authorized.');
        THIS._.get(req); cb(); return;
      }

      if (req.input.sure != true){
        req.error(THIS,'not sure');
        this._.get(req); cb(); return;
      }

      req.tokenDelete();
      req.result(THIS,true);
      THIS._.get(req); cb(); return;
    }).bind(this);

    this._.callback = (function(o){
      //zs4.debug('deleteall._.callback()');
      //zs4.debug(o);
      if (zs4.is.boolean(o.result)&&o.result==true){
        zs4.navigate('/');
      }
    }).bind(this);

    THIS._.get = (function(req,po){
      //zs4.debug('password.get'+ JSON.stringify(this._.authGet));
      if (!req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        zs4.debug(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //zs4.debug(this._.authGet);
        return null;
      }

      get.sure = new Object({_:{}});
      get.sure._.name = 'sure';
      get.sure._.typename = 'boolean';
      get.sure._.value = false;
      get.sure._.flags = THIS._.flags.apiarg|THIS._.flags.required;

      return get;
    }).bind(THIS);

  },
  console:function(input){
    zs4.type.object.call(this,{name:'console',flags:'api noget noset',})
    this._.typename = 'auth';
    this._.create = zs4.type.auth;
    this._.load = (function(input){

      this._.print('load('+JSON.stringify(input)+')');

      if (!zs4.is.object(input)||!zs4.is.array(input.array)){
        return;
      }

      //zs4.console.arr = input.array;

    }).bind(this);
    this._.store = (function(){
      this._.print('store()');
      if (this._.flags.get.nostore()){return null;}

      return new Object({array:zs4.console.arr});
    }).bind(this);
  },
  date:function(input){
    zs4.type.integer.call(this,input);
    this._.typename = 'date';
    var d = new Date();
    this._.value = this._.default = d.getTime();
  },
  download:function(input){
    zs4.type.object.call(this,input)
    this._.typename = 'download';
    this._.create = zs4.type.download;
    this._.flags.set.api();
  },
  email:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'email';
    this._.minlength = zs4.const.EMAIL.MINLENGTH;
    this._.maxlength = zs4.const.EMAIL.MAXLENGTH;
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.email(input)) return this._.zs4checkfail(req,'not email');

      return true;
    }).bind(this);
  },
  enum:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'enum';
  },
  file:function(input){
    var FILE = this;
    zs4.type.object.call(this,input);
    this._.typename = 'file';
    this._.flags.set.nosort(true);
    //if (zs4.is.node()){
      this._.property(new zs4.type.download({name:'download',flags:'api noprune nostore',}));
      this.download._.transform = (function(req,cb){
        var REQUEST = req;
        var DOWNLOAD = this;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(DOWNLOAD,err);
          this._.print(err,req);
          this._.get(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(DOWNLOAD,err);
          this._.print(err,req);
          this._.get(req); cb(); return;
        }


        this._.get(req);
        FILE.content._.get(req);
        FILE._.get(req); cb(); return;

      }).bind(this.download);

      this._.property(new zs4.type.filecontent({name:'content',flags:'noprune quickupdate',}));
    //}
  },
  filecontent:function(input){
    zs4.type.text.call(this,input);
    this._.typename = 'filecontent';
    this._.maxlength = zs4.const.TEXT.MAXLENGTH;
  },
  folder:function(input){
    var DRIVE = this;
    zs4.type.object.call(DRIVE,input);

    DRIVE._.typename = 'folder';
    DRIVE._.flags.set.nogetall(true);

    DRIVE._.folder = new Object();

    DRIVE._.load = (function(input){
      //zs4.debug('loading '+this._.path,input);
      if (!zs4.is.object(input))return;
      for (var n in input){
        var name = (' '+n+' ').trim();

        if (input[name].hasOwnProperty('content')&&zs4.is.string(input[name].content)){
          zs4.debug('   FILE: \''+name+'\'')
          DRIVE._.property(new zs4.type.file({name:name}));
          DRIVE[name]._.load(input[n]);
        }
        else if (zs4.is.object(input[name].zs4)&&input[name].zs4.hasOwnProperty('driver')){
          zs4.debug('   FOLDER: \''+name+'\'')
          DRIVE._.property(new zs4.type.folder({name:name}));
          DRIVE[name]._.load(input[n]);
        }

        this[n]._.load(input[n]);
      }
    }).bind(DRIVE);

    DRIVE._.callback = (function(o){
      zs4.debug('DRIVE._.callback()');
      zs4.debug(o);
      if (zs4.is.object(o.result)){
        if (zs4.is.string(o.result.delete)){
          if (DRIVE.hasOwnProperty(o.result.delete)){
            if (zs4.is.type(DRIVE[o.result.delete])){
              zs4.debug('deleting '+o.result.delete);

              if (zs4.is.function(DRIVE[o.result.delete]._.cleanup))DRIVE[o.result.delete]._.cleanup();
              delete DRIVE[o.result.delete];
            }
          }
        }
        if (zs4.is.function(DRIVE._.refresh)){
          DRIVE._.refresh();
        }
      }
    }).bind(DRIVE);

    if (zs4.is.node()){
      DRIVE._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get==null)return null;
        DRIVE.zs4._.getTree(req);
        return get;
      }).bind(DRIVE);

      DRIVE._.property(new zs4.type.object({name:'zs4',flags:'noprune'}));

      DRIVE.zs4._.property(new zs4.type.integer({name:'maxsize',flags:'noprune quickupdate'}));
      DRIVE.zs4._.property(new zs4.type.enum({name:'driver',flags:'noprune quickupdate',}));
      DRIVE.zs4.driver._.get = (function(req){
        var arr = new Array();
        arr.push('');
        for (var n in zs4.folder){
          arr.push((' '+n+' ').trim());
        }
        this._.enum = arr;
        return this._.getInitialize(req);
      }).bind(DRIVE.zs4.driver);

      DRIVE.zs4._.property(new zs4.type.object({name:'list',flags:'noprune api nostore',}));
      DRIVE.zs4.list._.transform = (function(req,cb){
        var REQUEST = req;
        var LIST = DRIVE.zs4.list;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(LIST,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(LIST,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            for (var n in DRIVE)if (n!='zs4'&&zs4.is.type(DRIVE[n])){
              if (DRIVE[n]._.typename=='file'){
                DRIVE[n]._.get(req);
              }
              else if (DRIVE[n]._.typename=='folder'){
                DRIVE[n]._.get(req);
                DRIVE[n].zs4._.getTree(req);
              }
            }
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.list);

      DRIVE.zs4._.property(new zs4.type.object({name:'newfile',flags:'noprune api nostore',}));
      DRIVE.zs4.newfile._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.newfile._.property(new zs4.type.text({name:'data',flags:'noprune apiarg'}));
      DRIVE.zs4.newfile._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = DRIVE.zs4.newfile;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(NEW,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(NEW,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)){
            req.error(NEW,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (DRIVE.hasOwnProperty(req.input.name)){
              req.error(NEW,'already exists');
              this._.getTree(req); cb(); return;
            }

            DRIVE._.shouldBeSaved(req);
            DRIVE._.property(new zs4.type.file({name:req.input.name,}));
            DRIVE[req.input.name].content._.value = req.input.data;
            DRIVE[req.input.name]._.getTree(req);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newfile);

      DRIVE.zs4._.property(new zs4.type.object({name:'newdir',flags:'noprune api nostore',}));
      DRIVE.zs4.newdir._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.newdir._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = DRIVE.zs4.newdir;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(NEW,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(NEW,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)){
            req.error(NEW,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (DRIVE.hasOwnProperty(req.input.name)){
              req.error(NEW,'already exists');
              this._.getTree(req); cb(); return;
            }
            DRIVE._.shouldBeSaved(req);
            DRIVE._.property(new zs4.type.folder({name:req.input.name,}));
            DRIVE[req.input.name]._.getTree(req);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newdir);

      DRIVE.zs4._.property(new zs4.type.object({name:'delete',flags:'noprune api nostore',}));
      DRIVE.zs4.delete._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.delete._.transform = (function(req,cb){
        var REQUEST = req;
        var DELETE = DRIVE.zs4.delete;
        req.setScope(this);
        this._.transformInternal(req);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(DELETE,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(DELETE,err);
          this._.print(err,req);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)||req.input.name=='zs4'){
            req.error(DELETE,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (!DRIVE.hasOwnProperty(req.input.name)
            ||  !zs4.is.type(DRIVE[req.input.name])){
              req.error(DELETE,'not found');
              this._.getTree(req); cb(); return;
            }

            DRIVE._.shouldBeSaved(req);
            delete DRIVE[req.input.name];
            req.result(DRIVE,{delete:req.input.name})
            req.result(this,true);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newdir);
    }
  },
  head:function(){
    zs4.type.object.call(this,{name:'head',flags:'authgetpublic authsetself nosort',})
    this._.typename = 'head';
    this._.create = zs4.type.head;

    if (zs4.is.node()){
      this._.property(new zs4.type.string({name:'title',maxlength:zs4.const.MAXLENGTH.TITLE,flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.string({name:'author',flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.text({name:'description',maxlength:zs4.const.MAXLENGTH.META,flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.lang({name:'lang',flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.string({name:'owner',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'typename',flags:'noset index noprune authgetpublic nostore',}));
      this._.property(new zs4.type.date({name:'created',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.date({name:'updated',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'doctype',flags:'index noprune quickupdate authgetpublic',}));
      this._.property(new zs4.type.scopebits({name:'bits',flags:'index noprune quickupdate authgetpublic authsetself',}));
      //zs4.debug('adding stat to header');
      this._.property(new zs4.stat.create('stat'));
    }

  },
  hi:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'hi',flags:'api apiarg nostore nosort',})
    this._.typename = 'hi';
    this._.create = zs4.type.hi;

    if (zs4.is.node()){
      this._.property(new zs4.type.email({name:'email',flags:'apiarg noprune required',}));
      this._.property(new zs4.type.password({name:'password',flags:'apiarg noprune required',}));
      this._.property(new zs4.type.boolean({name:'sendtoken',flags:'apiarg noprune',}));

      this._.transform = (function(req,cb){
        var REQUEST = req;
        req.setScope(this);
        this._.transformInternal(req);

        zs4.debug(req.input);

        if (!zs4.is.object(req.input)){
          req.error(this,'input is not an object');
          THIS._.get(req); cb(); return;
        }

        if (!zs4.is.email(req.input.email)){
          req.error(this,'no email');
          THIS._.get(req); cb(); return;
        }

        if (!zs4.is.password(req.input.password)){
          if (zs4.is.boolean(req.input.sendtoken)&&req.input.sendtoken==true){
            zs4.debug('attempting to email token to address '+req.input.email);
            if (zs4.THIS.zs4.email.smtp.configured._.value!=true){
              req.error(THIS,'internal configuration error');
              THIS._.get(req); cb(); return;
            }

            function sendEmailToken(email,scope){
              var token = zs4.THIS.zs4.token.encode({iss:'zs4.email.message',scope:scope,});
              var hosturl = zs4.THIS.zs4.express.getHostURL(req);
              hosturl += '/'+scope;
              var message = new Object({
                to:email,
                subject:zs4.THIS.zs4.express.host._.value+' access token for '+email,
                text:'Click here to automatically log in '+email+': '+hosturl+'?token='+token});

              req.call({path:'zs4.email.message',input:message,},function(backcall){
                zs4.debug('response from zs4.email.message',backcall);
                if (backcall.error != null){
                  req.error(THIS,'');
                  THIS._.get(req); cb(); return;
                };

                if (backcall.result != null){
                  var path = scope;
                  if (path!='')path+='.';
                  path+='zs4.password';
                  req.call({path:path,input:{reset:true}},function(resetcb){
                    zs4.debug(path+': RESET!!!');
                    req.result(THIS,backcall.result);
                    THIS._.get(req); cb(); return;
                  });
                }
                else {
                  req.error(THIS,'send message failure');
                  THIS._.get(req); cb(); return;
                }
              },true);
            };

            if (req.input.email==zs4.THIS.zs4.email.smtp.from._.value){
              sendEmailToken(req.input.email,'');
              return;
            }

            req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
              zs4.debug(callback);
              if (callback.error != null){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              };
              if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              }
              var USERPATH = callback.result;
              sendEmailToken(req.input.email,callback.result);
              return;
            },true);
            return;
          }
          else {
            req.error(this,'no password');
            THIS._.get(req); cb(); return;
          }
        }

        if (req.input.email==zs4.THIS.zs4.email.smtp.from._.value){
          req.call({path:'zs4.password',input:{vfy:req.input.password,}},function(callback){
            if (callback.error != null){
              zs4.debug('zs4.password root login attempt failed');
              req.error(THIS,'');
              THIS._.get(req); cb(); return;
            };

            if (!req.tokenExists()){
              req.error(THIS,'login failed');
              THIS._.get(req); cb(); return;
            }

            zs4.debug('GOSCOPE ROOTSCOPE');
            req.result(THIS,{goscope:''});
            THIS._.get(req); cb(); return;
          });
          return;
        }

        req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
          //zs4.debug(callback);
          if (callback.error != null){
            zs4.debug('zs4.type.user.method.getone('+req.input.email+') failed: ',callback);
            req.error(THIS,req.input.email+' not found.');
            THIS._.get(req); cb(); return;
          };
          if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
            req.error(THIS,'not found');
            THIS._.get(req); cb(); return;
          }

          zs4.debug('calling: '+callback.result+'.zs4.password');
          var userpath = callback.result;
          req.call({path:callback.result+'.zs4.password',input:{vfy:req.input.password}},function(callback){
            if (callback.error != null){
              req.error(THIS,'password incorrect');
              THIS._.get(req); cb(); return;
            };

            if (!req.tokenExists()){
              req.error(THIS,'login failed');
              THIS._.get(req); cb(); return;
            }

            zs4.debug('GOSCOPE '+userpath);
            req.result(THIS,{goscope:userpath});
            THIS._.get(req); cb(); return;
          });
        },true);
      }).bind(this);
    }

    THIS._.get = (function(req,po){
      //zs4.debug('password.get'+ JSON.stringify(this._.authGet));
      if (req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        zs4.debug(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //zs4.debug(this._.authGet);
        return null;
      }

      req.setScope(THIS.email);
      THIS.email._.get(req);

      req.setScope(THIS.password);
      THIS.password._.get(req);

      return get;
    }).bind(THIS);
  },
  integer:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = Number;
    this._.typename = 'integer';
    this._.default = new Number();

    if (zs4.is.number(input.default))this._.default = this._.parseInt(input.default);
    else this._.default = 0;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this._.min = this._.parseInt(input.min);
      if (zs4.is.number(input.max))this._.max = this._.parseInt(input.max);
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.number(input)){
        var int = parseInt(input);
        if (int==NaN) return this._.zs4checkfail(req,'not integer');
        input = int;
      }

      if (zs4.is.number(this._.min)&&input<this._.min)return this._.zs4checkfail(req,'min='+this._.min);
      if (zs4.is.number(this._.max)&&input>this._.max)return this._.zs4checkfail(req,'max='+this._.max);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return this._.zs4checkfail(req,'enum');
      }
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.number(v)){
          return this._.parseInt(v);
        }
        if (zs4.is.string(v)){
          try{
            return this._.parseInt(v);
          }
          catch(err){}
          return null;
        }
        if (zs4.is.boolean(v)){
          if (v) return 1;
          else return 0;
        }
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.number(this._.default))this._.value = this._.parseInt(this._.default);
        else this._.value = new Number(0);
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  lang:function(input){
    zs4.type.string.call(this,input);
    this._.maxlength = zs4.const.MAXLENGTH.LANG;
    this._.typename = 'lang';
    this._.default = 'en';
    this._.enum = [
      'de',
      'en',
      'fr',
    ];
  },
  name:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'name';
    this._.minlength = zs4.const.NAME.MINLENGTH;
    this._.maxlength = zs4.const.NAME.MAXLENGTH;
  },
  names:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'names';
    this._.minlength = 0;
    this._.maxlength = zs4.const.STRING.MAXLENGTH;
  },
  number:function(input){
    var THIS = this;
    //req.setScope(this);
    zs4.type.unknown.call(this,input);
    this._.type = Number;
    this._.typename = 'number';
    this._.default = new Number();
    if (zs4.is.number(input.default))this._.default = input.default;
    else this._.default = 0;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this._.min = input.min;
      if (zs4.is.number(input.max))this._.max = input.max;
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.number(input)){
        var num = parseFloat(input);
        if (num==NaN) return this._.zs4checkfail(req,'not number');
        input = num;
      }
      if (zs4.is.number(this._.min)&&input<this._.min)return this._.zs4checkfail(req,'min='+this._.min);
      if (zs4.is.number(this._.max)&&input>this._.max)return this._.zs4checkfail(req,'max='+this._.max);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return this._.zs4checkfail(req,'enum');
      }
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.number(v))return v;
        if (zs4.is.string(v)){
          var x = parseFloat(v);
          if (x==NaN)return null;
          return x;
        }
        if (zs4.is.boolean(v)){
          if (v) return 1;
          else return 0;
        }
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);
      //zs4.debug(this.path+'.load(\''+input+'\')');

      if (v==null){
        if (zs4.is.number(this._.default))this._.value=this._.default;
        else this._.value=new Number(0);
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  object:function(input){
    zs4.type.unknown.call(this,input);

    this._.property = (function(ns){
      if (!zs4.is.type(ns)){

        zs4.debug('ADD SCHEMA FAILURE!!!!!  ');
        zs4.debug(ns);
        return null;
      }
      //zs4.debug('adding '+ns._.name+' to '+this._.path);
      this[ns._.name] = ns;
      if (this._.path.length>0)ns._.path = this._.path +'.'+ns._.name;
      else ns._.path = ns._.name;

      if (!zs4.is.type(ns._.scope))ns._.scope = this._.scope;

      if (this._.scope != null && !ns._.flags.get.scope()){
        ns._.scope = this._.scope;
        //ns._.flags.value = this._.flags.value;
      };

      if (this._.inscope != null){
        ns._.inscope = this._.inscope;
        ns._.flags.value = this._.flags.value;
        this._.inscope._.localRefresh();
      };


      if (ns._.type == Object){

          //debug += ' Object';
          this._.value[ns._.name] = ns._.value;

          for (var n in ns){
            if (!zs4.is.type(ns[n]))continue;
            //zs4.debug(ns._.name+'.'+n);
            ns._.property(ns[n]);
          }
      }
      //else {
        //this._.value[ns._.name] = new ns._.type();
        //this._.value[ns._.name] = ns._.default;
      //}

    }).bind(this);

    this._.type = Object;
    this._.typename = 'object';
    this._.value = new Object();
    this._.path = '';

    this._.countProperties = (function(){
      var count = 0;
      for (var n in this){if (zs4.is.type(this[n])){count++;}}
      return count;
    }).bind(this);

    this._.transform = (function(req,cb){
      var THIS = this;
      req.setScope(this);
      this._.transformInternal(req);

      var starttime = Date.now();
      //if (zs4.is.object(req.scope)){
      //  zs4.debug('in scope /' + req.scope._.path + ' (at '+this._.path+')');
      //}

      if (zs4.is.object(req.input)&&zs4.is.object(req.input.getHTML)){
        this._.print('getHTML() '+zs4.json.stringify(req.input),req);
        //zs4.debug('---- getHTML('+THIS._.path+') '+zs4.json.stringify(req.input));
        this._.getHTML(req);
        //this._.get(req);
        cb(); return;
      }
      if (this._.flags.get.scope()){
        if (zs4.is.object(req.input)
        && zs4.is.object(req.input.zs4)
        && zs4.is.object(req.input.zs4.js)
        && zs4.is.object(req.input.zs4.js.getHTML)){
          this._.print('get.zs4.js() '+zs4.json.stringify(req.input),req);
          //zs4.debug('---- getAMP('+THIS._.path+') '+zs4.json.stringify(req.input));
          this._.getZS4js(req,cb);
          return;
        }
        if (zs4.is.object(req.input)
        && zs4.is.object(req.input.amp)
        && zs4.is.object(req.input.amp.getHTML)){
          this._.print('getAMP() '+zs4.json.stringify(req.input),req);
          //zs4.debug('---- getAMP('+THIS._.path+') '+zs4.json.stringify(req.input));
          this._.getAMP(req,cb);
          return;
        }
      }

      if (this._.flags.get.nogetall()){
        //zs4.debug(this._.path+' NOGETALL');
      }

      var empty_input_object = false;
      if (zs4.is.object(req.input)){
        if (zs4.count.object.properties(req.input)==0){
          empty_input_object = true;
          if (!this._.flags.get.nogetall()){ req.getAll(); }
        }
      }

      if (empty_input_object&&req.getall&&this._.flags.get.nogetall()) {
        //zs4.debug(this._.path+' NOGETALL');
        THIS._.get(req); cb(); return;
      }

      if (!(req.flags.value & req.flags.authset)){
        var err = 'set not authorized';
        this._.print(err,req);
      }

      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;


        if (req.input==null||req.input[n]==null){
          if (req.getall && !this._.flags.get.nogetall()){
            parallel.call(THIS[n],THIS[n]._.transform,req.create({input:null,parent:this,}));
          }
        }
        else if (zs4.is.object(req.input)&&!this._.flags.get.notrans()){
          parallel.call(this[n],this[n]._.transform,req.create({input:req.input[n],parent:this,}));
        }
      }

      parallel.run(function(){
        var now = Date.now();
        if (THIS._.flags.get.scope()){
          req.stat(THIS,{transform:1,},now-starttime);
        }
        else if (zs4.is.object(req.scope)){
          req.stat(THIS,{transitem:1,},now-starttime);
        }
        req.stat(THIS,{read:1,},now-starttime);
        THIS._.get(req);
        cb();
      });

    }).bind(this);

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      var api =this._.flags.get.api();

      var assume = true;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (!zs4.is.object(input)){
          return this._.zs4checkfail(req,n + ' required');
        }
        //  if (!this[n]._.zs4check(req,input[n]))return false;
        //}
        if (this[n]._.flags.get.required()){
          return this._.zs4checkfail(req,n + ' required');
        }

      }
      return true;
    }).bind(this);

    this._.load = (function(input){
      //zs4.debug('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        this[n]._.load(input[n]);
      }
    }).bind(this);
    this._.store = (function(){

      //zs4.debug(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //zs4.debug(this._.path+'.NO_store()');
        return null;
      }
      //zs4.debug(this._.path+'.actually_store()');

      //zs4.debug(this._.path+'.object_store('+this._.typename +')');
      var store = new Object();
      var count = 0;
      for (var n in this)if(zs4.is.type(this[n])){
        var ret = this[n]._.store();
        if (ret != null) {count++; store[n] = ret;}
      }

      return store;
      //if (count > 0) return store;
      //return null;
    }).bind(this);

    this._.sortNot = (function(a,b){
      return 0;
    }).bind(this);

    this._.sortName = (function(a,b){
      if (a._.name == b._.name)return 0;
      if (a._.name < b._.name)return -1;
      return 1;
    }).bind(this);

    this._.sortDefault = this._.sortName;
    this._.sortDefaultDescend = false;
    this._.sort = (function(foo,descend){
      if (foo==null)foo=this._.sortDefault;
      if (descend==null)descend = this._.sortDefaultDescend;

      if (descend==true)foo = function(a,b){return foo(b,a);}
      var a = new Array();
      for (var n in this)if(zs4.is.type(this[n])){a.push(this[n])};
      if (this._.flags.get.api())return a;

      if (a.length > 1){
        a = a.sort(foo);
      }
      return a;
    }).bind(this);

    if (zs4.is.window()){
      this._.submit = (function(input,cb){
        var THIS = this;
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,function(ret){
          cb(zs4.path.resolve(ret,'request.callback.'+THIS._.path));
        });
      }).bind(this);
    }
    if (zs4.is.node()){
      this._.submit = (function(input,cb){
        var THIS = this;
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,function(ret){
          cb(zs4.path.resolve(ret,'request.callback.'+THIS._.path));
        });
      }).bind(this);

    }

  },
  password:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'password';
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.password(input)&&input!='') return this._.zs4checkfail(req,'not password');

      return true;
    }).bind(this);
  },
  scope:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'this',flags:'scope',})
    THIS._.typename = 'scope';
    THIS._.scope = this;
    THIS._.property(new zs4.type.zs4());
    THIS.zs4.password = null;
    THIS.zs4._.property(new zs4.type.head());
    if (zs4.is.node()){
      THIS.zs4._.property(new zs4.type.auth());
      THIS.zs4._.property(new zs4.type.console());
    }
    THIS._.getScopeItems = (function(scope,type){
      var subtract = false;
      if (scope != null && scope._.path.length>0){
        subtract = true;
      }
      else {
        scope = THIS;
      }
      var response = new Array();
      //zs4.debug(type);
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          if (item[n]._.flags.get.scope())continue;

          //zs4.debug('getScopeItems-recurse '+item[n]._.path);
          if (type == null
          || (zs4.is.function(type)&&type == item[n]._.type)
          || (zs4.is.string(type)&&type==item[n]._.typename)
          || (zs4.is.number(type)&&((item[n]._.flags.value&type)==type))
          ){
            //var sp = scope._.path;
            //var ip = item[n]._.path;
            var val = item[n]._.path;
            //for (var i=0;i<ip.length;i++)if (i>(sp.length+1))
            if (scope._.path.length>0)
              val = val.substr(scope._.path.length+1,val.length-scope._.path.length-1);
            response.push(new Object({item:item[n],label:val,value:val}));
          }

          if (item[n]._.type == Object){
            if (!item[n]._.flags.get.scope())
              recurse(item[n]);
          }
        }
      };
      recurse(scope);
      return response;
    }).bind(this);
    THIS._.getUserScopes = (function(){
      var scope = zs4.THIS;
      var response = new Array();
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          zs4.debug('getUserScopes('+item[n]._.path+') ? ')
          item[n]._.print('getUserScopes');

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            zs4.debug('getUserScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            zs4.debug('getUserScopes('+item[n]._.path+') VALID!')

            item[n]._.print('getUserScopes OK!!!!')
            var label = item[n]._.path;
            var value = item[n]._.path;
            if (zs4.is.string(item[n].zs4.head.title._.value)
            && (item[n].zs4.head.title._.value.length > 1 )){
              label = item[n].zs4.head.title._.value;
            }
            else {
              label = new String(n + '(untitled)');
            }
            response.push(new Object({label:label,value:value}));
            continue;
          }

          if (item[n]._.type == Object){
            recurse(item[n]);
          }
        }
      };

      response.push(new Object({label:'zs4.public',value:'zs4.public'}));
      response.push(new Object({label:'zs4.owner',value:'zs4.owner'}));
      response.push(new Object({label:'zs4.self',value:'zs4.self'}));
      recurse(scope.zs4.type.user.array);
      return response;
    }).bind(this);
    THIS._.getAllScopes = (function(){
      var scope = zs4.THIS;
      var response = new Array();
      response.push(scope);
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          //zs4.debug('getAllScopes('+item[n]._.path+') ? ')
          item[n]._.print('getAllScopes');

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            //zs4.debug('getAllScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            //zs4.debug('getAllScopes('+item[n]._.path+') VALID!')
            response.push(item[n]);
            continue;
          }

          if (item[n]._.type == Object){
            recurse(item[n]);
          }
        }
      };
      recurse(scope.zs4.type);
      return response;
    }).bind(this);
    THIS._.getKeyWordArray = (function(){
      var ret = new Array();
      ret.push(new String('zs4'));
      return ret;
    }).bind(this);

    THIS.zs4._.property(new zs4.type.object({name:'update',flags:'noget nostore api apiarg',}));
  },
  scopebits:function(input){
    var THIS = this;
    zs4.type.bits.call(this,input);
    this._.typename = 'scopebits';
    THIS._.bits.addBit('public',0);
    THIS._.bits.addBit('doctype',1);
    THIS._.bits.addBit('plugin',2);
  },
  scopeindex:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeindex';
  },
  scopeindexunique:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeindexunique';
  },
  scopeitem:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeitem';
  },
  scopescope:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopescope';
  },
  search:function(){
    var SEARCH = this;
    zs4.type.object.call(this,{name:'search',flags:'api apiarg',});
    this._.typename = 'search';
    if (zs4.is.node()){
      this._.property(new zs4.type.string({name:'value',flags:'apiarg',}));
      this._.property(new zs4.type.enum({name:'type',flags:'apiarg',}));
      this._.property(new zs4.type.string({name:'owner',flags:'apiarg',}));
      this.type._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get == null) return null;
        get._.value = '';

        get._.enum = new Array(); get._.enum.push('');
        for (var n in zs4.THIS.zs4.type)if (zs4.is.type(zs4.THIS.zs4.type[n])){
            get._.enum.push((' '+n+' ').trim());
        }
        return get;
      }).bind(this.type);
      this._.transform = (function(req,cb){
        var REQUEST = req;
        REQUEST.setScope(this);
        this._.transformInternal(REQUEST);

        if (!zs4.is.object(req.input)){
          SEARCH._.get(REQUEST); cb(); return;
        }

        var typ = zs4.THIS.zs4.type;
        var query = new Object({search:req.input.value,select:{sc:'all'}});

        if (zs4.is.string(req.input.owner)&&req.input.owner!=''){
          zs4.debug('zs4.search('+req.input.owner+')')
          query.select.owner = new Object({
              sc:'item',
              item:'zs4.head.owner',
              opcode:'eq',
              type:'const',
              const:req.input.owner,
              prop:'',
          });
        }

        //zs4.debug('zs4.search('+JSON.stringify(query)+')');

        var parallel = new zs4.processor.parallel();

        for (var n in typ)if (zs4.is.type(typ[n])){
          if (zs4.is.string(req.input.type)&&req.input.type!=''&&req.input.type!=n)continue;

          parallel.call(
            REQUEST,
            REQUEST.call,
            {path:'zs4.type.'+n+'.method.query',input:query,wantreply:true,}
          );
        }

        parallel.run(function(){
          SEARCH._.get(REQUEST);
          cb();
        });

      }).bind(this);
      this._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get == null) return null;

        req.setScope(this.value);
        this.value._.get(req);

        req.setScope(this.type);
        this.type._.get(req);

        req.setScope(this.owner);
        this.owner._.get(req);

        return get;
      }).bind(this);
    }
  },
  select:function(){
    var SELECT = this;
    zs4.type.object.call(this,{name:'select',flags:'noprune nostore apiarg local nosort',});
    this._.property(new zs4.type.string({name:'sc',flags:'nostore noset noprune nodisplay'}));
    this.sc._.flags.set.local(true);
    this.sc._.flags.set.nodisplay(true);
    this.sc._.value = 'all';

    this._.parse = (function(input){
      //zs4.debug('SELECT.parse('+this._.path+')');
      for (var n in input){
        if (!zs4.is.object(input[n])&&!zs4.is.string(input[n].sc))continue;
        if (input[n].sc == 'all'){
          var nu = new zs4.type.selectall();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'any'){
          var nu = new zs4.type.selectany();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'none'){
          var nu = new zs4.type.selectnone();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'item'){
          var nu = new zs4.type.selectitem();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }

      }
    }).bind(this);

    this._.sortDefault = this._.sortNot;
    this._.typename = 'select';
    this._.create = zs4.type.select;
    this._.addTypes = ['selectall','selectany','selectnone','selectitem'];
    this._.select = new Object();

    this._.onLocalChange = (function(){
      this.sc._.flags.set.nodisplay(true);
      this._.select.check();
    }).bind(this);

    this._.select.inscope = (function(){
      if (zs4.is.type(this._.inscope))return this._.inscope;
      return this._.scope;
    }).bind(this);
    this._.select.result = (function(r){
      if (zs4.is.boolean(r)){
        if (!zs4.is.node()){
          this._.cberror = null;
          this._.cbresult = r;
        }
        return r;
      }
      else if (zs4.is.string(r)){
        if (!zs4.is.node()){
          SELECT._.cberror = new Object({text:r});
          SELECT._.cbresult = null;
        }
        return false;
      }
    }).bind(this);
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this){
        //zs4.debug('    property '+n);
      if (zs4.is.type(this[n])&&zs4.string.startsWith(this[n]._.typename,'sel')){
          if (!this[n]._.select.check())return this._.select.result('');
        }
      }
      return this._.select.result(true);

    }).bind(this);
  },
  selectall:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectall';
    this.sc._.value = 'all';
    this._.create = zs4.type.selectall;
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (!this[n]._.select.check())return this._.select.result('');
      }
      return this._.select.result(true);
    }).bind(this);
  },
  selectany:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectany';
    this.sc._.value = 'any';
    this._.create = zs4.type.selectany;
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (this[n]._.select.check())return this._.select.result(true);
      }
      return this._.select.result('');
    }).bind(this);
  },
  selectnone:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectnone';
    this.sc._.value = 'none';
    this._.create = zs4.type.selectnone;
    this._.select.check = (function(){
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (this[n]._.select.check())return this._.select.result('');
      }
      return this._.select.result(true);
    }).bind(this);
  },
  selectitem:function(){
    var ITEM = this;
    zs4.type.select.call(ITEM);
    ITEM._.typename = 'selectitem';
    this.sc._.value = 'item';
    this._.create = zs4.type.selectitem;
    ITEM._.addTypes = new Array();

    ITEM._.property(new zs4.type.scopeitem({name:'item',}));
    ITEM._.property(new zs4.type.enum({name:'opcode',enum:['exists','eq','gt','lt','ge','le'],default:'exists'}));
    ITEM._.property(new zs4.type.enum({name:'type',enum:['const','prop'],default:'const'}));
    ITEM._.property(new zs4.type.string({name:'const'}));
    ITEM._.property(new zs4.type.scopeitem({name:'prop',}));

    ITEM._.parse = (function(input){
      //zs4.debug('ITEM.parse('+this._.path+')',input);
      if (zs4.is.object(input)){
        this._.load(input);
      }
      //zs4.debug(ITEM);
    }).bind(this);

    ITEM._.select.check = (function(){
      this.sc._.flags.set.nodisplay(true);
      //zs4.debug(ITEM._.path+'._.select.check()');
      var scope = this._.select.inscope();
      if (scope==null)return this._.select.result('scope');

      if (ITEM.item._.value==null||ITEM.item._.value==''){
        return this._.select.result('item empty');
      }

      var item = scope._.resolvePath(ITEM.item._.value)
      if (item==null)return this._.select.result('item not found');
      //zs4.debug('    item value: '+item._.value);
      if (ITEM.opcode._.value==null||ITEM.opcode._.value=='')return this._.select.result('opcode');

      if (ITEM.opcode._.value=='exists'){
        //zs4.debug('   EXISTS! '+ITEM.item._.value);
        return this._.select.result(true);
      }

      if (!zs4.is.function(item._.opcode[ITEM.opcode._.value])){
        return this._.select.result('no \''+ITEM.opcode._.value+'\' opcode');
      }
      //zs4.debug('   OPCODE! '+ITEM.opcode._.value);

      if (ITEM.type._.value != 'const' && ITEM.type._.value != 'prop')return this._.select.result('type');

      if (ITEM.type._.value == 'const'){
        if(item._.opcode[ITEM.opcode._.value](ITEM.const._.value)) return this._.select.result(true);
        return this._.select.result('not '+ITEM.opcode._.value);
      }

      if (ITEM.type._.value == 'prop'){
        if (ITEM.prop._.value==null||ITEM.prop._.value=='')return this._.select.result('prop empty');
        var prop = scope._.resolvePath(ITEM.prop._.value)
        if (prop==null)return this._.select.result('prop not found');
        if (prop._.type==Object)return this._.select.result('bad prop');

        if (item._.opcode[ITEM.opcode._.value](prop._.value))return this._.select.result(true);
        return this._.select.result('not '+ITEM.opcode._.value);
      }

      return this._.select.result('error');
    }).bind(this);

    ITEM._.onLocalChange = (function(){
      var scope = this._.select.inscope();
      if (scope==null)return this._.select.result('scope');
      //zs4.debug(ITEM._.path+'._.onLocalChange()');
      this.sc._.flags.set.nodisplay(true);
      ITEM.opcode._.flags.set.nodisplay(true);
      ITEM.type._.flags.set.nodisplay(true);
      ITEM.const._.flags.set.nodisplay(true);
      ITEM.prop._.flags.set.nodisplay(true);
      if (ITEM.item._.value==null||ITEM.item._.value==''){
        //zs4.debug('      all items hidden');
      }
      else {
        ITEM.opcode._.flags.set.nodisplay(false);
        var item = scope._.resolvePath(ITEM.item._.value)
        if (item!=null){
          if (item._.type==String){
            ITEM.opcode._.enum = ['exists','eq','gt','lt','ge','le',
            'str_eq','str_gt','str_lt','str_ge','str_le',
            'str_start','str_end','str_search',];
          }
          else{
            ITEM.opcode._.enum = ['exists','eq','gt','lt','ge','le'];
          }
          //zs4.debug('      show opcode');
          if (ITEM.opcode._.value == null||ITEM.opcode._.value == ''){
            ITEM.opcode._.value = 'exists';
          }
          //zs4.debug('      opcode='+ITEM.opcode._.value);
          if (ITEM.opcode._.value != 'exists'){
            ITEM.type._.flags.set.nodisplay(false);

            if (ITEM.type._.value != 'const' && ITEM.type._.value != 'prop'){
              ITEM.type._.value = 'const';
            }

            if (ITEM.type._.value == 'const'){
              ITEM.const._.flags.set.nodisplay(false);
            }
            else {
              ITEM.prop._.flags.set.nodisplay(false);
            }

          }
        }

      }
      ITEM._.select.check();
    }).bind(ITEM);
  },
  string:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = String;
    this._.typename = 'string';
    this._.default = new String();
    if (zs4.is.string(input.default))this._.default = input.default;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.minlength))this._.minlength = parseInt(input.minlength);
      if (zs4.is.number(input.maxlength))this._.maxlength = parseInt(input.maxlength);
      //if (!zs4.is.number(this.minlength))this._.minlength = zs4.const.STRING.MINLENGTH;
      if (!zs4.is.number(this._.maxlength))this._.maxlength = zs4.const.STRING.MAXLENGTH;
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.string(input))return this._.zs4checkfail(req,'not string: '+input);
      if (zs4.is.number(this._.minlength)&&input.length<this._.minlength)return this._.zs4checkfail(req,'minlength='+this._.minlength);
      if (zs4.is.number(this._.maxlength)&&input.length>this._.maxlength)return this._.zs4checkfail(req,'maxlength='+this._.maxlength);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0&&!zs4.string.array.is.element(this._.enum,input))return this._.zs4checkfail(req,'enum');
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (v==null)return null;
        if (zs4.is.string(v))return v;

        else return v.toString();
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
      str_eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)==0)return true;
        return false;
      }).bind(THIS),
      str_gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)>0)return true;
        return false;
      }).bind(THIS),
      str_lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)<0)return true;
        return false;
      }).bind(THIS),
      str_ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)>=0)return true;
        return false;
      }).bind(THIS),
      str_le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)<=0)return true;
        return false;
      }).bind(THIS),
      str_start:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        return zs4.string.startsWith(this._.value,v);
      }).bind(THIS),
      str_end:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        return zs4.string.endsWith(this._.value,v);
      }).bind(THIS),
      str_search:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        var count = this._.value.search(v);
        if (count >= 0)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.string(this._.default))this._.value=this._.default;
        else this._.value=new String();
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  text:function(input){
    if (zs4.is.object(input)){
      if (zs4.is.number(input.maxlength)){
        if (input.maxlength > zs4.const.TEXT.MAXLENGTH)input.maxlength = zs4.const.TEXT.MAXLENGTH;
        if (input.maxlength < zs4.const.STRING.MAXLENGTH)input.maxlength = zs4.const.STRING.MAXLENGTH;
      }
      else {
        input.maxlength = zs4.const.TEXT.DFTLENGTH;
      }
    }
    else{
      input = {name:'text',maxlength:zs4.const.TEXT.DFTLENGTH};
    }
    zs4.type.string.call(this,input);
    this._.typename = 'text';
  },
  type:function(){
    zs4.type.object.call(this,{name:'type',flags:'apiarg'});
    this._.typename = 'type';

  },
  um:function(input){
    zs4.type.string.call(this,input);
    this._.minlength = 3;
    this._.maxlength = 32;
    this._.typename = 'um';
    //this._.default = 'unit.one';
  },
  userscope:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'userscope';
  },
  zs4:function(){
    zs4.type.object.call(this,{name:'zs4',flags:'authgetpublic'});
    this._.typename = 'zs4';
  },
};

zs4.call = {
  api:function(input,cb){
    var req = new zs4.request({input:input});
    req.request.node = true;

    //var p = zs4.string.split.separators(path,'.');
    //var i = new Object();
    //for (var i = 0; i < p.length; i++)

    zs4.THIS._.transform(req,function(){

    });


  },

};


zs4.stat = {
  createAccumulator:function(parent,name){
    parent._.property(new zs4.type.object({name:name,flags:'noset authsetself'}))

    var ACC = parent[name];
    ACC._.property(new zs4.type.number({name:'value',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'vmin',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'vmax',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'count',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'time',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'tmin',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'tmax',flags:'authpublic noset',}));

    ACC._.stat = new Object({});
    ACC._.stat.clear = (function(){
      ACC.count._.value = ACC.value._.value = ACC.time._.value = ACC.tmax._.value = 0;
      ACC.vmin._.value = ACC.tmin._.value = 999999999999;
    }).bind(ACC);
    ACC._.stat.accumulate = (function(v,t){
      ACC.value._.value += v;
      if (ACC.vmax._.value < v)ACC.vmax._.value = v;
      if (ACC.vmin._.value > v)ACC.vmin._.value = v;

      ACC.time._.value += t;
      if (ACC.tmax._.value < t)ACC.tmax._.value = t;
      if (ACC.tmin._.value > t)ACC.tmin._.value = t;

      ACC.count._.value += 1;
    }).bind(ACC);

    ACC._.stat.clear();
  },
  createItem:function(parent,name,um){
    parent.item._.property(new zs4.type.object({name:name,flags:'noset authsetself'}));
    var ITEM = parent.item[name];

    if (zs4.is.string(um)){
      ITEM._.property(new zs4.type.um({name:'um',flags:'noset notrans nostore',default:um}));
    }

    zs4.stat.createAccumulator(ITEM,'since');
    zs4.stat.createAccumulator(ITEM,'total');

    ITEM._.stat = new Object({});
    ITEM._.stat.accumulate = (function(v,t){
      ITEM.since._.stat.accumulate(v,t);
      parent.dateto._.value = Date.now();
    }).bind(ITEM);

  },
  create:function(name){
    var BASIC = this;
    zs4.type.object.call(BASIC,{name:name,flags:'noprune authgetpublic',});
    BASIC._.name = name;

    BASIC._.property(new zs4.type.date({name:'datefrom',flags:'noset authsetself'}));
    BASIC._.property(new zs4.type.date({name:'dateto',flags:'noset authsetself'}));
    BASIC._.property(new zs4.type.object({name:'item',flags:'noset authsetself'}));

    zs4.stat.createItem(BASIC,'transform','unit.one');
    zs4.stat.createItem(BASIC,'transitem','unit.one');
    zs4.stat.createItem(BASIC,'bytesserved','information.byte');
    zs4.stat.createItem(BASIC,'emailsent','unit.one');
    zs4.stat.createItem(BASIC,'error','unit.one');
  },
  updateUser:function(req,cb){
    if (!zs4.is.string(req.request.token)
    ||!zs4.is.object(req.request.payload)
    ||!zs4.string.startsWith(req.request.payload.scope,'zs4.type.user.array.')
    ){
      zs4.debug('err: update User called for no user');
      cb(); return;
    }
    zs4.debug('stat.updateUser('+req.request.payload.scope+')');

    var a = zs4.string.split.separators(req.request.payload.scope,'._-');
    if (a.length != 5){
      zs4.debug('err: path "'+ req.request.payload.scope +'"not a user scope');
      cb(); return;
    }
    var userid = a[4];

    if (req.request.tokenlogin==true){
      zs4.debug('updateUser() tOKENloGIN');
    }

    var arr = new Array();
    for (var i = 0; i < req.request.stat.length; i++){
      if (req.request.stat[i].u == req.request.payload.scope)
        arr.push(req.request.stat[i]);
    }
    req.request.stat = new Array();
    req.request.nostat = true;
    //var json = JSON.stringify(req.request.stat);

    req.call({path:'zs4.type.user.array.'+userid+'.zs4.update',wantreply:true,input:{array:arr}},function(read){
      cb(); return;
    },true);
  },
  boot:function(input,cb){
    zs4.debug('zs4.stat.boot() is active');
    //if (input==zs4.THIS)zs4.debug('input: zs4.THIS');

    var q = new Object({zs4:{type:{price:{method:{
      query:{
        search:'',
        sort:{
          item:'zs4.head.updated',
          descend:true,
        },
        select:{
          sc:'all',
          a:{
            sc:'item',
            item:'zs4.head.owner',
            opcode:'eq',
            const:'',
          },
        }
      }
    }}}}});

    var req = new zs4.request({input:q});
    req.request.node = true;

    zs4.THIS._.transform(req,function(ret){
      var array = req.request.get.zs4.type.price.array;
      if (zs4.is.object(array)){
        //zs4.debug('query called back',array);
        for (var n in array){
          var item = array[n];
          if (!zs4.is.type(item))continue;

          var scope;
          if (item.scope._.value=='')scope = zs4.THIS;
          else {
            scope = zs4.THIS._.resolvePath(item.scope._.value);
          }
          if (!zs4.is.type(scope)||!scope._.flags.get.scope()){
            zs4.debug('no scope in price: '+item._.path);
            continue;
          }

          var scopeitem = scope._.resolvePath(item.item._.value);
          if (item.item._.value!='' && zs4.is.type(scopeitem)){
            scopeitem._.price.push(item);
            scopeitem._.flags.set.priced(true);
            zs4.debug('price \"'+item._.path+'\" attached to '+item.item._.value);
          }
          else {
            scope._.price.push(item);
            scope._.flags.set.priced(true);
            zs4.debug('price \"'+item._.path+'\" attached to scope'+scope.zs4.head.title._.value)
          }
        }
      }
      cb();
    });
  },
};

zs4.request = function(o){
  var REQUEST = this;
  this.create = function(o){
    if (!zs4.is.object(o))o=new Object();
    o.request = this.request;
    o.scope = this.scope;
    var ret = new zs4.request(o);
    //ret.parentreq = this;
    ret.flags.value = this.flags.value & this.flags.enherit;

    if (this.getall && !REQUEST.requestObject._.flags.get.nogetall()){
      ret.getall=true;
      ret.flags.value |= this.flags.prune;
    }

    if (this.noneedsaving==true)ret.noneedsaving=true;

    return ret;
  };
  const BADPATH = 'bad path';
  var THIS = this;

  if (zs4.is.object(o)){
    if (zs4.is.object(o.request))this.request = o.request;
    if (o.input!=null)this.input = o.input;
    if (zs4.is.object(o.parent))this.parent = o.parent;
    if (zs4.is.type(o.scope))this.scope = o.scope;
    if (o.getall==true)this.getall=true;
  }

  if (!zs4.is.object(this.request))this.request = new Object();

  if (!zs4.is.object(this.request.callback))this.request.callback = new Object();
  if (!zs4.is.object(this.request.get))this.request.get = new Object();
  if (!zs4.is.object(this.request.stat))this.request.stat = new Array();

  if (!zs4.is.object(this.request.rbits)){
    //this.request.rbits_value = 0;
    //this.request.rbits = new zs4.util.rbits(this.request,'rbits_value');
  }
  this.flags = new zs4.util.flags();
  this.flags.value = 0;

  this.setScope = (function(o){

    function authorize(arr){
      if (!zs4.is.array(arr)){
        return THIS.userIsRoot();
      }
      //zs4.debug(arr);
      if (zs4.string.array.is.element(arr,'zs4.public')){
        o._.print('setScope.authorized(public):',REQUEST);
        return true;
      }

      if (zs4.string.array.is.element(arr,'zs4.self')&&(THIS.flags.get.am())){
        o._.print('setScope.authorized(self):'+arr,REQUEST);
        return true;
      }
      if (zs4.string.array.is.element(arr,'zs4.owner')&&(THIS.flags.get.own())){
        o._.print('setScope.authorized(owner):'+arr,REQUEST);
        return true;
      }
      return THIS.userIsRoot();
    };

    var thisIsScope = false;
    if (o._.flags.value & this.flags.scope){THIS.scope = o;thisIsScope=true;}
    THIS.requestObject = o;

    THIS.flags.value = 0;
    var am = THIS.am(o);
    var own = THIS.own(o);
    //own |= this.userIsRoot();

    THIS.flags.set.am(am);
    THIS.flags.set.own(own);

    if (o._.price.length>0)THIS.flags.set.priced(true);
    else THIS.flags.set.priced(true);

    if (thisIsScope && o.zs4.head.bits._.bits.public.get()){
      THIS.flags.set.authget(true);
    }
    else if (o._.flags.get.authgetpublic()||(am||own)){
      THIS.flags.set.authget(true);
    }
    else if (THIS.tokenExists()&&o._.flags.get.authgetuser()){
      THIS.flags.set.authget(true);
    }
    else {
      THIS.flags.set.authget(authorize(o._.authGet));
    }

    if (o._.flags.get.authsetpublic()){
      THIS.flags.set.authset(true);
    }
    else if ((am||own) && o._.flags.get.authsetself()){
      THIS.flags.set.authset(true);
    }
    else if (THIS.tokenExists()&&o._.flags.get.authsetuser()){
      THIS.flags.set.authset(true);
    }
    else {
      THIS.flags.set.authset(authorize(o._.authSet));
    }

    if (am||own){
      THIS.flags.set.authgetauth(true);
      if (own){
        THIS.flags.set.authsetauth(authorize(o._.authSetAuth));
      }
    }

    if (this.userIsRoot()){
      THIS.flags.set.authroot(true);
      THIS.flags.set.authget(true);
      THIS.flags.set.authset(true);
      THIS.flags.set.authgetauth(true);
      THIS.flags.set.authsetauth(true);
      THIS.flags.set.own(true);
    }
    o._.print('setScope() req.flags = \''+THIS.flags.getString()+'\'',REQUEST);
  }).bind(this);
  this.resolvePath = function(o,r){
    if (!zs4.is.type(o)){
      debugger;
      zs4.debug('object is not a type.');
      zs4.debug(o);
      return null;
    }
    return this.callbackPath(o._.path,r);
  };
  this.callbackPath = function(p,r){
    var a = zs4.string.split.separators(p,'.');
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }
    return r;
  };
  this.error = function(o,error,starttime){
    if (starttime==null)starttime = Date.now();

    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      zs4.debug(BADPATH);
      return null;
    }
    r.error = {text:'unknown error',}

    if (zs4.is.object(error)){
      if (zs4.is.string(error.text)){r.error.text = error.text.trim();}
      if (error.data!=null) r.error.data = error.data;
    }
    else if (zs4.is.string(error)){
      r.error.text = error;
    }
    else {
      r.error.data = error;
    }
    o._.print(o._.path + '.error() scope.flags:'+this.flags.getString() +' error:' + JSON.stringify(this.request.callback))
    if (zs4.is.type(this.scope)){
      this.scope.zs4.head.stat.item.error._.stat.accumulate(1,(Date.now()-starttime));
    }
    return r;
  };
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      zs4.debug(BADPATH);
      return null;
    }
    r.result = result;

    o._.print('result: '+JSON.stringify(this.request.callback));

    return r;
  };
  this.internalResultPath = function(o){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      o._.print(BADPATH);
      return;
    }

    if (!zs4.is.object(r._))r._ = new Object();
    return r._
  };
  this.getAll = function(){
    this.getall=true;
    this.flags.set.prune(true);
  };
  this.get = function(o,result){
    var get = this.resolvePath(o,this.request.get);
    if (!zs4.is.object(get._)) get._ = new Object();
    return get;
  }
  this.stat = function(item,data,time){
    var a = this.request.stat;
    //if (this.request.nostat==true){
    //  zs4.debug('no stats anymore');
    //}

    //if (zs4.is.number(data.emailsent)){
    //  zs4.debug('EMAIL SENT objeCT',data);
    //}
    if (zs4.is.type(this.scope)&&zs4.is.type(item)){

      for (var name in data){
        //if (name=='bytesserved')zs4.debug('REQUEST.stat('+this.scope.zs4.head.typename._.value+'), '+name)
        //if (name=='emailsent')zs4.debug('REQUEST.stat('+this.scope.zs4.head.typename._.value+'), '+name)
        if (zs4.is.type(this.scope.zs4.head.stat.item[name])){
          //zs4.debug('REQUEST.stat('+this.scope.zs4.head.typename._.value+'), '+name)
          this.scope.zs4.head.stat.item[name]._.stat.accumulate(data[name],time);
        }
      }

      var u = THIS.getUserPath();
      //var p = THIS.requestObject._.path;
      var p = item._.path;

      var nu = new Object({
        p:p,
        d:data,
        u:u,
      })

      //if (item._.price.length > 0){
      //  zs4.debug('req.stat -- PRICE ----> item:   '+p);
      //  zs4.debug('req.stat -- PRICE ----> data:   '+data);
      //  zs4.debug('req.stat -- PRICE ----> user:   '+u);
      //}

      var a = THIS.request.stat;
      for (var i = 0 ; i < a.length; i++){
        if (a[i].p==nu.p && a[i].u==nu.u){
          for (var n in nu.d){
            if (n=='u'||n=='p')continue;
            if (a[i].d.hasOwnProperty(n)){a[i].d[n]+=nu.d[n];}
            else a[i].d[n] = nu.d[n];
            return;
          }
        }
      }
      a.push(nu);
    };
  };

  this.resolveInputPath = function(p){

    if (!zs4.is.object(this.input))this.input = new Object();
    var a = zs4.string.split.separators(p,'/\\.-_');
    //zs4.debug('resolveInputPath('+a+')');

    var r = this.input;
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }

    //zs4.debug('resolveInputPath('+p+') = '+JSON.stringify(r));
    return r;
  }

  if (zs4.is.node()){

    //if (!zs4.is.object(this.request.userstat))this.request.userstat = new zs4.stat.create('userstat');

    this.call = (function(args,cb,rootAuthority){
      var THIS = this;
      var request;

      if (rootAuthority==null && args.root == true)rootAuthority=true;

      if (args.wantreply){
        request = new zs4.request();
        if (this.tokenExists()){
          request.request.token = this.request.token;
          request.request.payload = this.request.payload;
        }
      }
      else {
        zs4.debug('args.wantreply==0');
        request = new zs4.request({request:{node:true,}});
      }

      var path = args.path;
      var input = args.input;
      var inp = request.resolveInputPath(path);

      for (var n in input)inp[n]=input[n];

      if (args.wantreply){
        request.request.get = this.request.get;
        request.request.callback = this.request.callback;
        request.request.stat = this.request.stat;
      }

      if (rootAuthority==true) {
        zs4.debug('internal request with root authority');
        request.userIsRoot = request.forceUserIsRoot;
      }
      else if (this.userIsRoot==this.forceUserIsRoot){
        zs4.debug('internal SUB-request with root authority');
        request.userIsRoot = request.forceUserIsRoot;
      }

      request.process(function(){
        if (request.tokenExists()){
          THIS.request.token = request.request.token;
          THIS.request.payload = request.request.payload;
        };
        cb(THIS.callbackPath(path,request.request.callback));
      });


    }).bind(this);

    this.payloadRefresh = function(){
      if (zs4.is.string(this.request.token)&&this.request.token.length>10){
        this.request.payload = zs4.THIS.zs4.token.decode(this.request.token);
        if (zs4.is.object(this.request.payload)){
          return;
        }
      }
      this.request.token=null;
      this.request.payload=null;
    };
    this.payloadRefresh();

    this.tokenCreate = function(nuload){
      //zs4.debug('this.tokenCreate');
      this.request.token = zs4.THIS.zs4.token.encode(nuload);
      this.payloadRefresh();
    };

    this.tokenDelete = function(){
      //zs4.debug('TOKEN DELETED!!!!!!!!!!');
      this.request.token=null;
      this.request.payload=null;
    };

    this.tokenExists = function(){
      if (this.request.token!=null&&this.request.payload!=null)return true;
      return false;
    }

    if (!zs4.is.boolean(this.request.needsSaving)) this.request.needsSaving = false;

    //this.request.reget = null;

    this.forceUserIsRoot = function(){
      //zs4.debug('request.userIsRoot() called returning "true"....');
      return true;
    };

    this.getUserPath = function(){
      if (this.request.node) return null;
      if (zs4.is.object(this.request.payload)){
        if (zs4.is.string(this.request.payload.scope)){
          return this.request.payload.scope;
        }
      }
      return null;
    };

    this.userIsRoot = function(){
      if (this.request.node) return true;
      if (zs4.is.object(this.request.payload)){
        if (zs4.is.string(this.request.payload.scope)){
          if (this.request.payload.scope=='')return true;
        }
      }
      if (zs4.string.endsWith(zs4.THIS.zs4.email.smtp.user._.value,'@zs4.zs4')
      && (zs4.THIS.zs4.password.hashed._.value == ''))return true;
      return false;
    };

    this.am = function(THIS){
      if (!zs4.is.object(this.request.payload))return false;
      if (this.request.payload.scope==this.scope._.path){
        THIS._.print('req.am said \'zs4.self\'',REQUEST);
        return true;
      }
      return false; //this.userIsRoot();
    };

    this.own = function(THIS){
      if (!zs4.is.object(this.request.payload))return false;
      if (zs4.string.startsWith(this.scope._.path,this.request.payload.scope)
      &&this.scope._.path.length>this.request.payload.scope.length){
        THIS._.print('req.am said zs4.owner');
        return true;
      }
      if (this.scope.zs4.head.owner._.value == this.request.payload.scope){
        THIS._.print('req.am said zs4.owner');
        return true;
      }
      return false; //this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;

      if (this.getall||(zs4.is.object(this.input)&&zs4.count.object.properties(this.input)==0)){
        if (zs4.is.object(this.request.payload)&&zs4.is.string(this.request.payload.scope)){
          zs4.debug('REQUEST FROM USER \''+this.request.payload.scope+'\'',JSON.stringify(this.input))
          var userpath = this.resolveInputPath(this.request.payload.scope);
          //zs4.debug('userpath: '+userpath);
          this.getAll();
        }
      }

      //zs4.debug(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){

        if (THIS.request.needsSaving){
          var now = Date.now();
          if (zs4.THIS.zs4.head.created._.value == 0)zs4.THIS.zs4.head.created._.value=now;
          zs4.THIS.zs4.head.updated._.value=now;
          zs4.save(function(){
            zs4.debug('THIS was saved');
            cb(this);
          });
        }
        else {
          cb(this);
        }
      });
    };

    this.getReply = function(){
      var r = new Object({request:{},input:this.input,reply:this.request.get,});
      r.request.callback = this.request.callback;
      if (zs4.is.object(this.request.payload)){
        //zs4.debug('request.getReply() FOUND PAYLOAD');
        this.tokenCreate(this.request.payload);
      }
      if (zs4.is.string(this.request.token)){
        //zs4.debug('request.getReply() FOUND TOKEN');
        r.request.token = this.request.token;
        r.request.scope = this.request.payload.scope;
      }

      r.request.stat = this.request.stat;

      return r;
    };

    if (zs4.is.object(o)&&o.html!=null&&zs4.is.string(o.path)){
      //zs4.debug('REQUEST RECOGNIZED AS REDIRECT',o,zs4.is.string(o.token),o.token.length);
      this.html = true;
      if (zs4.is.string(o.token)&&o.token.length>10){
        this.request.token = o.token;
        this.payloadRefresh();
        zs4.THIS._.print('TOKEN FROM NAVIGATION POST');
      }
      var input = this.resolveInputPath(o.path);
      input.getHTML = new Object();
      //zs4.debug(this.request.token,this.request.payload);
    }
    else {
      this.html = false;
    }

  }
  else{
    if (!zs4.is.object(this.request.window)){
      this.request.window = {
        navigator:{
          appName:window.navigator.appName,
          appCodeName:window.navigator.appCodeName,
          product:window.navigator.product,
          platform:window.navigator.platform,
        },
        screen:{
          width:window.screen.width,
          height:window.screen.height,
        },
      };
    }
    this.userIsRoot = function(){return true;};

    this.authorize = function(THIS,arr){return true;};

    this.request.needsSaving = false;

    this.process = function(cb){

    }
  }
};

zs4.THIS = new zs4.type.scope();
zs4.THIS._.flags.set.authgetpublic(true);

zs4.plugin = new Object({
  list:new Object(),
  static:new Array(),
  style:new Array(),
  script:new Array(),
  app:new Object(),
});

zs4.module = new Array();
zs4.scriptToConstructor = function(script){
  var body = '\'use strict\';\n';
  if (zs4.is.window()){
    //body += 'var zs4 = window.zs4\n';
  }
  else if (zs4.is.node()){
    //body += 'var zs4 = zs4\n';
  }
  body += '{'+script+'}\n';

  try {
    return new Function('zs4',body);
  }
  catch(err) {
    return null;
  }
}
zs4.require = function(path,cb,force){

  var header;

  if (zs4.is.window){
    zs4.THIS.zs4.require._.submit({path:path},function(ret){
        if (ret==null||ret.result==null||!zs4.is.string(ret.result)){ if (cb)cb(null);}
        console.log(ret.result);

        cb(zs4.scriptToConstructor(ret.result));
    })
  }
  if (zs4.is.node){
    var data = fs.readFile(path,'utf8');
  }

  return path;
};


if (zs4.is.window()){
  zs4.throttle = {
    q:[],
    w:[],
    k:false,
    f:function(){
      if (zs4.throttle.q.length == 0){
        if (zs4.throttle.w.length > 0){
          var j = zs4.throttle.w.shift();
          j.f();
          if (zs4.is.function(j.cb)) j.cb();
          setTimeout(zs4.throttle.f,0);
          return;
        }
        setTimeout(zs4.throttle.f,5);
        return;
      }
      var j = zs4.throttle.q.shift();
      j.f();
      if (zs4.is.function(j.cb)) j.cb();
      if (zs4.throttle.k==false)
        setTimeout(zs4.throttle.f,0);
    },
    job:function(f,cb){
      zs4.throttle.q.push(new Object({f:f,cb:cb,}));
      return;
    },
    onidle:function(f,cb){
      zs4.throttle.w.push(new Object({f:f,cb:cb,}));
      return;
    },
  };
  setTimeout(zs4.throttle.f,0),

  zs4.window ={
    onresize:new Array(),
    width:window.screen.width,
    height:window.screen.height,
  };

  zs4.io = {
    ajax:function(u,cb){
      this.bindFunction=function(caller,o) {return function(){ return caller.apply(o,[o]);};};this.stateChange=function(o){if (this.request.readyState==4)this.cb(this.request.responseText);};this.getRequest=function(){if (window.ActiveXObject)return new ActiveXObject('Microsoft.XMLHTTP');else if(window.XMLHttpRequest)return new XMLHttpRequest();return false;};this.postBody=(arguments[2]||"");this.cb=cb;this.u=u;this.request=this.getRequest();if(this.request){var req=this.request;req.onreadystatechange=this.bindFunction(this.stateChange,this);if (this.postBody!==""){req.open("POST",u,true);req.setRequestHeader('Content-type','application/json');} else{req.open("GET",u,true);}req.send(this.postBody);}
    },
    get:function(u,cb){
      this.ajax(u,function(d){if(cb!=null)cb(d);});
      return ('this.ajax(\''+u+'\',cb)');
    },
    post:function(o,cb){
      this.ajax('/',function(d){
        if(cb!=null){
          cb(JSON.parse(d));
        }else{
          //zs4.debug(d);
        }
      },JSON.stringify(o)
      );
      //return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
    },
  };

  zs4.navigate = function(path){
    if (!zs4.string.startsWith(path,'/')) path = ('/'+path);
    window.location.replace(path);
  }
  zs4.post = function(o,cb,getall){

    var req = new zs4.request({input:o})

    if (!zs4.THIS._.zs4check(req,o)){
      zs4.debug('zs4.post() not valid');
      zs4.debug(req);
      zs4.THIS._.dcb(req,req.request.callback);
      if (cb) cb(req); return;
    }

    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10){
      req.request.token = zs4.THIS._.token;
    }
    else if (zs4.is.string(zs4.window.token)&&zs4.window.token.length>10){
      req.request.token = zs4.window.token;
    }
    else {
      req.request.token = null;
    }
    zs4.debug(req);

    if (getall==true){
      req.getall = true;
    }

  	zs4.io.post(req,function(ret){
      if (zs4.is.string(ret.request.token)&&ret.request.token.length>10&&zs4.is.string(ret.request.scope)){
        zs4.THIS._.token = ret.request.token;
        zs4.THIS._.scopath = ret.request.scope;
        zs4.THIS._.loggedIn = true;
      }
      else {
        zs4.THIS._.token = null;
        zs4.THIS._.scopath = null;
        zs4.THIS._.loggedIn = false;
      }
      zs4.debug(ret);
  		zs4.THIS._.got(ret,ret.reply);
      zs4.THIS._.dcb(ret,ret.request.callback);
  		if (cb) cb(ret);
      else zs4.debug('no callback specified for zs4.post()');
  	});
  };

  zs4.loaddata = function(url,cb){
    zs4.io.get(url,cb);
  }

  zs4.loadscript = function(url){
    var js=document.createElement('script');
    js.setAttribute("type","text/javascript");
    js.setAttribute("src", url);
    document.head.appendChild(js);
  };

  zs4.loadcss = function(url){
    var css=document.createElement("link")
    css.setAttribute("rel", "stylesheet")
    css.setAttribute("type", "text/css")
    css.setAttribute("href", url);
    document.head.appendChild(css);
    return css;
  };

  zs4.style = {

    refresh:function(){
      zs4.style.element.innerHTML = '';
      var width = window.screen.width;
      var height = window.screen.width;

      var em = 18;
      if (bowser.mobile==true)em *= 4;
      //var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
      //sheet += '.fouc{opacity:0}\n';

      var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
      sheet += zs4.style.sheet;
      zs4.style.element.appendChild(document.createTextNode(sheet));
    },
  };

  zs4.style.element = document.createElement('style');
  document.head.appendChild(zs4.style.element);

  zs4.style.refresh();

  window.onresize = function(){
    var width = window.screen.width;
    var height = window.screen.width;
  };

}
