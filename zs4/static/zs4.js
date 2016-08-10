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
    SYSTEM:'zs4@zs4.zs4',
    USER:'user@zs4.zs4',
    ADMIN:'admin@zs4.zs4',
    PUBLIC:'public@zs4.zs4',
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
      arr = []; buf = '';
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
      if (zs4.is.boolean(from._.trim))to._.trim = from._.trim;
      if (zs4.is.boolean(from._.arrayio))to._.arrayio=from._.arrayio;
      if (zs4.is.boolean(from._.notrans))to._.notrans=from._.notrans;
      if (zs4.is.boolean(from._.noset))to._.noset=from._.noset;
      if (zs4.is.boolean(from._.api))to._.api=from._.api;
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

    if (zs4.is.boolean(input.notrans))this._.notrans = input.notrans;
    if (zs4.is.boolean(input.arrayio))this._.arrayio = input.arrayio;
    if (zs4.is.boolean(input.nostore))this._.nostore = input.nostore;
    if (zs4.is.boolean(input.noget))this._.noget = input.noget;
    if (zs4.is.boolean(input.noset))this._.noset = input.noset;

    if (zs4.is.boolean(input.array))this._.array = input.array;
    if (zs4.is.number(input.arraymaxlength))this._.arraymaxlength = parseInt(input.arraymaxlength);

    // support mongoose
    if (zs4.is.boolean(input.index) && input.index == true) this._.index = true;
    else if (zs4.is.object(input.index)&&zs4.is.boolean(input.index.unique)&&input.index.unique==true)this._.index={unique:true};

    if (zs4.is.array(input.authGet))this._.authGet = input.authGet;
    if (zs4.is.array(input.authSet))this._.authSet = input.authSet;

    this._.new = (function(parent){
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
      if (this._.nostore)return;
      //console.log('this.shouldBeSaved()');
      args.request.needsSaving = true;
    }).bind(this);

    this._.replyInitialize = (function(req){
      if (!this._.noget && req.authorize(this,this._.authGet)){
        var get = req.get(this);
        get._.name = this._.name;
        get._.typename = this._.typename;
        zs4.copy.schemabasics(this,get);
        return get;
      }
      return null;
    }).bind(this);
    this._.reply = (function(req,po){
      var get = this._.replyInitialize(req);
      if (get == null)return;
      if (this._.type != Object && po!=null){
        get._.value = po._.value[this._.name];
      }
    }).bind(this);

    this._.getProperties = (function(args,parent){
      for (var n in this){
        if (!zs4.is.type(this[n])||this[n]._.noget)continue;
        var ret = this[n]._.get(args,this);
        if (ret != null) parent[n] = ret;
      }
    }).bind(this);
    this._.getInitialize = (function(args,parent){
      if (this._.noget || !args.authorize(this,this._.authGet)){return null;}

      var get = new Object({_:{}});

      get._.name = this._.name;
      get._.typename = this._.typename;
      var thisIsObject = (this._.typename == 'object');
      if (!thisIsObject && parent!=null){
        get._.value = parent._.value[this._.name];
      }

      zs4.copy.schemabasics(this,get);

      return get;
    }).bind(this);
    this._.get = (function(args,parent){
      //console.log(this.path+'.get()');
      var get = this._.getInitialize(args,parent);
      if (get==null)return null;

      this._.getProperties(args,get);

      return get;
    }).bind(this);

    this._.got = (function(o,p){
      //console.log(this);
      if (!zs4.is.type(o))return;

      //console.log('got \''+this._.path+'\'');

      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        console.log('missmatching type or name');
        return;
      }

      zs4.copy.schemabasics(o,this);

      if (this._.type==Object){

        for (var n in o){
          if (!zs4.is.type(o[n]))continue;

          if (!this.hasOwnProperty(n)||!zs4.is.type(this[n])){
            zs4.type.property(this,new zs4.type[o[n]._.typename](o[n]._))
          }

          this[n]._.got(o[n],this);
        }

        if (!this._.arrayio){

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

  array:function(input){
    zs4.type.object.call(this,input)
    this._.typename = 'array';

    var THIS = this;

    THIS._.array = new Object();
    THIS._.array.addElements = (function(o){
      //console.log('add array elements');
      if (zs4.is.object(o.result)&&zs4.is.object(o.result.array)){
        var from = o.result.array;
        var to = THIS.array._.value;
        //console.log(from);
        for (var n in from){
          if (!to.hasOwnProperty(n))to[n] = new Object();
          //console.log(from[n]);
          zs4.copy.trim(from[n],to[n]);
          //console.log(to[n]);
        }
        //console.log(to);
        if (zs4.is.function(THIS._.refresh))THIS._.refresh();
      }
    }).bind(THIS);
    THIS._.array.clearAllElements = (function(o){
      this.array._.value = new Object();
      if (zs4.is.function(THIS._.refresh))THIS._.refresh();
    }).bind(THIS);
    zs4.type.property(this,new zs4.type.object({name:'config',required:true,api:true,}));
    zs4.type.property(this.config,new zs4.type.integer({name:'maxlength',required:true,}));
    zs4.type.property(this.config,new zs4.type.integer({name:'lastid',required:true,noset:true,}));

    zs4.type.property(this,new zs4.type.object({name:'method',required:true,}));

    zs4.type.property(this.method,new zs4.type.object({name:'new',required:true,api:true,}));
    this.method.new._.transform = (function(req,cb){
      console.log('transforming '+this._.path+' in '+ this._.zs4Parent()._.path);
      var length = zs4.count.object.properties(THIS.array._.value);
      if (THIS.config._.value.maxlength > 0 && length >= THIS.config._.value.maxlength){
        req.error(this,{text:'array limit reached'})
        cb();
        return;
      }

      THIS.config._.value.lastid++;
      var id = zs4.integer.to.name(THIS.config._.value.lastid);
      var nu = THIS.template._.new();
      nu.meta._.value.created = nu.meta._.value.updated = Date.now();
      THIS.array._.value[id] = nu._.store();
      var ret = {
        array:{},
      };
      ret.array[id] = nu._.store();
      req.result(this,ret);
      this._.shouldBeSaved(req);
      cb();
    }).bind(this.method.new);
    this.method.new._.callback = (function(o){
      THIS._.array.addElements(o);
    }).bind(this.method.new);

    zs4.type.property(this.method,new zs4.type.object({name:'deleteall',required:true,api:true,}));
    zs4.type.property(this.method.deleteall,new zs4.type.boolean({name:'sure',required:true,}));
    this.method.deleteall._.transform = (function(req,cb){
      console.log('transforming '+this._.path+' in '+ this._.zs4Parent()._.path);
      if (req.input.sure!=true){
        req.error(this,{text:'not sure'});
        cb();return;
      }
      THIS.array._.value = new Object();
      req.result(this,{array:{}});
      this._.shouldBeSaved(req);
      cb();
    }).bind(this.method.deleteall);
    this.method.deleteall._.callback = (function(o){
      console.log('deleteall._.callback(o): '+JSON.stringify(o));
      if (!o.hasOwnProperty('error'))THIS._.array.clearAllElements(o);
    }).bind(this.method.deleteall);

    zs4.type.property(this.method,new zs4.type.object({name:'getall',required:true,api:true,}));
    this.method.getall._.transform = (function(req,cb){
      console.log('transforming '+this._.path+' in '+ this._.zs4Parent()._.path);
      var ret = {
        array:{},
      };
      zs4.copy.trim(THIS.array._.value,ret.array);
      req.result(this,ret);
      cb();
    }).bind(this.method.getall);
    this.method.getall._.callback = (function(o){
      THIS._.array.addElements(o);
    }).bind(this.method.getall);

    zs4.type.property(this,new zs4.type.object({name:'template',required:true,notrans:true,}));
    zs4.type.property(this.template,new zs4.type.object({name:'meta',required:true,api:true,}));
    zs4.type.property(this.template.meta,new zs4.type.string({name:'title',required:true,}));
    zs4.type.property(this.template.meta,new zs4.type.integer({name:'created',required:true,noset:true,}));
    zs4.type.property(this.template.meta,new zs4.type.integer({name:'updated',required:true,noset:true,}));
    zs4.type.property(this.template,new zs4.type.object({name:'this',required:true,}));

    zs4.type.property(this,new zs4.type.object({name:'array',required:true,arrayio:true,}));
    THIS.array._.load = (function(input){
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;
      zs4.copy.trim(input,THIS.array._.value);
    }).bind(THIS.array);
    THIS.array._.store = (function(){
      //console.log(this.path+'.store()');
      if (this._.nostore){return null;}
      var store = new Object();
      zs4.copy.trim(THIS.array._.value,store);
      return store;
    }).bind(THIS.array);

    THIS.array._.elementConnect = (function(schema,ns){
      ns._.path = schema._.path +'.'+ns._.name;
      if (ns._.type == Object){
          for (var n in ns){
            if (!zs4.is.type(ns[n]))continue;
            THIS.array._.elementConnect(ns,ns[n]);
          }
      }
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
      //console.log('transforming '+this._.path+'.'+req.elenam);
      THIS.array._.elementLoad(req,function(ret){
        if (ret==null){
          req.error(THIS.array,THIS.array._.path+'.'+req.elenam+' not found');
          cb();return;
        }
        var o = THIS.template._.new();
        o._.name = req.elenam;
        o._.notrans = false;
        o._.load(ret);
        THIS.array._.elementConnect(THIS.array,o);
        o._.transform(req,function(){
          var save = o._.store();
          req.elesav = save;
          THIS.array._.elementSave(req,function(){});
          var ret = {
            array:{},
          };
          ret.array[req.elenam] = save;
          req.result(THIS.method.new,ret);
          cb();
        });
      });
    }).bind(THIS.array);
    THIS.array._.transform = (function(req,cb){
      //console.log('transforming '+this._.path+' in '+ this._.zs4Parent()._.path);
      if (!zs4.is.object(req.input)){
        req.error(this,{text:'input not an object.'});
        cb(); return;
      }

      var parallel = new zs4.processor.parallel();

      for (var n in req.input){
        if (!zs4.is.object(req.input[n]))continue;
        var childreq = new zs4.request({request:req.request,input:req.input[n],})
        childreq.elenam = n;
        parallel.call(this,this._.elementTransform,childreq);
      }

      parallel.run(cb);
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

    if (zs4.is.boolean(input.api))this._.api = input.api;

    this._.dcb = (function(input){
      //console.log('loading '+this._.path);
      if (!zs4.is.object(input))return;

      for (var n in this){
        if (!zs4.is.type(this[n])||this[n]._.type!=Object)continue;
           if (zs4.is.object(input[n])) this[n]._.dcb(input[n]);
      }

      if (zs4.is.function(this._.callback))this._.callback(input);
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

    this._.reply = (function(req,po){
      if (req.authorize(this,this._.authGet)){
        var get = this._.replyInitialize(req);
        for (var n in this){
          if (zs4.is.type(this[n])&&this[n]._.type!=Object){
            this[n]._.reply(req,this);
          }
        }
      }
    }).bind(this);

    this._.transform = (function(req,cb){
      console.log('transforming '+this._.path+' in '+ this._.zs4Parent()._.path);
      var THIS = this;
      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (req.input==null||req.input[n]==null){
          if (this[n]._.type == Object){
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:null,}));
          }
        }
        else if (zs4.is.object(req.input)&&!this._.notrans){
          if (this[n]._.type == Object){
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:req.input[n],}));
          }else{
            parallel.call(this[n],this[n]._.transform,new zs4.request({request:req.request,input:req.input[n],parent:this._.value,}));
          }
        }
      }

      parallel.run(function(){
        THIS._.reply(req);
        cb();
      });

    }).bind(this);
  },
  password:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'password';
  },
  string:function(input){
    zs4.type.unknown.call(this,input);
    this._.type = String;
    this._.typename = 'string';
    this._.default = new String();
    if (zs4.is.boolean(input.trim))this._.trim = input.trim; else this._.trim = false;
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
  }

  if (!zs4.is.object(this.request))this.request = new Object();
  if (this.input==null)this.input = new Object();

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
  }
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      console.log(BADPATH);
      return;
    }
    r.result = result;
    //console.log(result);
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

    this.tokenCreate = function(claims){
      this.request.token = zs4.THIS.zs4.token.encode(claims);
      this.payloadRefresh();
    };

    if (!zs4.is.email(this.request.email))this.request.email = zs4.const.EMAIL.PUBLIC;

    this.request.needsSaving = false;

    this.userIsRoot = function(){
      if (zs4.is.object(this.request.payload)&&this.request.payload.rpw)return true;
      if (zs4.is.email(this.email)&&zs4.THIS.zs4.admin._.value.email==this.email)return true;
      if (this.node) return true;
      return false;
    };

    this.authorize = function(THIS,arr){
      //console.log('authorizing... '+THIS.path);
      if (!zs4.is.array(arr))return this.userIsRoot();
      if (zs4.string.array.is.element(arr,zs4.const.EMAIL.PUBLIC)){
        //console.log('authorized public request to '+THIS.path);
        return true;
      }
      if (zs4.is.email(this.email)&&zs4.string.array.is.element(arr,this.email))return true;
      return this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;
      //console.log(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){
        //console.log(THIS);
        THIS.reply = zs4.THIS._.get(THIS);

        cb(this);

        if (THIS.request.needsSaving){
          //console.log('THIS.request.needsSaving');
          zs4.save(function(){console.log('THIS was saved')});
        }
      });
    };

    this.getReply = function(){
      var r = new Object({request:{},input:this.input,reply:this.reply,});
      r.request.callback = this.request.callback;
      r.request.state = this.request.get;
      if (zs4.is.object(this.request.payload))this.tokenCreate(this.request.payload);
      if (zs4.is.string(this.request.token))r.request.token = this.request.token;
      return r;
    };
  }
  else{
    this.userIsRoot = function(){return true;};

    this.authorize = function(THIS,arr){return true;};

    this.request.needsSaving = false;

    this.process = function(cb){

    }
  }
};

