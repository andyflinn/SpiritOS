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

      //if (zs4.is.boolean(from._.trim))to._.trim = from._.trim;
      //if (zs4.is.boolean(from._.arrayio))to._.arrayio=from._.arrayio;
      //if (zs4.is.boolean(from._.notrans))to._.notrans=from._.notrans;
      //if (zs4.is.boolean(from._.scope))to._.scope=from._.scope;
      //if (from._.noset==true)to._.noset=true;else to._.noset=false;
      //if (from._.api==true)to._.api=true;else to._.api=false;
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
    if (path == null || path.length == 0)return this;
    var a = zs4.string.split.separators(path,'./\\_-');
    if (a == null || a.length == 0)return null;
    var ret = this;
    for (var i = 0 ; i < a.length ; i++){
      if (!zs4.is.name(a[i])||!ret.hasOwnProperty(a[i])||!zs4.is.object(ret[a[i]])) return null;
      ret = ret[a[i]];
    }
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

// Create base64 Object
zs4.base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=zs4.base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=zs4.base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"\n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}

zs4.util = {
  flags:function(){
    this.value = 0;
    this.set = new Object();
    this.get = new Object();

    this.nodeflags = 0x0ffff;

    this.trim = 0x0001;
    this.arrayio = 0x0002;
    this.notrans = 0x0004;
    this.scope = 0x0008;
    this.noset = 0x0010;
    this.api = 0x0020;
    this.required = 0x0040;
    this.nostore = 0x0080;
    this.noget = 0x0100;
    this.am = 0x0200;
    this.own = 0x0400;

    this.getString = function(mask){
      var ret = '';
      function addFlag(s){
        if (ret.length == 0) ret = s; ret += (' '+s);

      }
      if (mask & this.trim) addFlag('trim');
      if (mask & this.arrayio) addFlag('arrayio');
      if (mask & this.notrans) addFlag('notrans');
      if (mask & this.scope) addFlag('scope');
      if (mask & this.noset) addFlag('noset');
      if (mask & this.api) addFlag('api');
      if (mask & this.required) addFlag('required');
      if (mask & this.nostore) addFlag('nostore');
      if (mask & this.noget) addFlag('noget');
      if (mask & this.am) addFlag('am');
      if (mask & this.own) addFlag('own');
      return ret;
    };

    this.set.trim = (function(tof){
      if (tof==true)this.value |= this.trim;
      else if (tof==false)this.value &= (~(this.trim));
      return this.value;
    }).bind(this);
    this.get.trim = (function(){
      if (this.value & this.trim)return true; return false;
    }).bind(this);

    this.set.arrayio = (function(tof){
      if (tof==true)this.value |= this.arrayio;
      else if (tof==false)this.value &= (~(this.arrayio));
      return this.value;
    }).bind(this);
    this.get.arrayio = (function(){
      if (this.value & this.arrayio)return true; return false;
    }).bind(this);

    this.set.notrans = (function(tof){
      if (tof==true)this.value |= this.notrans;
      else if (tof==false)this.value &= (~(this.notrans));
      return this.value;
    }).bind(this);
    this.get.notrans = (function(){
      if (this.value & this.notrans)return true; return false;
    }).bind(this);

    this.set.scope = (function(tof){
      if (tof==true)this.value |= this.scope;
      else if (tof==false)this.value &= (~(this.scope));
      return this.value;
    }).bind(this);
    this.get.scope = (function(){
      if (this.value & this.scope)return true; return false;
    }).bind(this);

    this.set.noset = (function(tof){
      if (tof==true)this.value |= this.noset;
      else if (tof==false)this.value &= (~(this.noset));
      return this.value;
    }).bind(this);
    this.get.noset = (function(){
      if (this.value & this.noset)return true; return false;
    }).bind(this);

    this.set.api = (function(tof){
      if (tof==true)this.value |= this.api;
      else if (tof==false)this.value &= (~(this.api));
      return this.value;
    }).bind(this);
    this.get.api = (function(){
      if (this.value & this.api)return true; return false;
    }).bind(this);

    this.set.required = (function(tof){
      if (tof==true)this.value |= this.required;
      else if (tof==false)this.value &= (~(this.required));
      return this.value;
    }).bind(this);
    this.get.required = (function(){
      if (this.value & this.required)return true; return false;
    }).bind(this);

    this.set.nostore = (function(tof){
      if (tof==true)this.value |= this.nostore;
      else if (tof==false)this.value &= (~(this.nostore));
      return this.value;
    }).bind(this);
    this.get.nostore = (function(){
      if (this.value & this.nostore)return true; return false;
    }).bind(this);

    this.set.noget = (function(tof){
      if (tof==true)this.value |= this.noget;
      else if (tof==false)this.value &= (~(this.noget));
      return this.value;
    }).bind(this);
    this.get.noget = (function(){
      if (this.value & this.noget)return true; return false;
    }).bind(this);

    this.set.am = (function(tof){
      if (tof==true)this.value |= this.am;
      else if (tof==false)this.value &= (~(this.am));
      return this.value;
    }).bind(this);
    this.get.am = (function(){
      if (this.value & this.am)return true; return false;
    }).bind(this);

    this.set.own = (function(tof){
      if (tof==true)this.value |= this.own;
      else if (tof==false)this.value &= (~(this.own));
      return this.value;
    }).bind(this);
    this.get.own = (function(){
      if (this.value & this.own)return true; return false;
    }).bind(this);

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
    if (zs4.is.boolean(input.required))this._.required = input.required; else this._.required = true;

    this._.flags = new zs4.util.flags();
    if (zs4.is.string(input.flags))this._.flags.setString(input.flags);

    if (zs4.is.boolean(input.array))this._.array = input.array;
    if (zs4.is.number(input.arraymaxlength))this._.arraymaxlength = parseInt(input.arraymaxlength);

    // support mongoose
    if (zs4.is.boolean(input.index) && input.index == true) this._.index = true;
    else if (zs4.is.object(input.index)&&zs4.is.boolean(input.index.unique)&&input.index.unique==true)this._.index={unique:true};

    if (zs4.is.array(input.authGet))this._.authGet = input.authGet;
    if (zs4.is.array(input.authSet))this._.authSet = input.authSet;

    this._.new = (function(){
      if (zs4.is.function(this._.create)){
        console.log('FROM CONSTRUCTIST!!!!');
        var r = new this._.create(this._);
        return r;
      }
      var ret = new zs4.type[this._.typename](this._);
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        var prop = this[n]._.new(this);
        if (prop != null) zs4.type.property(ret,prop);
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
    this._.shouldBeSaved = (function(args){
      //console.log('this.shouldBeSaved()');
      if (this._.nostore)return;
      console.log('this.shouldBeSaved('+this._.path+')');
      args.request.needsSaving = true;
    }).bind(this);

    this._.getInitialize = (function(req){
      //if (this._.path.startsWith('zs4.fso'))
      //  console.log('getInitialize '+this._.path);

      if (!this._.flags.get.noget() && req.authorize(this,this._.authGet)){
        //console.log('get init: \''+this._.path+'\'')
        var get = req.get(this);
        get._.name = this._.name;
        get._.typename = this._.typename;
        zs4.copy.schemabasics(this,get);

        var gflags = new zs4.util.flags();
        gflags.value = this._.flags.value;
        if (!this._.flags.get.noset()||this._.flags.get.api()){
          if (req.authorize(this,this._.authSet)){
            gflags.set.noset(this._.flags.get.noset());
            gflags.set.api(this._.flags.get.api());
          }
          else {
            gflags.set.noset(true);
            gflags.set.api(false);
          }
        }
        get._.flags = gflags.value;

        if (req.am(this)) {
          get._.flags |= this._.flags.am;
          //console.log('AM status! for '+this._.path);
        }
        if (req.own(this)) {
          get._.flags |= this._.flags.own;
          //console.log('OWN status! for '+this._.path);
        }

        return get;
      }
      return null;
    }).bind(this);
    this._.get = (function(req,po){
      var get = this._.getInitialize(req);
      if (get == null) return null;
      if (this._.type != Object && po!=null){
        get._.value = po._.value[this._.name];
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
      if (this._.type==Object){

        for (var n in o){
          if (!zs4.is.type(o[n]))continue;

          if (!this.hasOwnProperty(n)||!zs4.is.type(this[n])){
            var nu =new zs4.type[o[n]._.typename](o[n]._);
            nu._.name = o[n]._.name;
            nu._.typename = o[n]._.typename;
            zs4.type.property(this,nu);
          }

          this[n]._.got(o[n],this);
        }

        if (!this._.flags.get.arrayio()){

          for (var n in this){
            if (!zs4.is.type(this[n]))continue;
            if (zs4.is.type(o[n]))continue;

            if (zs4.is.function(this[n]._.cleanup))this[n]._.cleanup();
            this._.value[n]==null;
            this[n]==null;
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

      if (zs4.is.object(input)){
        if (zs4.is.object(input.error))this._.cberror = input.error;
        if (input.result != null)this._.cbresult = input.result;
      }

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (zs4.is.object(input)&&zs4.is.object(input[n])) this[n]._.dcb(input[n]);
        else this[n]._.dcb(null);
      }

      if (zs4.is.object(input)&&zs4.is.function(this._.callback))this._.callback(input);
    }).bind(this);

  },

  property:function(schema,ns){
    if (!zs4.is.type(ns)){
      console.log('ADD SCHEMA FAILURE!!!!!  ');
      console.log(ns);
      return null;
    }
    schema[ns._.name] = ns;
    if (schema._.path.length>0)ns._.path = schema._.path +'.'+ns._.name;
    else ns._.path = ns._.name;

    //if (ns._.path.startsWith('zs4.fso'))
    //  console.log('linking '+ns._.path);

    if (ns._.type == Object){

        //debug += ' Object';
        schema._.value[ns._.name] = ns._.value;

        for (var n in ns){
          if (!zs4.is.type(ns[n]))continue;
          zs4.type.property(ns,ns[n]);
        }
    }
    else {
      //schema._.value[ns._.name] = new ns._.type();
      schema._.value[ns._.name] = ns._.default;
    }

  },

  admin:function(){
    zs4.type.object.call(this,{name:'admin',flags:'required api',authGet:['zs4.public'],})
    this._.typename = 'admin';
    this._.create = zs4.type.admin;

    zs4.type.property(this,new zs4.type.string({name:'title',flags:'required',authGet:['zs4.public'],}));
    zs4.type.property(this,new zs4.type.integer({name:'created',flags:'required noset',authGet:['zs4.public'],}));
    zs4.type.property(this,new zs4.type.integer({name:'updated',flags:'required noset',authGet:['zs4.public'],}));
    zs4.type.property(this,new zs4.type.string({name:'app',required:true,default:'/admin.js',authGet:['zs4.public'],}))
  },
  array:function(input){
    zs4.type.object.call(this,input);
    this._.typename = 'array';

    if (!zs4.is.type(input.template))input.template = new zs4.type.object({name:'template'});

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

    zs4.type.property(this,new zs4.type.object({name:'config',flags:'required api',}));
    zs4.type.property(this.config,new zs4.type.integer({name:'maxlength',flags:'required',}));
    zs4.type.property(this.config,new zs4.type.integer({name:'lastid',flags:'required noset',}));

    zs4.type.property(this,new zs4.type.object({name:'method',flags:'required',}));

    zs4.type.property(this.method,new zs4.type.object({name:'new',flags:'required api'}));
    this.method.new._.transform = (function(req,cb){
      if (zs4.is.object(req.input)){
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
        nu.zs4.admin._.value.created = nu.zs4.admin._.value.updated = Date.now();
        THIS.array._.value[id] = nu._.store();

        THIS._.array.elementConnect(THIS.array,nu);

        nu._.transform(new zs4.request({request:req.request,input:null,}),function(){

          THIS._.shouldBeSaved(req);
        });

      }
      this._.get(req); cb(); return;
    }).bind(this.method.new);

    zs4.type.property(this.method,new zs4.type.object({name:'getall',flags:'required api',}));
    this.method.getall._.transform = (function(req,cb){
      if (zs4.is.object(req.input)){
        console.log(this._.path+'.transform()');

        var parallel = new zs4.processor.parallel();
        for (var n in THIS.array._.value){
          console.log(' .. '+n);

          var r = new zs4.request({request:req.request,input:null,});
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

    zs4.type.property(this.method,new zs4.type.object({name:'deleteall',flags:'required api',}));
    zs4.type.property(this.method.deleteall,new zs4.type.boolean({name:'sure',required:true,nostore:true,}));
    this.method.deleteall._.transform = (function(req,cb){
      if (zs4.is.object(req.input)){
        console.log(this._.path+'.transform('+JSON.stringify(req.input)+')');
        if (req.input.sure!=true){
          req.error(this,{text:'not sure'});
          this._.get(req); cb(); return;
        }
        THIS.array._.value = new Object();
        req.result(this,true);
        THIS._.shouldBeSaved(req);
      }
      this._.get(req); cb(); return;
    }).bind(this.method.deleteall);
    this.method.deleteall._.callback = (function(o){
      console.log('deleteall._.callback()');
      console.log(o);
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
    zs4.type.property(this,template);

    zs4.type.property(this,new zs4.type.object({name:'array',flags:'required arrayio',}));
    THIS.array._.load = (function(input){
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      zs4.copy.trim(input,THIS.array._.value);
      var count = zs4.count.object.properties(input);
      console.log('loaded '+count+' array elements');
    }).bind(THIS.array);
    THIS.array._.store = (function(){
      console.log(this.path+'.store()');
      var store = new Object();
      zs4.copy.trim(THIS.array._.value,store);
      var count = zs4.count.object.properties(store);
      console.log('saving '+count+' array elements');
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
            o._.value.zs4.admin.updated = Date.now();
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
      if (!zs4.is.object(req.input)){
        this._.get(req); cb(); return;
      }
      console.log(this._.path+'.transform()');

      var parallel = new zs4.processor.parallel();

      for (var n in req.input){
        if (!zs4.is.object(req.input[n]))continue;
        var childreq = new zs4.request({request:req.request,input:req.input[n],})
        childreq.elenam = n;
        parallel.call(this,this._.elementTransform,childreq);
      }

      var t = this;
      parallel.run(function(){
        t._.get(req); cb(); return;
      });
    }).bind(THIS.array);

  },
  boolean:function(input){
    zs4.type.unknown.call(this,input);
    this._.type = Boolean;
    this._.typename = 'boolean';
    this._.default = new Boolean();
    if (zs4.is.boolean(input.default))this._.default = input.default; else this._.default = false;

    this._.zs4check = (function(input){
      if (!zs4.is.boolean(input))return false;
      return true;
    }).bind(this);

    this._.load = (function(parent,input){
      if (input==null||!zs4.is.boolean(input)){
        if (!this._.required){
          return null;
        }
        else{
          if (zs4.is.boolean(this._.default))parent[this._.name]=this._.default;
          else parent[this._.name]=new Boolean(false);
          return this;
        }
      }
      parent[this._.name]=input;
    }).bind(this);

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');
      this._.shouldBeSaved(args);

      if (zs4.is.boolean(args.input)){
        args.parent[this._.name]=args.input;
        cb(args.input);
      }
      else if (zs4.is.string(args.input)){
        if (args.input=='true'){
          args.parent[this._.name]=true;
        }
        if (args.input=='false') {
          args.parent[this._.name]=false;
        }
        cb(args.parent[this._.name]);

      }
      else{
        cb(new zs4.error({text:'bad input',data:{path:this.path,input:args.input}}));
      }
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

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');
      this._.shouldBeSaved(args);

      if (zs4.is.email(args.input)){
        args.parent[this._.name]=args.input.trim();
        cb(args.parent[this._.name]);
      }
      else{
        cb(new zs4.error({text:'input not an email address',data:{path:this.path,input:args.input}}));
      }
    }).bind(this);
  },
  integer:function(input){
    zs4.type.unknown.call(this,input);
    this._.type = Number;
    this._.typename = 'integer';
    this._.default = new Number();

    this._.parseInt = function(v){
      var n = parseInt(v);
      if (n==NaN){
        if (zs4.is.number(this._.default))n = this._.default;
        else n = 0;
      }
      return n;
    }

    if (zs4.is.number(input.default))this._.default = this._.parseInt(input.default);
    else this._.default = 0;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this._.min = this._.parseInt(input.min);
      if (zs4.is.number(input.max))this._.max = this._.parseInt(input.max);
    }

    this._.zs4check = (function(input){
      if (!zs4.is.number(input))return false;
      if (zs4.is.number(this._.min)&&input<this._.min)return false;
      if (zs4.is.number(this._.max)&&input>this._.max)return false;
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return false;
      }
      return true;
    }).bind(this);

    this._.load = (function(parent,input){
      //console.log(this.path+'.load(\''+input+'\')');

      if (input==null || !zs4.is.number(input)){
        if (!this._.required){
          return null;
        }
        else{
          if (zs4.is.number(this._.default))parent[this._.name]=this._.parseInt(this._.default);
          else parent[this._.name]=new Number(0);
        }
      }
      parent[this._.name]=this._.parseInt(input);
    }).bind(this);

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');
      this._.shouldBeSaved(args);

      if (zs4.is.number(args.input)){
        args.parent[this._.name]=this._.parseInt(args.input);
      }
      else if (zs4.is.string(args.input)){
        try{
          args.parent[this._.name]=this._.parseInt(args.input);
        }
        catch(err){}
        //parent[this.name]=parseInt(input);
      }
      else if (zs4.is.boolean(args.input)){
        if (args.input) args.parent[this._.name]=1;
        else args.parent[this._.name]=0;
      }
      if (cb)cb(args.parent[this._.name]);
    }).bind(this);

  },
  name:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'name';
    this._.minlength = 1;
    this._.maxlength = zs4.const.STRING.MAXLENGTH;

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');
      this._.shouldBeSaved(args);

      if (zs4.is.name(args.input)){
        args.parent[this._.name]=args.input.trim();
        cb(args.parent[this._.name]);
      }
      else{
        cb(new zs4.error({text:'input not a name',data:{path:this.path,input:args.input}}));
      }
    }).bind(this);
  },
  number:function(input){
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

    this._.zs4check = (function(input){
      if (!zs4.is.number(input))return false;
      if (zs4.is.number(this._.min)&&input<this._.min)return false;
      if (zs4.is.number(this._.max)&&input>this._.max)return false;
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return false;
      }
      return true;
    }).bind(this);

    this._.load = (function(parent,input){
      //console.log(this.path+'.load(\''+input+'\')');

      if (input==null || !zs4.is.number(input)){
        if (!this._.required){
          return null;
        }
        else{
          if (zs4.is.number(this._.default))parent[this._.name]=this._.default;
          else parent[this._.name]=new Number(0);
        }
      }
      parent[this._.name]=parseFloat(input);
    }).bind(this);

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');

      this._.shouldBeSaved(args);

      if (zs4.is.number(args.input)){
        args.parent[this._.name]=args.input;
      }
      else if (zs4.is.string(args.input)){
        try{
          args.parent[this._.name]=parseFloat(args.input);
        }
        catch(err){}
        //parent[this.name]=parseInt(input);
      }
      else if (zs4.is.boolean(args.input)){
        if (args.input) args.parent[this._.name]=1;
        else args.parent[this._.name]=0;
      }
      if (cb)cb(args.parent[this._.name]);
    }).bind(this);

  },
  object:function(input){
    zs4.type.unknown.call(this,input);

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
           if (zs4.is.object(input[n])) this[n]._.load(input[n]);
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
      var get = this._.getInitialize(req);
      if (get==null)return null;
      //console.log(this._.path+'.get()');
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (this[n]._.type==Object){
          var nu = this[n]._.get(req,this);
          if (zs4.is.object(nu))get[n]=nu;
        }
        else{
          this[n]._.get(req,this);
        }
      }

      return get;
    }).bind(this);

    this._.transform = (function(req,cb){
      var THIS = this;

      if (this._.flags.get.scope()){
        req.scope = THIS;
        console.log('scope set to: \''+req.scope._.path+'\'');
      }

      //if (zs4.is.type(req.scope)){console.log('path:\''+THIS._.path+'\' scope(\''+req.scope._.path+'\')')}

      if (!req.authorize(this,this._.authGet)){this._.get(req); cb(); return;}

      if (zs4.is.object(req.input))console.log(this._.path+'.transform()');
      var parallel = new zs4.processor.parallel();

      //if (req.input!=null)console.log(THIS._.path+' cb-before: '+JSON.stringify(req.request.callback));
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        //if (this[n]._.path=='zs4.express.run')console.log('transform child type ok.'+this[n]._.path);

        if (req.input==null||req.input[n]==null){
          //if (this[n]._.path=='zs4.express.run')console.log('transform child NO INPUT!!!'+this[n]._.path);
          if (this[n]._.type == Object){
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:null,scope:req.scope,}));
          }
        }
        else if (zs4.is.object(req.input)&&!this._.flags.get.notrans()){
          //if (this[n]._.path=='zs4.express.run')console.log('transform child '+this[n]._.path);
          if (this[n]._.type == Object){
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:req.input[n],scope:req.scope,}));
          }else{
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:req.input[n],scope:req.scope,parent:this._.value,}));
          }
        }
      }

      parallel.run(function(){
        //if (req.input!=null)console.log(THIS._.path+' cb-after: '+JSON.stringify(req.request.callback));
        THIS._.get(req);
        //if (req.request.needsSaving==true){console.log('save obj '+THIS._.path);}
        cb();
      });

    }).bind(this);
  },
  password:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'password';
  },
  scope:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'this',flags:'required scope',authGet:['zs4.public'],})
    this._.typename = 'scope';
    zs4.type.property(THIS,new zs4.type.object({name:'zs4',flags:'required',authGet:['zs4.public'],}));
  },
  string:function(input){
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
      if (!zs4.is.number(this.minlength))this._.minlength = zs4.const.STRING.MINLENGTH;
      if (!zs4.is.number(this.maxlength))this._.maxlength = zs4.const.STRING.MAXLENGTH;
    }

    this._.zs4check = (function(input){
      if (!zs4.is.string(input))return false;
      if (zs4.is.number(this._.minlength)&&input.length<this._.minlength)return false;
      if (zs4.is.number(this._.maxlength)&&input.length>this._.maxlength)return false;
      if (zs4.is.array(this._.enum)&&this._.enum.length>0&&!zs4.string.array.is.element(this._.enum,input))return false;
      return true;
    }).bind(this);

    this._.load = (function(parent,input){
      //console.log(this.path+'.load(\''+input+'\')');
      if (input==null||!zs4.is.string(input)){
        if (!this._.required){
          return null;
        }
        else{
          if (zs4.is.string(this._.default))parent[this._.name]=this._.default;
          else parent[this._.name]=new String();
        }
        return this;
      }
      parent[this._.name]=input;
    }).bind(this);

    this._.transform = (function(args,cb){
      //console.log(this._.path+'._.transform(\''+args.input+'\')');
      this._.shouldBeSaved(args);

      if (zs4.is.string(args.input)){
        if (this.trim)args.parent[this._.name]=args.input.trim();
        else args.parent[this._.name]=args.input;
        cb(args.input);
      }
      else{
        cb(new zs4.error({text:'bad input',data:{path:this.path,input:args.input}}));
      }
    }).bind(this);

  },
  text:function(input){
    if (zs4.is.object(input)){
      input.maxlength = zs4.const.TEXT.MAXLENGTH;
    }
    else{
      input = {maxlength:zs4.const.TEXT.MAXLENGTH};
    }
    zs4.type.string.call(this,input);
    this._.typename = 'text';
  },
};

