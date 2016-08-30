'use strict';

var zs4;
zs4 = new Object();
if (typeof window === 'undefined') {
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
  FLAG:{
    SETTABLE:0x00000001,
  },
  MS:{
    SECOND:1000,
    MINUTE:(1000*60),
    HOUR:(1000*60*60),
    DAY:(1000*60*60*24),
    WEEK:(1000*60*60*24*7),
    YEAR:(1000*60*60*24*7*366),
  },
  OBJECT:{
    OWNER:'owner@zs4.zs4',
  },
  PATH:{
    MINLENGTH:1,
    MAXLENGTH:256,
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
  SERVER:{
    NAME:{
      MINLENGTH:1,
      MAXLENGTH:16,
    },
    SLOGAN:{
      MINLENGTH:4,
      MAXLENGTH:32,
    },
  },
  TYPE:{
    PLAIN:0,
    COLLECTED:1,
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
      node:function(){if (typeof window === 'undefined')return true; return false;},
      window:function(){if (typeof window === 'undefined')return false; return true;},
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
        if	(o==null)return false;
        if ((o instanceof Function)==true)return false;
        if	((o instanceof Array)==true)return false;
        if	(o instanceof Object)return true;
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

zs4.string = {
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
      if (zs4.is.array(from._.enum))to._.enum = from._.enum;

    },
    trim:function(f,t){
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
  resolve:function(path){
    var ret = zs4.THIS;
    if (path == null || path.length == 0)return ret;
    var a = zs4.string.split.separators(path,'./\\_-');
    if (a == null || a.length == 0)return ret;
    for (var i = 0 ; i < a.length ; i++){
      if (!zs4.is.name(a[i])||!ret.hasOwnProperty(a[i])||!zs4.is.type(ret[a[i]])) return ret;
      ret = ret[a[i]];
    }
    console.log('path resolved: '+ret._.path);
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
    this.addFlag('arrayio',0x0002);
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

    this.addFlag('local',0x1000000);

    //combo flags
    this.addFlag('apiarg',this.authgetpublic|this.authsetpublic);
    this.getString = function(mask){
      var int = mask;
      if (!zs4.is.number(int))int=this.value;
      var ret = '';
      function addFlag(s){
        if (ret.length == 0) ret = s; else ret += (' '+s);
      }
      if (int & this.trim) addFlag('trim');
      if (int & this.arrayio) addFlag('arrayio');
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

      if (int & this.local) addFlag('local');


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
};

zs4.type = {

  unknown:function(input){
    //console.log('object()');
    if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
      return new zs4.error({text:'bad input',data:input});
    }

    this._ = new Object();
    this._.path = '';
    this._.name = input.name;
    //if (zs4.is.boolean(input.required))this._.required = input.required; else this._.required = true;

    this._.flags = new zs4.util.flags();
    if (zs4.is.string(input.flags))this._.flags.setString(input.flags);

    if (zs4.is.boolean(input.array))this._.array = input.array;

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
        ret._.load(this._.value);
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
      if (this._.nostore)return;
      this._.print('this.shouldBeSaved('+this._.path+')',req);
      req.request.needsSaving = true;
    }).bind(this);

    this._.getInitialize = (function(req){
      //var debug = 'zs4.bye';
      //if (this._.path == debug) console.log('getInitialize '+this._.path);
      if (this._.flags.get.noget())return null;
      this._.print('getInitialize() req.flags=\''+req.flags.getString()+'\'',req)
      if (!req.flags.get.authgetpublic()&&!req.flags.get.authsetself()&&!req.flags.get.authget())return null;

      var get = req.get(this);
      get._.name = this._.name;
      get._.typename = this._.typename;
      zs4.copy.schemabasics(this,get);

      if (zs4.is.type(this._.inscope)&&this._.inscope._.flags.get.scope())
        get._.inscope = this._.inscope._.path;

      get._.flags = req.flags.value;
      if (this._.flags.get.api())get._.flags |= req.flags.api;
      if (this._.flags.get.scope())get._.flags |= req.flags.scope;
      if (this._.flags.get.noset())get._.flags |= req.flags.noset;
      if (this._.flags.get.arrayio())get._.flags |= req.flags.arrayio;
      if (this._.flags.get.index())get._.flags |= req.flags.index;
      if (this._.flags.get.unique())get._.flags |= req.flags.unique;
      if (this._.flags.get.notrans())get._.flags |= req.flags.notrans;
      if (this._.flags.get.authgetpublic())get._.flags |= req.flags.authgetpublic;
      if (this._.flags.get.authsetpublic())get._.flags |= req.flags.authsetpublic;
      if (this._.flags.get.authsetself())get._.flags |= req.flags.authsetself;
      if (this._.flags.get.local())get._.flags |= req.flags.local;

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
      if (this._.type != Object && po!=null){
        get._.value = po._.value[this._.name];
      }
      if (this._.type == Object()){
        for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type != Object){
          req.setScope(this[n]);
          this[n]._.get(req,this);
        }
      }
      return get;
    }).bind(this);

    this._.got = (function(o,p){
      //console.log(this);
      if (!zs4.is.type(o))return;

      //console.log('got \''+this._.path+'\'');


      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        console.log('this._.name:'+this._.name+',o._.name: '+o._.name);
        console.log('this._.typename:'+this._.typename+',o._.typename: '+o._.typename);
        console.log('missmatching type or name');
      }

      this._.name = o._.name;
      this._.typename = o._.typename;

      zs4.copy.schemabasics(o,this);
      this._.flags.value = o._.flags;
      if (zs4.is.string(o._.inscope)&&this._.inscope._.flags.get.scope()){
        var is = this._.scope._.resolvePath(o._.inscope);
        if (is != null  && is._.flags.get.scope()) {
          this._.inscope = is;
          this._.print('got inscope: \''+o._.inscope+'\'');
          //console.log('got inscope: \''+o._.inscope+'\'');
        }
      }


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

          this[n]._.got(o[n],this);
        }

        if (!this._.flags.get.arrayio()){

          for (var n in this){
            if (!zs4.is.type(this[n]))continue;

            this[n]._.flags.set.nodisplay(false);

            if (zs4.is.type(o[n]))continue;

            if (!this[n]._.flags.get.noprune()){
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
      }
      else if (p!=null){
        p._.value[this._.name]=o._.value;
        //console.log(o._.value);
        //console.log(o._.html);
        if (zs4.is.function(o._.response)){
          console.log('response() function found for '+o._.path);
          o._.response(o._.value);
        }
      }
      else {
        console.log('value without parent.')
      }
    }).bind(this);

    this._.dcb = (function(input){
      this._.cberror = null;
      this._.cbresult = null;
      //if (this._.flags.value & this._.flags.notrans)return;
      //console.log('XXXX dcb()ing '+this._.path);

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

        if (zs4.is.object(input)&&zs4.is.object(input[n])) this[n]._.dcb(input[n]);
        else this[n]._.dcb(null);
      }

      if (zs4.is.object(input)){
        if (zs4.is.function(this._.callback)){
          this._.callback(input);
        }
        else if (zs4.is.string(input.result)&&input.result=='goscope'){
          console.log('goscope '+this._.scope._.path);
          zs4.navigate(this._.scope._.path);
        }
      }
    }).bind(this);

    this._.getHTML = (function(req){
      var html = '<!DOCTYPE html>\n';
      html += '<html>\n';
        html += ' <head>\n';
          html += '  <title>'+this._.path+'</title>\n';
          html += '  <script src="/zs4.js"></script>\n';
          html += '  <script>zs4.location.path=\''+this._.path+'\';zs4.admin();</script>\n'
        html += ' </head>\n';
        if (true){
          html += ' <body>\n';
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
      for (var n in req.input._){
        if (n=='auth'){
          var res = req.internalResultPath(this);

          //console.log(req.input._[n]);
          if (req.input._.auth.type == 'getauth'){
            if (am){
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
              req.error(this);
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
              req.error(this);
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
  },

  array:function(input){
    zs4.type.object.call(this,input);
    this._.typename = 'array';

    //if (zs4.is.window())return;

    if (!zs4.is.type(input.template))input.template = new zs4.type.scope({name:'template'});

    var THIS = this;

    THIS._.array = new Object();
    THIS._.array.elementConnect = (function(p,e){
      if (p==null)e._.path = e._.name;
      else e._.path = p._.path +'.'+e._.name;
      if (e._.type == Object){
          for (var n in e){
            if (!zs4.is.type(e[n]))continue;
            THIS._.array.elementConnect(e,e[n]);
          }
      }
      return e;
    }).bind(THIS.array);

    THIS._.property(new zs4.type.object({name:'config',flags:'api noprune',authSet:['zs4.owner'],}));
    THIS.config._.property(new zs4.type.integer({name:'maxlength',flags:'noprune',authSet:['zs4.owner'],}));
    THIS.config._.property(new zs4.type.integer({name:'lastid',flags:'noset noprune',}));

    THIS._.property(new zs4.type.object({name:'method',flags:'noprune nostore authgetpublic',}));

    THIS.method._.property(new zs4.type.object({name:'new',flags:'api noprune nostore authsetself',}));
    this.method.new._.transform = (function(req,cb){
      req.setScope(this);
      this._.transformInternal(req);
      if (!(req.flags.value & req.flags.authset)){
        var err = 'not authorized';
        req.error(THIS.method.new,err);
        this._.print(err,req);
        this._.get(req); cb(); return;
      }
      if (zs4.is.object(req.input)){
        //if (!(req.flags.value & req.flags.authset)){
        //  req.error(THIS.method.new,'not authorized');
        //  this._.get(req); cb(); return;
        //}
        console.log(this._.path+'.transform()');
        console.log(req.input);
        var length = zs4.count.object.properties(THIS.array._.value);
        if (THIS.config._.value.maxlength > 0 && length >= THIS.config._.value.maxlength){
          req.error(this,{text:'array limit reached'})
          this._.get(req); cb(); return;
        }

        THIS.config._.value.lastid++;
        var id = zs4.integer.to.name(THIS.config._.value.lastid);
        var nu = THIS.template._.new();
        nu._.name = id; nu._.flags.set.notrans(false);
        nu._.flags.set.scope(true);
        nu.zs4.head._.value.created = nu.zs4.head._.value.updated = Date.now();
        THIS.array._.value[id] = nu._.store();

        THIS._.array.elementConnect(THIS.array,nu);

        //nu._.transform(new zs4.request({request:req.request,input:null,}),function(){
        nu._.transform(req.create(),function(){

          THIS._.shouldBeSaved(req);
        });

      }
      this._.get(req); cb(); return;
    }).bind(this.method.new);

    THIS.method._.property(new zs4.type.object({name:'getall',flags:'api noprune nostore authsetself',}));
    this.method.getall._.transform = (function(req,cb){
      req.setScope(this);
      this._.transformInternal(req);
      if (!(req.flags.value & req.flags.authset)){
        var err = 'not authorized';
        req.error(THIS.method.getall,err);
        this._.print(err,req);
        this._.get(req); cb(); return;
      }

      if (zs4.is.object(req.input)){
        console.log(this._.path+'.transform()');

        var parallel = new zs4.processor.parallel();
        for (var n in THIS.array._.value){
          console.log(' .. '+n);

          var r = req.create();
          r.elenam = n;
          parallel.call(THIS.array,function(req,cb){
            var model = THIS.template._.new();
            model._.name = req.elenam;
            model._.flags.set.notrans(false);
            model._.flags.set.scope(true);
            THIS._.array.elementConnect(THIS.array,model);
            model._.load(THIS.array._.value[req.elenam]);
            model._.transform(req,cb);
          },r);
        }

        parallel.run(function(){
          THIS._.get(req);
          cb();
        });

      }
      this._.get(req); cb(); return;
    }).bind(this.method.getall);

    this.method.getone = null;

    THIS.method._.property(new zs4.type.object({name:'deleteall',flags:'api noprune nostore',}));
    THIS.method.deleteall._.property(new zs4.type.boolean({name:'sure',flags:'required nostore noprune',}));
    THIS.method.deleteall._.transform = (function(req,cb){
      var DELETEALL = this;
      req.setScope(this);
      this._.transformInternal(req);
      function get(){
        DELETEALL._.get(req);
        req.setScope(DELETEALL.sure);
        DELETEALL.sure._.get(req,DELETEALL);
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
        THIS.array._.value = new Object();
        req.result(this,true);
        THIS._.shouldBeSaved(req);
      }
      return get();
    }).bind(this.method.deleteall);
    this.method.deleteall._.callback = (function(o){
      //console.log('deleteall._.callback()');
      //console.log(o);
      if (zs4.is.boolean(o.result)&&o.result==true){
        for (var n in THIS.array){
          if (!zs4.is.type(THIS.array[n]))continue;
          console.log('deleting '+THIS.array[n]._.path);

          if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
          THIS.array._.value[n]==null;
          THIS.array[n]==null;
        }
        if (zs4.is.function(THIS._.refresh)){
          THIS._.refresh();
        }
      }
    }).bind(this.method.deleteall);


    var template = input.template._.new();
    template._.name = 'template'
    THIS._.property(template);
    THIS.template._.flagTree((
      this._.flags.authgetpublic
      |this._.flags.notrans
      |this._.flags.noprune
      |this._.flags.nostore
    ),true);

    THIS._.property(new zs4.type.select());
    THIS.select._.flags.value |= (THIS._.flags.nostore);
    THIS.select._.inscope = THIS.template;

    THIS._.property(new zs4.type.object({name:'sort',flags:'noprune nostore authgetpublic local',}));
    THIS.sort._.property(new zs4.type.scopeindex({name:'item',flags:'required nostore noprune apiarg local',inscope:THIS.template,default:'zs4.head.updated'}));
    THIS.sort._.property(new zs4.type.boolean({name:'descend',flags:'required nostore noprune apiarg local',default:true,}));

    THIS._.property(new zs4.type.object({name:'array',flags:'arrayio noprune authgetpublic',}));
    THIS.array._.load = (function(input){
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      zs4.copy.trim(input,THIS.array._.value);
      var count = zs4.count.object.properties(input);
      this._.print('loaded '+count+' array elements');
    }).bind(THIS.array);
    THIS.array._.store = (function(){
      var store = new Object();
      zs4.copy.trim(THIS.array._.value,store);
      var count = zs4.count.object.properties(store);
      this._.print('storing '+count+' array elements');
      return store;
    }).bind(THIS.array);

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
    THIS.array._.elementTransform = (function(req,cb){
      console.log(this._.path+'.transform()');
      THIS.array._.elementLoad(req,function(ret){
        if (ret==null){
          req.error(THIS.array,THIS.array._.path+'.'+req.elenam+' not found');
          cb();return;
        }
        var o = THIS.template._.new();
        o._.name = req.elenam;
        o._.flags.set.notrans(false);
        o._.flags.set.scope(true);
        o._.load(ret);
        THIS._.array.elementConnect(THIS.array,o);
        var neededSaving = req.request.needsSaving;
        req.request.needsSaving = false;
        o._.transform(req,function(){
          if (req.request.needsSaving==true){
            o._.value.zs4.head.updated = Date.now();
          }
          if (neededSaving==true)req.request.needsSaving=true;

          var save = o._.store();
          req.elesav = save;
          THIS.array._.elementSave(req,function(){});
          THIS.array._.get(req); cb(); return;
        });
      });
    }).bind(THIS.array);

    THIS.array._.transform = (function(req,cb){
      req.setScope(this);
      if (!zs4.is.object(req.input)){
        this._.print('transform: no input',req);
        this._.get(req); cb(); return;
      }
      this._.print('transform: ('+JSON.stringify+')',req);

      var parallel = new zs4.processor.parallel();

      for (var n in req.input){
        if (!zs4.is.object(req.input[n]))continue;
        var childreq = req.create({input:req.input[n],})
        childreq.elenam = n;
        parallel.call(this,this._.elementTransform,childreq);
      }

      var t = this;
      parallel.run(function(){
        t._.get(req); cb(); return;
      });
    }).bind(THIS.array);

    THIS.method._.property(new zs4.type.object({name:'getone',flags:'api noprune nostore noprune apiarg',}));
    THIS.method.getone._.property(new zs4.type.scopeindexunique({name:'item',flags:'required nostore noprune apiarg',inscope:THIS.template,}));
    THIS.method.getone._.property(new zs4.type.string({name:'equals',flags:'required nostore noprune apiarg',}));
    this.method.getone._.transform = (function(req,cb){
      var GETONE = this;
      req.setScope(this);
      this._.transformInternal(req);
      function get(){
        GETONE._.get(req);

        req.setScope(GETONE.item);
        GETONE.item._.get(req,GETONE);

        req.setScope(GETONE.equals);
        GETONE.equals._.get(req,GETONE);

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

      //console.log(this._.path+'.transform()');

      if (!zs4.is.string(req.input.item)||req.input.item.length==0){
        var err = 'no item specified'
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
      var item = req.input.item;
      var equals = req.input.equals;

      var parallel = new zs4.processor.parallel();
      for (var n in THIS.array._.value){

        var r = req.create();
        r.elenam = n;
        parallel.call(THIS.array,function(req,cb){
          var model = THIS.template._.new();
          GETONE._.print('   scanning '+THIS.array._.path+'.'+req.elenam,req);
          model._.name = req.elenam;
          model._.flags.set.notrans(false);
          model._.flags.set.scope(true);
          THIS._.array.elementConnect(THIS.array,model);
          model._.load(THIS.array._.value[req.elenam]);

          GETONE._.print('   scanning '+THIS.array._.path+'.'+n,req);
          var val = model._.resolvePath(item);
          if (val == null){
            GETONE._.print('   CANT FIND '+item,req);
            cb(); return;
          }
          if (val._.opcode.equals(equals)){
            GETONE._.print('   MATCH! -> transform() '+item,req);
            model._.transform(req,cb);
            return;
          }
          else {
            GETONE._.print('   FAILURE! (v/e) '+val._.value+'!='+equals,req);
            cb(); return;
          }
        },r);
      }

      parallel.run(function(){
        return get();
      });


    }).bind(this.method.getone);

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

      //this._.scope._.loadAuth(input);

    }).bind(this);
    this._.store = (function(){
      this._.print('store()');
      if (this._.nostore){return null;}

      //return this._.scope._.saveAuth(input)
    }).bind(this);
  },
  boolean:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = Boolean;
    this._.typename = 'boolean';
    this._.default = new Boolean();
    if (zs4.is.boolean(input.default))this._.default = input.default; else this._.default = false;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.boolean(input)) return this._.zs4checkfail(req,'not boolean');

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
      equals:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v===this._.value)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(parent,input){
      var v = this._.opcode.convert(input);
      if (v==null){
          if (zs4.is.boolean(this._.default))this._.value = parent[this._.name]=this._.default;
          else this._.value = parent[this._.name]=new Boolean(false);
      }
      else {
        this._.value = parent[this._.name]=v;
      }
      this._.print('load() loaded input=\''+parent[this._.name]+'\')');
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')');
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}
      //console.log(this._.path+'._.transform(\''+req.input+'\')');
      this._.shouldBeSaved(req);

      var v = this._.opcode.convert(req.input);
      if (v!=null)this._.value = req.parent._.value[this._.name]=v;

      this._.get(req,req.parent);
      cb();
    }).bind(this);

  },
  bye:function(input){
    var THIS = this;
    zs4.type.object.call(this,{name:'bye',flags:'api nostore authgetpublic authsetpublic',})
    this._.typename = 'bye';
    this._.create = zs4.type.bye;
    this._.property(new zs4.type.boolean({name:'sure',flags:'required noprune',}));
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

      zs4.console.arr = input.array;

    }).bind(this);
    this._.store = (function(){
      this._.print('store()');
      if (this._.nostore){return null;}

      return new Object({array:zs4.console.arr});
    }).bind(this);
  },
  date:function(input){
    zs4.type.integer.call(this,input);
    this._.typename = 'date';

  },
  email:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'email';
    this._.minlength = zs4.const.EMAIL.MINLENGTH;
    this._.maxlength = zs4.const.EMAIL.MAXLENGTH;

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')',req);
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}
      //console.log(this._.path+'._.transform(\''+req.input+'\')');
      this._.shouldBeSaved(req);

      if (zs4.is.email(req.input))req.parent._.value[this._.name]=req.input.trim();

      this._.get(req,req.parent);
      cb();
    }).bind(this);
  },
  head:function(){
    zs4.type.object.call(this,{name:'head',flags:'api authgetpublic authsetself',})
    this._.typename = 'head';
    this._.create = zs4.type.head;

    this._.property(new zs4.type.string({name:'title',flags:'index noprune authgetpublic authsetself',}));
    this._.property(new zs4.type.integer({name:'created',flags:'noset index noprune',}));
    this._.property(new zs4.type.integer({name:'updated',flags:'noset index noprune',}));
    this._.property(new zs4.type.string({name:'app',flags:'index noprune authsetself',default:'/admin.js',}));

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

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.number(input))return this._.zs4checkfail(req,'not integer');

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
      equals:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v===this._.value)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(parent,input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.number(this._.default))this._.value = parent[this._.name]=this._.parseInt(this._.default);
        else this._.value = parent[this._.name]=new Number(0);
      }
      else {
        this._.value=parent[this._.name]=v;
      }
      this._.print('load() loaded input=\''+parent[this._.name]+'\')');
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')');
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}

      this._.shouldBeSaved(req);

      var v = this._.opcode.convert(req.input);
      if (v!=null)this._.value = req.parent._.value[this._.name]=v;

      this._.get(req,req.parent);
      cb();
    }).bind(this);

  },
  name:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'name';
    this._.minlength = 1;
    this._.maxlength = zs4.const.STRING.MAXLENGTH;

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')',req);
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}
      //console.log(this._.path+'._.transform(\''+req.input+'\')');
      this._.shouldBeSaved(req);

      if (zs4.is.name(req.input)) this._.value = req.parent._.value[this._.name]=req.input.trim();

      this._.get(req,req.parent);
      cb();
    }).bind(this);
  },
  number:function(input){
    var THIS = this;
    req.setScope(this);
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

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.number(input))return this._.zs4checkfail(req,'not number');
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
      equals:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v===this._.value)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(parent,input){
      var v = this._.opcode.convert(input);
      //console.log(this.path+'.load(\''+input+'\')');

      if (v==null){
        if (zs4.is.number(this._.default))this._.value = parent[this._.name]=this._.default;
        else this._.value = parent[this._.name]=new Number(0);
      }
      else {
        this._.value=parent[this._.name]=v;
      }
      this._.print('load() loaded input=\''+parent[this._.name]+'\')');
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')');
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}

      this._.shouldBeSaved(req);

      var v = this._.opcode.convert(req.input);
      if (v!=null)this._.value = req.parent._.value[this._.name]=v;

      this._.get(req,req.parent);
      if (cb);
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
      //if (ns._.path.startsWith('zs4.fso'))
      //  console.log('linking '+ns._.path);

      if (ns._.type == Object){

          //debug += ' Object';
          this._.value[ns._.name] = ns._.value;

          for (var n in ns){
            if (!zs4.is.type(ns[n]))continue;
            //console.log(ns._.name+'.'+n);
            ns._.property(ns[n]);
          }
      }
      else {
        //this._.value[ns._.name] = new ns._.type();
        this._.value[ns._.name] = ns._.default;
      }

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
    this._.load = (function(input){
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (this[n]._.type == Object){
           if (zs4.is.object(input[n]))this[n]._.load(input[n]);
        }else{
          this[n]._.load(this._.value,input[n]);
        }
      }
    }).bind(this);
    this._.store = (function(){
      //console.log(this.path+'.store()');
      if (this._.nostore){return null;}
      var store = new Object();

      for (var n in this){

        if (!zs4.is.type(this[n])||this[n]._.nostore==true)continue;

        //console.log('storing '+n);

        if (this[n]._.type == Object){
          var ret = this[n]._.store();
          if (ret != null) store[n] = ret;
          continue;
        }

        store[n] = this._.value[n];
      }

      return store;
    }).bind(this);

    this._.get = (function(req,po){
      if (this._.flags.get.noget())return null;
      this._.print('get() ',req)
      return this._.getInitialize(req);
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
      if (!(req.flags.value & req.flags.authset)){
        var err = 'set not authorized';
        //req.error(THIS,err);
        this._.print(err,req);
        //this._.get(req); cb(); return;
      }

      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;


        if (req.input==null||req.input[n]==null){
          parallel.call(this[n],this[n]._.transform,req.create({input:null,parent:this,}));
        }
        else if (zs4.is.object(req.input)&&!this._.flags.get.notrans()){
          parallel.call(this[n],this[n]._.transform,req.create({input:req.input[n],parent:this,}));
        }
      }

      parallel.run(function(){
        if (zs4.is.string(req.request.reget)){
          if (req.request.reget.startsWith(THIS._.path)
          &&  req.request.reget.length > THIS._.path.length){
            console.log('....RE-GETTING '+THIS._.path);
            req.request.reget = null;
            for (var n in THIS){
              if (!zs4.is.type(THIS[n]))continue;
              THIS[n]._.get(req);
              console.log('    '+THIS[n]._.name);
            }
          }
        }
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

        if (this[n]._.flags.get.required()&&!input.hasOwnProperty(n))return this._.zs4checkfail(req,n + ' required');

        if (input.hasOwnProperty(n)){
          if (!this[n]._.zs4check(req,input[n])) return false;
        }
      }
      return true;
    }).bind(this);

  },
  password:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'password';
  },
  scope:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'this',flags:'scope authgetpublic',})
    THIS._.typename = 'scope';
    THIS._.scope = this;
    THIS._.property(new zs4.type.object({name:'zs4',flags:'authgetpublic'}));
    THIS.zs4.password = null;
    THIS.zs4._.property(new zs4.type.head());
    if (zs4.is.node()){
      THIS.zs4._.property(new zs4.type.auth());
      THIS.zs4._.property(new zs4.type.bye());
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
    THIS._.getScopeScopes = (function(scope){
      if (scope == null)scope = THIS;
      var response = new Array();
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          item[n]._.print('getScopeScopes');

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          && !item[n]._.flags.get.notrans()
          ){
            item[n]._.print('getScopeScopes OK!!!!')
            var label = item[n]._.path;
            var value = item[n]._.path;
            if (zs4.is.object(item[n].zs4.head._.value)){
              if (zs4.is.string(item[n].zs4.head._.value.title)){
                if (item[n].zs4.head._.value.title.length > 1 ) {
                  label = item[n].zs4.head._.value.title;
                }
                else {
                  label = n + ' (untitled)';
                }
              }
            }
            response.push(new Object({label:label,value:value}));
          }

          if (item[n]._.type == Object){
            recurse(item[n]);
          }
        }
      };

      response.push(new Object({label:'zs4.public',value:'zs4.public'}));
      response.push(new Object({label:'zs4.owner',value:'zs4.owner'}));
      response.push(new Object({label:'zs4.self',value:'zs4.self'}));
      recurse(scope);
      return response;
    }).bind(this);
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
  select:function(){
    zs4.type.object.call(this,{name:'select',flags:'noprune apiarg local',});
    this._.typename = 'select';
    this._.create = zs4.type.select;
    this._.select = new Object({type:'select',types:['all','any','none','item'],});
    this._.select.lastid = 0;

    this._.select.getOpcodes = (function(){
      if (this.select.type != 'item')return null;
      return null;
    }).bind(this);
    this._.select.add = (function(n){
      if (!zs4.string.array.is.element(this._.select.types,n))return null;
      var nu = new zs4.type.select();
      nu._.flags.value = this._.flags.value;
      if (this._.inscope != null)nu._.inscope = this._.inscope;
      else nu.inscope = this._.scope;
      nu._.select.type = n;
      nu._.name = zs4.integer.to.name(this._.select.lastid++);

      if (n=='item'){
        nu._.property(new zs4.type.scopeitem({name:'path'}));
        if (this._.inscope != null)nu.path._.inscope = this._.inscope;
        nu.path._.flags.value = this._.flags.value;

        nu._.property(new zs4.type.scopeitem({name:'opcode'}));
        if (this._.inscope != null)nu.opcode._.inscope = this._.inscope;
        nu.opcode._.flags.value = this._.flags.value;


      };
      this._.property(nu);
    }).bind(this);

    this._.select.check = (function(){
      if (this._.name == 'select' || this._.name == 'all'){
        for (var n in this)if (zs4.is.type(this[n])){
          if (!this[n]._.select.check())return false;
        }
        return true;
      }
      else if (this._.name=='any'){
        for (var n in this)if (zs4.is.type(this[n])){
          if (this[n]._.select.check())return true;
        }
        return false;
      }
      else if (this._.name=='none'){
        for (var n in this)if (zs4.is.type(this[n])){
          if (this[n]._.select.check())return false;
        }
        return true;
      }
    }).bind(this);
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
      equals:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v===this._.value)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(parent,input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.string(this._.default))this._.value = parent[this._.name]=this._.default;
        else this._.value = parent[this._.name]=new String();
      }
      else {
        this._.value = parent[this._.name]=v;
      }
      this._.print('load() loaded input=\''+parent[this._.name]+'\')');
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.print('transform('+req.input+')',req);
      req.setScope(this);
      this._.transformInternal(req);
      if (req.input==null){this._.get(req,req.parent);cb();return;}
      //console.log(this._.path+'._.transform(\''+req.input+'\')');
      this._.shouldBeSaved(req);

      if (zs4.is.string(req.input)){
        if (this.trim)req.parent._.value[this._.name]=req.input.trim();
        else req.parent._.value[this._.name]=req.input;
      }

      this._.get(req,req.parent);
      cb();
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
    return ret;
  };
  const BADPATH = 'bad path';
  var THIS = this;

  if (zs4.is.object(o)){
    if (zs4.is.object(o.request))this.request = o.request;
    if (o.input!=null)this.input = o.input;
    if (zs4.is.object(o.parent))this.parent = o.parent;
    if (zs4.is.type(o.scope))this.scope = o.scope;
  }

  if (!zs4.is.object(this.request))this.request = new Object();

  if (!zs4.is.object(this.request.callback))
    this.request.callback = new Object();

  if (!zs4.is.object(this.request.get))this.request.get = new Object();

  this.flags = new zs4.util.flags();
  this.flags.value = 0;

  this.setScope = (function(o){

    function authorize(arr){
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

    if (o._.flags.value & this.flags.scope){THIS.scope = o;}

    THIS.flags.value = 0;
    var am = THIS.am(o);
    var own = THIS.own(o);
    //own |= this.userIsRoot();

    THIS.flags.set.am(am);
    THIS.flags.set.own(own);

    if (o._.flags.get.authgetpublic()||(am||own))THIS.flags.set.authget(true);
    else THIS.flags.set.authget(authorize(o._.authGet));

    if (o._.flags.get.authsetpublic())THIS.flags.set.authset(true);
    else if ((am||own) && o._.flags.get.authsetself())THIS.flags.set.authset(true);
    else THIS.flags.set.authset(authorize(o._.authSet));

    if (am||own){
      THIS.flags.set.authgetauth(true);
      if (own){
        THIS.flags.set.authsetauth(authorize(o._.authSetAuth));
      }
    }

    if (this.userIsRoot()){
      THIS.flags.set.authget(true);
      THIS.flags.set.authset(true);
      THIS.flags.set.authgetauth(true);
      THIS.flags.set.authsetauth(true);
    }
    o._.print('setScope() req.flags = \''+THIS.flags.getString()+'\'',REQUEST);
  }).bind(this);
  this.resolvePath = function(o,r){
    if (!zs4.is.type(o)){
      console.log('object is not a type.');
      console.log(o);
      return null;
    }
    var a = zs4.string.split.separators(o._.path,'.');
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }
    return r;
  }
  this.error = function(o,error){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
      return;
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
  }
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
      return;
    }
    r.result = result;

    o._.print('result: '+JSON.stringify(this.request.callback));

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

  this.get = function(o,result){
    var get = this.resolvePath(o,this.request.get);
    if (!zs4.is.object(get._)) get._ = new Object();
    return get;
  }

  this.resolveInputPath = function(p){

    if (!zs4.is.object(this.input))this.input = new Object();
    var a = zs4.string.split.separators(p,'/\\.-_');

    var r = this.input;
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }
    return r;
  }

  if (zs4.is.node()){
    //var token = require('../token');
    //var token = require('../token');


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
      this.request.token = zs4.THIS.zs4.token.encode(nuload);
      this.payloadRefresh();
    };

    this.tokenDelete = function(){
      this.request.token=null;
      this.request.payload=null;
    };

    this.tokenExists = function(){
      if (this.request.token!=null&&this.request.payload!=null)return true;
      return false;
    }

    if (!zs4.is.boolean(this.request.needsSaving)) this.request.needsSaving = false;

    this.request.reget = null;

    this.userIsRoot = function(){
      if (this.request.node) return true;
      if (zs4.is.object(this.request.payload)){
        if (zs4.is.string(this.request.payload.scope)){
          if (this.request.payload.scope=='')return true;
        }
      }
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
      if (this.scope._.path.startsWith(this.request.payload.scope)
      &&this.scope._.path.length>this.request.payload.scope.length){
        THIS._.print('req.am said zs4.owner');
        return true;
      }
      return false; //this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;
      //console.log(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){

        if (THIS.request.needsSaving){
          var now = Date.now();
          if (zs4.THIS.zs4.head._.value.created == 0)zs4.THIS.zs4.head._.value.created=now;
          zs4.THIS.zs4.head._.value.updated=now;
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
      if (zs4.is.object(this.request.payload))this.tokenCreate(this.request.payload);
      if (zs4.is.string(this.request.token)){
        r.request.token = this.request.token;
        r.request.scope = this.request.payload.scope;
      }

      return r;
    };

    if (zs4.is.object(o)&&o.html!=null&&zs4.is.string(o.path)){
      this.html = true;
      if (zs4.is.string(o.token)&&o.token.length>10){
        this.request.token = o.token;
        this.payloadRefresh();
        zs4.THIS._.print('TOKEN FROM NAVIGATION POST');
      }
      var input = this.resolveInputPath(o.path);
      input.getHTML = new Object();
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

if (zs4.is.node()){
  var nu;

  /*
  nu = new zs4.type.scope();
  nu._.name = 'public';
  nu._.value.zs4.head.title = 'user: public'
  nu._.authGet = new Array();
  zs4.THIS.zs4._.property(nu);

  nu = new zs4.type.scope();
  nu._.name = 'owner';
  nu._.value.zs4.head.title = 'user: owner'
  nu._.authGet = new Array();
  zs4.THIS.zs4._.property(nu);

  nu = new zs4.type.scope();
  nu._.name = 'self';
  nu._.value.zs4.head.title = 'user: self'
  nu._.authGet = new Array();
  zs4.THIS.zs4._.property(nu);
  */
}

if (zs4.is.window()){

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
    var form = document.createElement('form');
    form.action = path; // Remember to change me
    form.method = 'post';

    var html = document.createElement('input');
    html.setAttribute('name', 'html');
    html.setAttribute('type', 'checkbox');
    html.checked = html.value = true;
    form.appendChild(html);

    var loc = document.createElement('input');
    loc.setAttribute('name', 'path');
    loc.setAttribute('type', 'hidden');
    loc.value = path;
    form.appendChild(loc);

    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10) {
      console.log('TOKEN FOUND FOR SUBMIT....');

      var token = document.createElement('input');
      token.setAttribute('name', 'token');
      token.setAttribute('type', 'text');
      token.value = zs4.THIS._.token;
      form.appendChild(token);

    }
    else {
      console.log('NO TOKEN FOUND FOR SUBMIT....');
    }
    form.submit();
  }
  zs4.post = function(o,cb){

    var req = new zs4.request({input:o})

    if (!zs4.THIS._.zs4check(req,o)){
      console.log('zs4.post() not valid');
      console.log(req);
      zs4.THIS._.dcb(req.request.callback);
      if (cb) cb(req); return;
    }

    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10){
      req.request.token = zs4.THIS._.token;
    }
    else {
      req.request.token = null;
    }
    console.log(req);

  	zs4.io.post(req,function(ret){
      if (zs4.is.string(ret.request.token)&&ret.request.token.length>10&&zs4.is.string(ret.request.scope)){
        zs4.THIS._.token = ret.request.token;
        zs4.THIS._.scopath = ret.request.scope;
      }
      else {
        zs4.THIS._.token = null;
        zs4.THIS._.scopath = null;
      }
      console.log(ret);
  		zs4.THIS._.got(ret.reply);
      zs4.THIS._.dcb(ret.request.callback);
  		if (cb) cb(ret);
      else console.log('no callback specified for zs4.post()');
      //zs4.THIS._.dcb(ret.request.callback);
  	});
  };

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
      var script = zs4.THIS.zs4.head._.value.app.trim();
      if (script != ''){
        zs4.THIS._.print('loading script \''+script+'\'')
        zs4.loadscript(script);
      }
    });
  };
  zs4.style = {
    refresh:function(){
      zs4.style.element.innerHTML = '';
      var limit = 1024;
      var iw = window.innerWidth;
      if (iw > limit)iw = limit;
      var em = iw / 16;
      zs4.style.element.appendChild(document.createTextNode('*{box-sizing: border-box;font-size:'+em+'px;}\n.fouc{opacity:0}'));
    },
  };

  zs4.style.element = document.createElement('style');
  document.head.appendChild(zs4.style.element);
  zs4.style.refresh();
  window.onresize = function(){
    zs4.style.refresh();
  };
}