zs4.THIS = new zs4.type.object({name:'this',required:true,authGet:[zs4.const.EMAIL.PUBLIC,],});
zs4.type.property(zs4.THIS,new zs4.type.object({name:'zs4',required:true,authGet:[zs4.const.EMAIL.PUBLIC,],}));

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
        if (t[n]._.notrans){
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
      zs4.THIS._.dcb(ret.request.callback);
  	});
  };

  zs4.admin = function(){
    zs4.post({},function(){
      var js=document.createElement('script');
      js.setAttribute("type","text/javascript");
      js.setAttribute("src", '/admin.js');
      document.head.appendChild(js);
    });

  };
}

zs4.um = {
  _convert:{
    linear:function(quantity,from,to){
      if (from==null || to == null
      ||!this.hasOwnProperty(from)
      || from.length < 1
      || from.charAt(0)=='_'
      ||!this.hasOwnProperty(to)
      || to.length < 1
      || to.charAt(0)=='_'
      )return zs4.create.error('bad args');

      return (quantity * this[from] / this[to]);
    }
  },
  _quantifyable(arg){
    if (arg == null || !zs4.is.name(arg)){
      var ret = [];
      for (var n in zs4.um){if (zs4.is.name(n))ret.push(n);}
      return ret;
    }

    var ret = [];
    for (var n in zs4.um)if (n==arg){
      //console.log('check '+n);
      for (var u in zs4.um[n]){
        //console.log('um '+u);
        if(zs4.is.name(u))ret.push(u);
      }
    }
    return ret;
  },

},
zs4.um.unit = {
  _convert:zs4.um._convert.linear,
  one:1.0,
  two:2.0,
  three:3.0,
  four:4.0,
  five:5.0,
  six:6.0,
  seven:7.0,
  eight:8.0,
  nine:9.0,
  ten:10.0,
  eleven:11.0,
  twelve:12.0,
  thirteen:13.0,
  fourteen:14.0,
  fifteen:15.0,
  sixteen:16.0,
  seventeen:17.0,
  eighteen:18.0,
  nineteen:19.0,

  teen:10.0,
  twenty:20.0,
  thirty:30.0,
  fourty:40.0,
  fifty:50.0,
  sixty:60.0,
  seventy:70.0,
  eighty:80.0,
  ninety:90.0,

  hect:100.0,
  hecto:100.0,
  hundred:100.0,

  thousand:1000.0,
  myriad:10000.0,
  mega:1000000,
  million:1000000,

  uni:1.0,
  unit:1.0,
  solo:1.0,

  semi:0.5,
  hemi:0.5,
  demi:0.5,
  half:0.5,
  third:(1.0/3.0),
  quarter:0.25,
  fifth:0.2,
  sixth:(1.0/6.0),
  seventh:(1.0/7.0),
  eighth:0.125,
  nineth:(1.0/9.0),
  tenth:0.1,

  kilo: 1000,
  mega: 1000000,
  giga: 1000000000,
  tera: 1000000000000,
  peta: 1000000000000000,
  exa:  1000000000000000000,
  zetta:1000000000000000000000,
  yotta:1000000000000000000000000,

  deci:0.1,
  centi:0.01,
  milli:0.001,
  micro:0.000001,
  nano: 0.000000001,
  pico: 0.000000000001,
  femto:0.000000000000001,
  atto: 0.000000000000000001,
  zepto:0.000000000000000000001,
  yocto:0.000000000000000000000001,

  pi:Math.PI,

  couple:2.0,
  pair:2.0,
  duo:2.0,
  duet:2.0,
  twin:2.0,

  try:3.0,
  ter:3.0,
  trio:3.0,
  tri:3.0,
  triplet:3.0,

  quartet:4.0,
  quad:4.0,
  quint:5.0,
  quintet:5.0,
  sextet:6.0,
  septet:7.0,
  octet:8.0,

  dozen:12.0,
  score:20.0,

  gross:144.0,
};
zs4.um.mass = {
  _convert:zs4.um._convert.linear,
  gram:1.0,
  kilogram: 1000,
  megagram: 1000000,
  gigagram: 1000000000,
  teragram: 1000000000000,
  petagram: 1000000000000000,
  exagram:  1000000000000000000,
  zettagram:1000000000000000000000,
  yottagram:1000000000000000000000000,

  decigram:0.1,
  centigram:0.01,
  milligram:0.001,
  microgram:0.000001,
  nanogram: 0.000000001,
  picogram: 0.000000000001,
  femtogram:0.000000000000001,
  attogram: 0.000000000000000001,
  zeptogram:0.000000000000000000001,
  yoctogram:0.000000000000000000000001,

  dalton:1.66053e-24,
  pound:453.59237,
  ounce:28.349523125,
  ton:1000000,
  tonne:1000000,
  kiloton:1000000000,
  quintal:100000,
  hundredweightus:45359.237,
  hundredweightuk:50802.34544,
  slug:14593.902937205,
  pennyweight:1.55517384,
  carat:0.2,
  grain:0.06479891,
  stoneus:5669.904625,
  stoneuk:6350.29318,

  electron:9.1093897e-28,
  muon:1.8835327e-25,
  proton:1.6726231e-24,
  neutron:1.6749286e-24,
  deuteron:3.343586e-24,

  earth:5.976e+27,
  sun:2e+33,

};
zs4.um.time = {
  _convert:zs4.um._convert.linear,
  second:1.0,
  minute:60.0,
  hour:(60.0*60.0),
  day:(60.0*60.0*24.0),
  moon:(60.0*60.0*24.0*29.530587981),
  week:(60.0*60.0*24.0*7),

  year:(60.0*60.0*24.0*365.25),
  olympiad:(60.0*60.0*24.0*365.25*4),
  lustrum:(60.0*60.0*24.0*365.25*5),
  indiction:(60.0*60.0*24.0*365.25*15),
  decade:(60.0*60.0*24.0*365.25*10),
  jubilee:(60.0*60.0*24.0*365.25*50),
  century:(60.0*60.0*24.0*365.25*100),
  millenium:(60.0*60.0*24.0*365.25*1000),
  kiloannum:(60.0*60.0*24.0*365.25*1000),
  month:(60.0*60.0*24.0*365.25/12.0),

  millisecond:0.001,
  microsecond:0.000001,
  nanosecond: 0.000000001,
  picosecond: 0.000000000001,
  femtosecond:0.000000000000001,
  attosecond: 0.000000000000000001,
  zeptosecond:0.000000000000000000001,
  yoctosecond:0.00000000000000000000001,
  kilosecond: 1000,
  megasecond: 1000000,
  gigasecond: 1000000000,
  terasecond: 1000000000000,
  petasecond: 1000000000000000,
  exasecond:  1000000000000000000,
  zettasecond:1000000000000000000000,
  yottasecond:1000000000000000000000000,
};
zs4.um.information = {
  _convert:zs4.um._convert.linear,
  byte:1.0,
  kilobyte:1024.0,
  megabyte:1024.0*1024.0,
  gigabyte:1024.0*1024.0*1024.0,
  terabyte:1024.0*1024.0*1024.0*1024.0,

  bit:0.125,
  kilobit:0.125*1024.0,
  megabit:0.125*1024.0*1024.0,
  gigabit:0.125*1024.0*1024.0*1024.0,
  terabit:0.125*1024.0*1024.0*1024.0*1024.0,

  nibble:0.5,
  word:2,
  dword:4,
  qword:8,
};
zs4.um.liquid = {
  _convert:zs4.um._convert.linear,
  cubicmeter:1.0,
  barreloil:6.2898107280219,
  barreluk:6.1102568971969,
  barrelus:8.5216794934986,
  boardfeet:423.776000658,
  busheluk:27.496156037386,
  bushelus:28.377593256211,
  centilitre:100000,
  cubiccentimetre:1000000,
  cubicdecimetre:1000,
  cubicfeet:35.314666721489,
  cubicinch:61023.744094732,
  cubicyard:1.3079506193144,
  cups:4000,
  cupsuk:3519.5079727854,
  cupsus:4226.7528377304,
  decilitre:10000,
  decalitre:100,
  dram:270512.18161474,
  fluidounceuk:35195.077544697,
  fluidounceus:33814.022701843,
  gallonsuk:219.96923465436,
  gallonsus:264.17205235815,
  hectolitre:10,
  kilolitre:1,
  litre:1000,
  millilitre:1000000,
  peckuk:109.98462415,
  peckus:113.51037228,
  pintuk:1759.7538772348,
  pintus:2113.3764188652,
  quartuk:879.87693861742,
  quartus:1056.6882094326,
  tablespoon:66666.666666667,
  tablespoonuk:56312.127564567,
  tablespoonus:67628.045403686,
  teaspoon:200000,
};
zs4.um.distance = {
  _convert:zs4.um._convert.linear,
  meter:1.0,
  kilometer:1000.0,
  decimeter:0.1,
  centimeter:0.01,
  millimeter:0.001,
  micrometer:0.000001,
  nanometer: 0.000000001,
  picometer: 0.000000000001,
  femtometer:0.000000000000001,
  attometer: 0.000000000000000001,
  zeptometer:0.000000000000000000001,
  yoctometer:0.000000000000000000000001,

  kilometer: 1000,
  megameter: 1000000,
  gigameter: 1000000000,
  terameter: 1000000000000,
  petameter: 1000000000000000,
  exameter:  1000000000000000000,
  zettameter:1000000000000000000000,
  yottameter:1000000000000000000000000,

  inch:0.0254,
  mil:(0.0254/1000),
  thou:(0.0254/1000),
  foot:12*0.0254,
  yard:3*12*0.0254,
  mile:5280*12*0.0254,
  league:3*5280*12*0.0254,

  fathom:2*3*12*0.0254,
  nauticalmile:1852,

  angstrom:0.0000000001,

  lightyear:9460730472580800,
  parsec:9460730472580800*3.26,
};
zs4.unit = {
  _exists:function(name){
    if (name==null || !zs4.is.name(name) || !zs4['unit'].hasOwnProperty(name))false;
    return true;
  },
  _create:function(name){
    if (name==null || !zs4.is.name(name))return null;
    if (zs4['unit'].hasOwnProperty(name))return zs4['unit'][name];
    zs4['unit'][name] = {};
  },

};
