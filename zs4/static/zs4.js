'use strict';

var isWindow = new Function("try {return this===window;}catch(e){ return false;}");
var isNode = new Function("try {return this===global;}catch(e){return false;}");

var zs4;
zs4 = new Object();
if (isNode()) {
    zs4 = exports;
}
else {
    zs4 = new Object();
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
  },
};

zs4.console = {
  arr:[],
  on:true,
  log:function(v){
    if (this.on)console.log(v);
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
            //console.log(n+' is function.');
            continue;
          }
          if (zs4.is.object(f[n])){
            if(c(f[n]))continue;
            //console.log(n+' is object.');
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
    console.log('path resolved: '+path);
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
        //console.log('inside '+cb_this);
        this[foo_next](this[cb_next]);
      }).bind(this);

      this[foo_this] = function(cb){foo.call(THIS,arg,cb);};
      this.count++;
    };
    this.run = function(cb){
      if (this.count==0){cb(this);return;}
      var cb_end = 'cb'+(this.count-1);
      this[cb_end] = (function(){
        //console.log('inside '+cb_end);
        cb(this);
      }).bind(this);

      this.foo0(this.cb0);
    };
  },
  parallel:function(){
    this.callback = (function(){
      //console.log('parallel callback '+this.count);
      this.count--;
      if (this.count==0){
        //console.log('all parallels ('+this.arr.length+') complete');
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
      //console.log('running parallel');
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
    this.addFlag('bits',0x80000000);

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
      if (int & this.bits) addFlag('bits');


      return ret;
    };

    this.setString = function(s){
      //console.log(this.value);
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        //console.log(a[i]+': ');
        if (zs4.is.function(this.set[a[i]])){
          //console.log('  ...is a function');
          this.set[a[i]](true);
        }
      }
      return this.value;
    };

  },
  bits:function(po,name){
    const BITLIMIT = 48;
    const BITMASK = 0x0ffffffffffff;

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
        //console.log(a[i]+': ');
        if (zs4.is.object(this[a[i]])&&zs4.is.number(this[a[i]].m)){
          //console.log('  ...is a function');
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
};

zs4.folder = new Object();
zs4.array = new Object();

if (zs4.is.node())zs4.node = new Object({require:{}});

zs4.type = {

  unknown:function(input){
    //console.log('object()');
    //debugger;
    if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
      return new zs4.error({text:'bad input',data:input});
    }

    this._ = new Object();
    this._.path = '';
    this._.name = input.name;
    //if (zs4.is.boolean(input.required))this._.required = input.required; else this._.required = true;

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
      console.log('ZS4 CHECK FAIL!!!: '+ this._.path+' error:'+text);
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

      //console.log(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //console.log(this._.path+'.NO_store()');
        return null;
      }
      //console.log(this._.path+'.actually_store()');

      //console.log(this._.path+'value_store('+this._.typename +')');
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
        //console.log('FROM CONSTRUCTIST!!!!');
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
      //console.log('this.shouldBeSaved()');
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

      if (zs4.is.type(this._.inscope)&&this._.inscope._.flags.get.scope())
        get._.inscope = this._.inscope._.path;

      if (this._.flags.get.noprune())req.flags.set.prune(false);

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

      if (!req.flags.get.authset()
      ||  this._.flags.get.noset()
      ){
        get._.flags |= req.flags.noset;
        get._.flags &= (~(req.flags.api));
      }

      this._.print('getinit: \''+req.flags.getString(get._.flags)+'\'',req);

      return get;

    }).bind(this);
    this._.get = (function(req,po){
      var get = this._.getInitialize(req);
      if (get == null) return null;
      if (this._.type != Object){
        get._.value = this._.value;
      }
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
      //console.log(this);
      if (!zs4.is.type(o))return;

      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        console.log('this._.name:'+this._.name+',o._.name: '+o._.name);
        console.log('this._.typename:'+this._.typename+',o._.typename: '+o._.typename);
        console.log('missmatching type or name');
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
          //console.log('got inscope: \''+o._.inscope+'\'');
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
          //console.log('pruning '+this._.path);

          for (var n in this){
            if (!zs4.is.type(this[n]))continue;

            //this[n]._.flags.set.nodisplay(false);

            if (zs4.is.type(o[n]))continue;

            if (!this[n]._.flags.get.noprune()){
              //console.log('pruning '+this[n]._.path);
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
        if (zs4.is.function(o._.response)){
          //console.log('response() function found for '+o._.path);
          o._.response(o._.value);
        }
      }
      //else {
      //  console.log('value without parent.')
      //}
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
                  zs4.console.log(input._.console.output[i]);
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
            //console.log('NAV: '+input.result.goscope);
            zs4.navigate(input.result.goscope);
          }
        }
      }
    }).bind(this);

    this._.getHTML = (function(req){
      console.log('getHTML('+this._.path+')');
      var title = this._.path;
      var description = '';
      var keywords = '';
      if (title=='')title = 'zs4 web app';
      if (this._.flags.get.scope()&&zs4.is.object(this.zs4.head)){
        console.log('gettin scope.head html...');
        // title
        if (this.zs4.head.title._.value!=''){
          title = zs4.string.strip.chars(this.zs4.head.title._.value,zs4.const.NOATTRCHARS);
        }

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
      var html = '<!DOCTYPE html>\n';
      html += '<html>\n';
        html += ' <head>\n';
          html += '<meta charset="UTF-8">\n';
          html += '  <title>'+title+'</title>\n';
          if (description != ''){
            html+= '  <meta name="description" content="'+description+'">\n';
          }
          if (keywords != ''){
            html+= '  <meta name="keywords" content="'+keywords+'">\n';
          }
          if (req.request.token&&req.request.payload){
            html += '  <script>window.token=\''+req.request.token+'\'</script>\n';
          }
          html += '  <script src="/bowser.min.js"></script>\n';
          html += '  <script src="/zs4.js"></script>\n';
          html += '  <script>zs4.location.path=\''+this._.path+'\';;</script>\n'
          for (var i = 0 ; i < zs4.plugin.script.length ; i++){
            html += '  <script src="/' + zs4.plugin.script[i] + '"></script>\n';
          }

          for (var i = 0 ; i < zs4.plugin.style.length ; i++){
            html += '  <link rel="stylesheet" href="/' + zs4.plugin.style[i] + '">\n';
          }


        html += ' </head>\n';
        if (true){
          html += ' <body onload="zs4.admin()">\n';
          html += ' </body>\n';
        }
      html += '</html>\n';
      req.request.html = html;
      this._.print('HTML RESPONSE FROM '+this._.path,req);
      //console.log(html);
      return(html);
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
        zs4.console.log(r);

        if (zs4.is.node()&&req != null){

          //console.log('pushing ')
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

          //console.log(req.input._[n]);
          if (req.input._.auth.type == 'getauth'){
            if (am||own){
              if (zs4.is.string(req.input._.auth.add)&&req.input._.auth.add.length>0){
                //console.log('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authGet,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //console.log('removing auth '+req.input._.auth.remove);
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
                //console.log('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authSet,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //console.log('removing auth '+req.input._.auth.remove);
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
                //console.log('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authGetAuth,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //console.log('removing auth '+req.input._.auth.remove);
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
                //console.log('adding auth '+req.input._.auth.add);
                zs4.string.array.add.new(this._.authSetAuth,req.input._.auth.add);
                this._.shouldBeSaved(req);
              }
              if (zs4.is.string(req.input._.auth.remove)&&req.input._.auth.remove.length>0){
                //console.log('removing auth '+req.input._.auth.remove);
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
            console.log('console: '+JSON.stringify(req.input._) + '  req.input._.console.switch:'+req.input._.console.switch);
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

            //console.log('transformInternal() returns '+JSON.stringify(res.result._));
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

        var a = zs4.string.split.spaces(s);
        if (a.length==0)return true;
        for (var i = 0 ; i < a.length;i++){
          if (this._.value.toLowerCase().search(a[i].toLowerCase())>=0)return true;
        }
        return false;
      }

      return false;
    }).bind(this);

    this._.transformValue = (function(req,cb){
      this._.print('transform('+req.input+')',req);
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}

      console.log(this._.path + '.transformValue() //'+ this._.flags.getString());
      console.log(req.flags.getString());
      console.log(req.flags.get.authset());
      //console.log(req.scope);
      console.log(this._.flags.getString());

      if (req.flags.get.authset()){
        if (!this._.zs4check(req,req.input)){
          this._.get(req,req.parent);cb();return;
        }
        //console.log(this._.path+'._.transform(\''+req.input+'\')');
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
            req.result(this,v);
          }
        }
      }
      else{
        console.log('returning error (not authorized)')
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
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var id in input)if(zs4.is.object(input[id])){

        var nu = THIS.template._.new();
        nu._.name = id; nu._.flags.set.notrans(false);
        nu._.flags.set.scope(true);

        THIS.array._.property(nu);

        THIS.array[id]._.load(input[id]);

        //console.log('load('+THIS.array[id]._.path+')')
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
      //console.log('elementLoad '+this._.path+'.'+req.elenam);

      if (THIS.array._.value.hasOwnProperty(req.elenam)){
        var ret = new Object();
        zs4.copy.trim(THIS.array._.value[req.elenam],ret);
        cb(ret);return;
      }
      cb(null);
    }).bind(THIS.array);
    THIS.array._.elementSave = (function(req,cb){
      //console.log('elementSave '+this._.path+'.'+req.elenam);
      THIS.array._.value[req.elenam] = req.elesav;
      THIS.array._.shouldBeSaved(req);
      cb();
    }).bind(THIS.array);
    THIS.array._.driverTransform = (function(req,cb){
      console.log(req.elenam);
      zs4.array[THIS.config.driver._.value].getID.call(THIS,req.elenam,function(ret){
        if (ret == null){req.error(THIS.array,req.elenam+' not found');cb();return;}

        var item = THIS.template._.new();
        item._.name = req.elenam;
        item._.load(ret);
        THIS._.array.elementConnect(THIS.array,item);

        item._.transform(req,function(){
          zs4.array[THIS.config.driver._.value].updateID.call(
          THIS,req.elenam,item._.store(),
          function(ret){
            if (ret == null){req.error(THIS.array,req.elenam+' update fail');cb();return;}
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
      //console.log('checking uniqueness of: '+type._.path+':'+value);
        if  (!type._.flags.get.unique()){
          //console.log('not a unique property: '+type._.name);
          return true;
        }

        var spath = type._.scope._.path;
        var tpath = type._.path;
        var vpath = tpath.substring((spath.length+1),(tpath.length));
        //console.log('checking uniqueness of: '+vpath);
        var arr = THIS.array._.value;
        for (var n in arr){
          var v = zs4.path.resolve(arr[n],vpath);
          if (v == null){
            //console.log(n+'.'+vpath+' NOT FOUND!!!!!');
            continue;
          }
          if (v==value){
            //console.log(n+'.'+vpath+' MATCH '+v+' and '+value);
            if (n!=type._.name)return false;

          }
        }
        return true;
    };

    THIS.array._.callback = (function(o){
      //console.log('THIS.array._.callback()');
      //console.log(o);
      if (zs4.is.object(o.result)){
        if (o.result.deleteall==true){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            console.log('deleting '+THIS.array[n]._.path);

            if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
            delete THIS.array[n];
          }

        }
        if (zs4.is.array(o.result.deletearr)){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            if (!zs4.string.array.is.element(o.result.deletearr,n))continue;
            console.log('deleting '+THIS.array[n]._.path);

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
        if (!req.tokenExists()){
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
            nu.zs4.head.title._.value = '(untitled)';
            nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();
            nu.zs4.head.owner._.value = req.request.payload.scope;
            zs4.array[THIS.config.driver._.value].new.call(THIS,nu,function(ret){
              if (zs4.is.type(ret)){
                THIS._.array.elementConnect(THIS.array,ret);

                ret._.transform(REQUEST.create({input:{}}),function(){

                  REQUEST.result(NEW,ret._.path);
                  console.log('DB CREATED ',ret._.path);

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

            console.log('END DB DRIVER NEW FUNCTION');
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
          //console.log(QUERY._.path+'.transform()',req.input);

          if (zs4.count.object.properties(req.input)==0){
            console.log(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }

          var sel = null;
          if (zs4.is.object(REQUEST.input.select)){
            //console.log('QUERY-SELECT: ',JSON.stringify(REQUEST.input.select,null,1));
            sel = new zs4.type.select();
            sel._.parse(REQUEST.input.select);
          }
          else {
            //console.log(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }
          var search = null;
          if (zs4.is.string(REQUEST.input.search)&&REQUEST.input.search!=''){
            search = REQUEST.input.search;
          }

          console.log(QUERY._.path+'.transform()',REQUEST.input);

          if (THIS.config.driver._.value != ''){
            var args = new Object({request:req,select:sel,search:search,sort:REQUEST.input.sort,});
            zs4.array[THIS.config.driver._.value].query.call(THIS,args,function(ret){
              if (!zs4.is.array(ret)){

              }
              else {
                //console.log(ret);
              }

              QUERY._.get(req);
              THIS.array._.get(req);
              cb();
            });

            return;
          }
          else {
            for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
              //console.log(this._.path+'.'+n+'.query()');
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
          console.log(this._.path+'.transform('+JSON.stringify(req.input)+')');
          if (req.input.sure!=true){
            req.error(this,{text:'not sure'});
            return get();
          }
          console.log(this.sure);

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
      console.log('bye('+THIS._.path+')');
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
      //console.log('deleteall._.callback()');
      //console.log(o);
      if (zs4.is.boolean(o.result)&&o.result==true){
        zs4.navigate('/');
      }
    }).bind(this);

    THIS._.get = (function(req,po){
      //console.log('password.get'+ JSON.stringify(this._.authGet));
      if (!req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        console.log(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //console.log(this._.authGet);
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
      console.log('loading '+this._.path,input);
      if (!zs4.is.object(input))return;
      for (var n in input){
        var name = (' '+n+' ').trim();

        if (input[name].hasOwnProperty('content')&&zs4.is.string(input[name].content)){
          console.log('   FILE: \''+name+'\'')
          DRIVE._.property(new zs4.type.file({name:name}));
          DRIVE[name]._.load(input[n]);
        }
        else if (zs4.is.object(input[name].zs4)&&input[name].zs4.hasOwnProperty('driver')){
          console.log('   FOLDER: \''+name+'\'')
          DRIVE._.property(new zs4.type.folder({name:name}));
          DRIVE[name]._.load(input[n]);
        }

        this[n]._.load(input[n]);
      }
    }).bind(DRIVE);

    DRIVE._.callback = (function(o){
      console.log('DRIVE._.callback()');
      console.log(o);
      if (zs4.is.object(o.result)){
        if (zs4.is.string(o.result.delete)){
          if (DRIVE.hasOwnProperty(o.result.delete)){
            if (zs4.is.type(DRIVE[o.result.delete])){
              console.log('deleting '+o.result.delete);

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
      this._.property(new zs4.type.string({name:'owner',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'typename',flags:'noset index noprune authgetpublic nostore',}));
      this._.property(new zs4.type.integer({name:'created',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.integer({name:'updated',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'doctype',flags:'index noprune quickupdate authgetpublic',}));
      this._.property(new zs4.type.scopebits({name:'bits',flags:'index noprune quickupdate authgetpublic authsetself',}));
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

        console.log(req.input);

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
            console.log('attempting to email token to address '+req.input.email);
            if (zs4.THIS.zs4.email.smtp.configured._.value!=true){
              req.error(THIS,'internal configuration error');
              THIS._.get(req); cb(); return;
            }

            req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
              console.log(callback);
              if (callback.error != null){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              };
              if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              }

              var USERPATH = callback.result;

              var token = zs4.THIS.zs4.token.encode({iss:'zs4.email.message',scope:callback.result,});

              var message = new Object({
                to:req.input.email,
                subject:zs4.THIS.zs4.express.host._.value+' access token.',
                text:'Click here for automatic login: '+zs4.THIS.zs4.express.getHostURL()+'?token='+token});

              req.call({path:'zs4.email.message',input:message,},function(backcall){
                console.log('response from zs4.email.message',backcall);
                if (backcall.error != null){
                  req.error(THIS,'');
                  THIS._.get(req); cb(); return;
                };

                if (backcall.result != null){
                  console.log('SO THERE IS A RESULT!!!',backcall);
                  req.call({path:USERPATH+'.zs4.password',input:{reset:true}},function(resetcb){
                    console.log(USERPATH+'.zs4.password: RESET!!!');
                    req.result(THIS,backcall.result);
                    THIS._.get(req); cb(); return;
                  });
                }
                else {
                  req.error(THIS,'send message failure');
                  THIS._.get(req); cb(); return;
                }

              },true);

            },true);
            return;
          }
          else {
            req.error(this,'no password');
            THIS._.get(req); cb(); return;
          }
        }

        if (req.input.email==zs4.THIS.zs4.email.smtp.user._.value){
          req.call({path:'zs4.password',input:{vfy:req.input.password,}},function(callback){
            if (callback.error != null){
              req.error(THIS,'');
              THIS._.get(req); cb(); return;
            };

            if (!req.tokenExists()){
              req.error(THIS,'login failed');
              THIS._.get(req); cb(); return;
            }

            console.log('GOSCOPE ROOTSCOPE');
            req.result(THIS,{goscope:''});
            THIS._.get(req); cb(); return;
          });
        }

        req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
          //console.log(callback);
          if (callback.error != null){
            console.log('zs4.type.user.method.getone('+req.input.email+') failed: ',callback);
            req.error(THIS,req.input.email+' not found.');
            THIS._.get(req); cb(); return;
          };
          if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
            req.error(THIS,'not found');
            THIS._.get(req); cb(); return;
          }

          console.log('calling: '+callback.result+'.zs4.password');
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

            console.log('GOSCOPE '+userpath);
            req.result(THIS,{goscope:userpath});
            THIS._.get(req); cb(); return;
          });
        },true);
      }).bind(this);
    }

    THIS._.get = (function(req,po){
      //console.log('password.get'+ JSON.stringify(this._.authGet));
      if (req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        console.log(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //console.log(this._.authGet);
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
  name:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'name';
    this._.minlength = 1;
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
      //console.log(this.path+'.load(\''+input+'\')');

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

        console.log('ADD SCHEMA FAILURE!!!!!  ');
        console.log(ns);
        return null;
      }
      //console.log('adding '+ns._.name+' to '+this._.path);
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
            //console.log(ns._.name+'.'+n);
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
      if (zs4.is.object(req.input)&&zs4.is.object(req.input.getHTML)){
        this._.print('getHTML() '+zs4.json.stringify(input),req);
        this._.getHTML(req);
        this._.get(req); cb(); return;
      }

      if (this._.flags.get.nogetall()){
        //console.log(this._.path+' NOGETALL');
      }

      var empty_input_object = false;
      if (zs4.is.object(req.input)){
        if (zs4.count.object.properties(req.input)==0){
          empty_input_object = true;
          if (!this._.flags.get.nogetall()){ req.getAll(); }
        }
      }

      if (this._.name == 'array'){
        //console.log(this._.path+'.transform()',this._.flags.getString());
        //console.log(req.flags.getString());
      }

      if (empty_input_object&&req.getall&&this._.flags.get.nogetall()) {
        //console.log(this._.path+' NOGETALL');
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
            parallel.call(this[n],this[n]._.transform,req.create({input:null,parent:this,}));
          }
        }
        else if (zs4.is.object(req.input)&&!this._.flags.get.notrans()){
          parallel.call(this[n],this[n]._.transform,req.create({input:req.input[n],parent:this,}));
        }
      }

      parallel.run(function(){
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
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        this[n]._.load(input[n]);
      }
    }).bind(this);
    this._.store = (function(){

      //console.log(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //console.log(this._.path+'.NO_store()');
        return null;
      }
      //console.log(this._.path+'.actually_store()');

      //console.log(this._.path+'.object_store('+this._.typename +')');
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
      //console.log(type);
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          if (item[n]._.type != Object){
            //console.log('getScopeItems-recurse '+item[n]._.path);
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
              response.push(new Object({label:val,value:val}));
            }
          }
          else {
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

          console.log('getUserScopes('+item[n]._.path+') ? ')
          item[n]._.print('getUserScopes');

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            console.log('getUserScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            console.log('getUserScopes('+item[n]._.path+') VALID!')

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
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          //console.log('getAllScopes('+item[n]._.path+') ? ')
          item[n]._.print('getAllScopes');

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            //console.log('getAllScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            //console.log('getAllScopes('+item[n]._.path+') VALID!')
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
          console.log('zs4.search('+req.input.owner+')')
          query.select.owner = new Object({
              sc:'item',
              item:'zs4.head.owner',
              opcode:'eq',
              type:'const',
              const:req.input.owner,
              prop:'',
          });
        }

        console.log('zs4.search('+JSON.stringify(query)+')');

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
      console.log('SELECT.parse('+this._.path+')');
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
      //console.log(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this){
        //console.log('    property '+n);
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
      //console.log(this._.path+'._.select.check()');
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
      //console.log(this._.path+'._.select.check()');
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
      //console.log('ITEM.parse('+this._.path+')',input);
      if (zs4.is.object(input)){
        this._.load(input);
      }
      //console.log(ITEM);
    }).bind(this);

    ITEM._.select.check = (function(){
      this.sc._.flags.set.nodisplay(true);
      //console.log(ITEM._.path+'._.select.check()');
      var scope = this._.select.inscope();
      if (scope==null)return this._.select.result('scope');

      if (ITEM.item._.value==null||ITEM.item._.value==''){
        return this._.select.result('item empty');
      }

      var item = scope._.resolvePath(ITEM.item._.value)
      if (item==null)return this._.select.result('item not found');
      //console.log('    item value: '+item._.value);
      if (ITEM.opcode._.value==null||ITEM.opcode._.value=='')return this._.select.result('opcode');

      if (ITEM.opcode._.value=='exists'){
        //console.log('   EXISTS! '+ITEM.item._.value);
        return this._.select.result(true);
      }

      if (!zs4.is.function(item._.opcode[ITEM.opcode._.value])){
        return this._.select.result('no \''+ITEM.opcode._.value+'\' opcode');
      }
      //console.log('   OPCODE! '+ITEM.opcode._.value);

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
      //console.log(ITEM._.path+'._.onLocalChange()');
      this.sc._.flags.set.nodisplay(true);
      ITEM.opcode._.flags.set.nodisplay(true);
      ITEM.type._.flags.set.nodisplay(true);
      ITEM.const._.flags.set.nodisplay(true);
      ITEM.prop._.flags.set.nodisplay(true);
      if (ITEM.item._.value==null||ITEM.item._.value==''){
        //console.log('      all items hidden');
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
          //console.log('      show opcode');
          if (ITEM.opcode._.value == null||ITEM.opcode._.value == ''){
            ITEM.opcode._.value = 'exists';
          }
          //console.log('      opcode='+ITEM.opcode._.value);
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
  userscope:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'userscope';
  },
  zs4:function(){
    zs4.type.object.call(this,{name:'zs4',flags:'authgetpublic'});
    this._.typename = 'zs4';
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

  if (!zs4.is.object(this.request.callback))
    this.request.callback = new Object();

  if (!zs4.is.object(this.request.get))this.request.get = new Object();

  this.flags = new zs4.util.flags();
  this.flags.value = 0;

  this.setScope = (function(o){

    function authorize(arr){
      //console.log(o._.authSet);
      //console.log('authorizing... '+THIS.path);
      if (!zs4.is.array(arr)){
        return THIS.userIsRoot();
      }
      //console.log(arr);
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
      console.log('object is not a type.');
      console.log(o);
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
  this.error = function(o,error){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
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
    return r;
  };
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
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

  this.resolveInputPath = function(p){

    if (!zs4.is.object(this.input))this.input = new Object();
    var a = zs4.string.split.separators(p,'/\\.-_');
    //console.log('resolveInputPath('+a+')');

    var r = this.input;
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }

    //console.log('resolveInputPath('+p+') = '+JSON.stringify(r));
    return r;
  }

  if (zs4.is.node()){
    //var token = require('../token');
    //var token = require('../token');

    this.call = (function(args,cb,rootAuthority){
      var THIS = this;
      var request;

      if (args.wantreply){
        request = new zs4.request();
        if (this.tokenExists()){
          request.request.token = this.request.token;
          request.request.payload = this.request.payload;
        }
      }
      else {
        console.log('args.wantreply==0');
        request = new zs4.request({request:{node:true,}});
      }

      var path = args.path;
      var input = args.input;
      var inp = request.resolveInputPath(path);

      for (var n in input)inp[n]=input[n];

      if (args.wantreply){
        request.request.get = this.request.get;
        request.request.callback = this.request.callback;
      }

      if (rootAuthority==true) {
        console.log('internal request with root authority');
        request.userIsRoot = request.forceUserIsRoot;
      }
      else if (this.userIsRoot==this.forceUserIsRoot){
        console.log('internal SUB-request with root authority');
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
      //console.log('this.tokenCreate');
      this.request.token = zs4.THIS.zs4.token.encode(nuload);
      this.payloadRefresh();
    };

    this.tokenDelete = function(){
      //console.log('TOKEN DELETED!!!!!!!!!!');
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
      console.log('request.userIsRoot() called returning "true"....');
      return true;
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
          console.log('REQUEST FROM USER \''+this.request.payload.scope+'\'',JSON.stringify(this.input))
          this.resolveInputPath(this.request.payload.scope);
          this.getAll();
        }
      }
      //console.log(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){

        if (THIS.request.needsSaving){
          var now = Date.now();
          if (zs4.THIS.zs4.head.created._.value == 0)zs4.THIS.zs4.head.created._.value=now;
          zs4.THIS.zs4.head.updated._.value=now;
          zs4.save(function(){
            console.log('THIS was saved');
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
        //console.log('request.getReply() FOUND PAYLOAD');
        this.tokenCreate(this.request.payload);
      }
      if (zs4.is.string(this.request.token)){
        //console.log('request.getReply() FOUND TOKEN');
        r.request.token = this.request.token;
        r.request.scope = this.request.payload.scope;
      }

      return r;
    };

    if (zs4.is.object(o)&&o.html!=null&&zs4.is.string(o.path)){
      //console.log('REQUEST RECOGNIZED AS REDIRECT',o,zs4.is.string(o.token),o.token.length);
      this.html = true;
      if (zs4.is.string(o.token)&&o.token.length>10){
        this.request.token = o.token;
        this.payloadRefresh();
        zs4.THIS._.print('TOKEN FROM NAVIGATION POST');
      }
      var input = this.resolveInputPath(o.path);
      input.getHTML = new Object();
      //console.log(this.request.token,this.request.payload);
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
  registerStatic:function(dir){
    zs4.plugin.static.push(dir);
  },
  registerStyle:function(path){
    zs4.plugin.style.push(path);
  },
  registerScript:function(path){
    zs4.plugin.script.push(path);
  },
  registerApp:function(scope,script){
    zs4.plugin.registerScript(script);
    zs4.plugin.script.push(path);
  },
  list:new Object(),
  static:new Array(),
  style:new Array(),
  script:new Array(),
  app:new Object(),
});

if (zs4.is.node()){

  const ZS4 = 'zs4';
  const DOT_ZS4 = '.'+ZS4;

  var fs = require('fs');

  zs4.THIS.zs4.head.typename._.value = 'node';
  zs4.THIS.zs4.head.typename._.default = 'node';
  zs4.THIS.zs4._.property(new zs4.type.search());
  zs4.THIS.zs4._.property(new zs4.type.type());
  zs4.THIS.zs4._.property(new zs4.type.hi());
  zs4.THIS.zs4._.property(new zs4.type.bye());

  zs4.boot = new zs4.processor.sequential();

  zs4.load = function(cb){

    var env = zs4.json.parse(process.env.ZS4)
    if (zs4.is.object(env)&&zs4.is.object.env.zs4){
      zs4.THIS._.load(env);
      cb(new zs4.done());
      return;
    }

    fs.readFile(DOT_ZS4,'utf8',function(err,data){
      if (!err && data){
        var value = zs4.json.parse(data);
        if (value!=null){
          zs4.THIS._.load(value);
          cb(new zs4.done());
          return;
        }
      }
      cb(new zs4.error({text:'load failed.'}));
    });
  };

  zs4.save = function(cb){
    var out = zs4.THIS._.store();
    if (out==null){cb(new zs4.error({text:'no save data.'}));return;}
    var save = zs4.json.stringify(out);
    fs.writeFile(DOT_ZS4,save, function(err){
      if (err){cb(new zs4.error({text:'failed to save object.'}));}
      else {cb(new zs4.done({text:DOT_ZS4+' saved.'}));}
    });
  };

  zs4.define = function(){

    var fs = require('../fs');
    zs4.node.require.fs = fs;
    zs4.node.require.fs.schema(zs4.THIS.zs4);

    zs4.node.require.password = require('../password');
    zs4.node.require.password.schema(zs4.THIS.zs4);

    zs4.node.require.rsa = require('../rsa');
    zs4.node.require.rsa.schema(zs4.THIS.zs4);

    zs4.node.require.token = require('../token');
    zs4.node.require.token.schema(zs4.THIS.zs4);

    zs4.node.require.email = require('../email');
    zs4.node.require.email.schema(zs4.THIS.zs4);

    //zs4.node.require.password = require('../password');
    //zs4.node.require.password.schema(zs4.THIS.zs4);

    zs4.node.require.paypal = require('../paypal');
    zs4.node.require.paypal.schema(zs4.THIS.zs4);

    zs4.node.require.mongodb = require('../mongodb');
    zs4.array.mongodb = new zs4.node.require.mongodb.create({name:'mongodb',boot:true,});
    zs4.THIS.zs4._.property(zs4.array.mongodb);

    zs4.THIS.zs4._.property(new zs4.type.folder({name:'folder'}));


    zs4.scope.config = function(){
      var CONFIG = this;
      zs4.type.scope.call(CONFIG);
      CONFIG._.create = zs4.scope.config;
      CONFIG.zs4.head.typename._.value = 'config';
      CONFIG.zs4.head.typename._.default = 'config';
      CONFIG._.name = 'config';

      zs4.node.require.password.schema(CONFIG.zs4);
      zs4.node.require.rsa.schema(CONFIG.zs4);
      zs4.node.require.token.schema(CONFIG.zs4);
      zs4.node.require.email.schema(CONFIG.zs4);
      zs4.node.require.paypal.schema(CONFIG.zs4);
      CONFIG.zs4._.property(new zs4.node.require.mongodb.template({name:'mongodb'}));
    };


    //zs4.THIS.zs4.type._.property(new zs4.type.array({name:'doctype',template:new zs4.scope.doctype(),}));
    //zs4.THIS.zs4.type.doctype._.flags.value |= zs4.THIS._.flags.apiarg;

    zs4.THIS.zs4.type._.property(new zs4.type.array({name:'config',template:new zs4.scope.config(),}));
    zs4.THIS.zs4.type.config._.flags.value |= zs4.THIS.zs4.type.config._.flags.apiarg;
    zs4.THIS.zs4.type.config._.flags.set.authgetpublic(false);

    var user = require('../user');
    zs4.THIS.zs4.type._.property(new zs4.type.array({name:'user',template:new user.create(),}));
    zs4.THIS.zs4.type.user._.flags.value |= zs4.THIS.zs4.type.user._.flags.apiarg;

    //zs4.THIS.zs4.type._.property(new zs4.type.array({name:'document',template:new zs4.scope.document(),}));
    //zs4.THIS.zs4.type.document._.flags.value |= zs4.THIS._.flags.apiarg;
    //zs4.THIS.zs4.type.document.method.new._.flags.value |= zs4.THIS._.flags.authuser;
    //zs4.THIS.zs4.type.document.method.deleteone._.flags.value |= zs4.THIS._.flags.authuser;

    var user = require('../user');
    zs4.THIS.zs4.type._.property(new zs4.type.array({name:'user',template:new user.create(),}));
    zs4.THIS.zs4.type.user._.flags.value |= zs4.THIS.zs4.type.user._.flags.apiarg;

    // plugins
    var plugin = new Object();

    var nodefs = require('fs');
    var rdr = nodefs.readdirSync('./zs4/plugin');
    console.log('readPlugins: ' + zs4.is.array(rdr) +  ' ' + rdr);
    for ( var i = 0 ; i < rdr.length ; i++ ){
      var fnam = '../plugin/'+rdr[i]+'/'+rdr[i]+'.js';
      console.log('array element '+i+': '+fnam)
      zs4.plugin.list[rdr[i]]=require(fnam);
    }
    //console.log(zs4.plugin);

    // Run express only once all components/plugins are loaded and ready
    zs4.node.require.express = require('../express');
    zs4.node.require.express.schema(zs4.THIS.zs4);



  }


}

if (zs4.is.window()){

  zs4.window ={
    onresize:[],
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
          //console.log(d);
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
      console.log('zs4.post() not valid');
      console.log(req);
      zs4.THIS._.dcb(req,req.request.callback);
      if (cb) cb(req); return;
    }

    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10){
      req.request.token = zs4.THIS._.token;
    }
    else if (zs4.is.string(window.token)&&window.token.length>10){
      req.request.token = window.token;
    }
    else {
      req.request.token = null;
    }
    console.log(req);

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
      console.log(ret);
  		zs4.THIS._.got(ret,ret.reply);
      zs4.THIS._.dcb(ret,ret.request.callback);
  		if (cb) cb(ret);
      else console.log('no callback specified for zs4.post()');
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

  zs4.admin = function(){
    var input = new Object();
    var a = zs4.string.split.separators(zs4.location.path,'./\\_-');
    var p = input;
    for (var i = 0 ; i < a.length ; i++){
      p[a[i]] = new Object();
      p = p[a[i]];
    }
    zs4.THIS._.print('LAUNCHING ADMIN @ '+ JSON.stringify(input))
    zs4.post(input,function(){
      zs4.loadscript('/admin.js');
    },true);
  };
  zs4.style = {

    refresh:function(){
      zs4.style.element.innerHTML = '';
      var widthMax = 1024;
      var width = window.innerWidth;
      if (width > widthMax)width = widthMax;

      var heightMax = 1024;
      var height = window.innerHeight;
      if (height > heightMax)height = heightMax;

      var em = (width+height) / 50;

      var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
      sheet += '.fouc{opacity:0}\n';

      zs4.style.element.appendChild(document.createTextNode(sheet));
    },
  };

  zs4.style.element = document.createElement('style');
  document.head.appendChild(zs4.style.element);
  zs4.style.refresh();

  /*
  window.onresize = function(){
    //zs4.style.refresh();
    for (var i = 0 ; i < zs4.window.onresize.length ; i++){
      if (zs4.is.function(zs4.window.onresize[i])){
        //console.log('...WINDOW.ONRESIZE....')
        zs4.window.onresize[i]();
      }
    }
  };
  */
}