zs4.request = function(o){

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

  if (!zs4.is.object(this.request.get))
    this.request.get = new Object();

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
    console.log('error from '+ o._.path + ' ' + JSON.stringify(this.request.callback))

  }
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
      return;
    }
    r.result = result;
    console.log('result from '+ o._.path + ' ' + JSON.stringify(this.request.callback))

  }
  this.get = function(o,result){
    var get = this.resolvePath(o,this.request.get);
    if (!zs4.is.object(get._)) get._ = new Object();
    return get;
  }

  if (zs4.is.node()){
    //var token = require('../token');

    this.payloadRefresh = function(){
      if (zs4.is.string(this.request.token)&&this.request.token.length>10){
        if (!zs4.is.object(this.request.payload)){
          this.request.payload = zs4.THIS.zs4.token.decode(this.request.token);
          if (this.request.payload == null)this.request.token=null;
        }
      }
    };
    this.payloadRefresh();

    this.tokenCreate = function(nuload){
      this.request.token = zs4.THIS.zs4.token.encode(nuload);
      this.payloadRefresh();
    };

    if (!zs4.is.email(this.request.email))this.request.email = zs4.const.EMAIL.PUBLIC;
    if (!zs4.is.boolean(this.request.needsSaving)) this.request.needsSaving = false;

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
      if (this.request.payload.scope==this.scope._.path)return true;
      return false;
    };

    this.own = function(THIS){
      if (!zs4.is.object(this.request.payload))return false;
      if (this.scope._.path.startsWith(this.request.payload.scope)&&this.scope._.path.length>this.request.payload.scope.length)return true;
      return false;
    };

    this.authorize = function(THIS,arr){
      //console.log('authorizing... '+THIS.path);
      if (!zs4.is.array(arr))return this.userIsRoot();
      //console.log(arr);
      if (zs4.string.array.is.element(arr,'zs4.public')){
        return true;
      }
      return this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;
      //console.log(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){

        if (THIS.request.needsSaving){
          var now = Date.now();
          if (zs4.THIS.zs4.admin._.value.created == 0)zs4.THIS.zs4.admin._.value.created=now;
          zs4.THIS.zs4.admin._.value.updated=now;
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
      if (zs4.is.string(this.request.token))r.request.token = this.request.token;
      return r;
    };
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
  zs4.type.property(zs4.THIS.zs4,new zs4.type.admin());
  zs4.type.property(zs4.THIS.zs4,new zs4.type.object({name:'public',flags:'required nostore noget noset',}));
  zs4.type.property(zs4.THIS.zs4,new zs4.type.object({name:'owner',flags:'required nostore noget noset',}));
  zs4.type.property(zs4.THIS.zs4,new zs4.type.object({name:'self',flags:'required nostore noget noset',}));
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
    validPost:function(req,t,o){
      if (!zs4.is.type(t)||!zs4.is.object(o))return false;
      for (var n in t){
        if (!zs4.is.type(t[n])||t[n]._.type!=Object||!zs4.is.object(o[n]))continue;
        if (t[n]._.flags.get.notrans()){
          req.error(t[n],{text:'transform not accepted'});
          return false;
        }
        if (!zs4.io.validPost(req,t[n],o[n]))return false;
      }
      return true;
    },
  };

  zs4.post = function(o,cb){

    var req = new zs4.request({input:o})

    if (!zs4.io.validPost(req,zs4.THIS,o)){
      zs4.THIS._.dcb(req.request.callback);
      //console.log(req);
      if (cb) cb(req); return;
    }

    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10) req.request.token = zs4.THIS._.token;
    console.log(req);

  	zs4.io.post(req,function(ret){
      if (zs4.is.string(ret.request.token)&&ret.request.token.length>10)zs4.THIS._.token = ret.request.token;
      else zs4.THIS._.token = null;
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
    zs4.post({},function(){
      var script = zs4.THIS.zs4.admin._.value.app.trim();
      if (script != ''){
        zs4.loadscript(script);
      }
    });
  };

  zs4.admin();
}
