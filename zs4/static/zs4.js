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
    schemabasics(from,to){
      if (!zs4.is.type(from)||!zs4.is.type(to))return;

      if (zs4.is.number(from._.min))to._.min=from._.min;
      if (zs4.is.number(from._.max))to._.max=from._.max;

      if (zs4.is.number(from._.minlength))to._.minlength=from._.minlength;
      if (zs4.is.number(from._.maxlength))to._.maxlength=from._.maxlength;
      if (zs4.is.array(from._.enum))to._.enum = from._.enum;
      if (zs4.is.boolean(from._.trim))to._.trim = from._.trim;
      if (zs4.is.boolean(from._.noset))to._.noset=from._.noset;
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
      //zs4.console.log('parallel callback '+this.count);
      this.count--;
      if (this.count==0){
        //zs4.console.log('all parallels ('+this.arr.length+') complete');
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
      //zs4.console.log('running parallel');
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
    //if (zs4.is.function(input.api))this._.api = input.api;

    if (zs4.is.boolean(input.nostore))this._.nostore = input.nostore;
    if (zs4.is.boolean(input.noget))this._.noget = input.noget;
    if (zs4.is.boolean(input.noset))this._.noset = input.noset;

    if (zs4.is.boolean(input.array))this._.array = input.array;
    if (zs4.is.number(input.arraymaxlength))this._.arraymaxlength = parseInt(input.arraymaxlength);

    // support mongoose
    if (zs4.is.boolean(input.index) && input.index == true) this._.index = true;
    else if (zs4.is.object(input.index)&&zs4.is.boolean(input.index.unique)&&input.index.unique==true)this._.index={unique:true};

    if (zs4.is.function(input.onchange)){
      this._.onchange = input.onchange;
    };

    if (zs4.is.array(input.authGet))this._.authGet = input.authGet;
    if (zs4.is.array(input.authSet))this._.authSet = input.authSet;

    this._.shouldBeSaved = (function(args){
      if (this._.nostore)return;
      //zs4.console.log('this.shouldBeSaved()');
      args.request.needsSaving = true;
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
      //zs4.console.log(this.path+'.get()');
      var get = this._.getInitialize(args,parent);
      if (get==null)return null;

      this._.getProperties(args,get);

      return get;
    }).bind(this);

    this._.got = (function(o,p){
      //zs4.console.log(this);
      if (!zs4.is.type(o))return;

      //zs4.console.log('got \''+this._.path+'\'');

      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        console.log('missmatching type or name');
        return;
      }

      zs4.copy.schemabasics(o,this);

      if (this._.typename=='object'){
        for (var n in o){
          if (!zs4.is.type(o[n]))continue;

          if (!this.hasOwnProperty(n)||!zs4.is.type(this[n])){
            zs4.type.property(this,new zs4.type[o[n]._.typename](o[n]._))
          }

          this[n]._.got(o[n],this);
        }
        for (var n in this){
          if (!zs4.is.type(this[n]))continue;
          if (zs4.is.type(o[n]))continue;

          if (zs4.is.function(this[n]._.cleanup))this[n]._.cleanup();
          this._.value[n]==null;
          this[n]==null;
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
        zs4.console.log('value without parent.')
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

    if (ns._.type == Object){
        //debug += ' Object';
        schema._.value[ns._.name] = ns._.value;
    }
    else {
      schema._.value[ns._.name] = new ns._.type();
      schema._.value[ns._.name] = ns._.default;
      //var d = schema._.value[ns._.name];
    }

    if (schema._.path.length>0)ns._.path = schema._.path +'.'+ns._.name;
    else ns._.path = ns._.name;
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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');
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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');
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
      //zs4.console.log(this.path+'.load(\''+input+'\')');

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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');
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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');
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
      //zs4.console.log(this.path+'.load(\''+input+'\')');

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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');

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

    this._.load = (function(input){
      //zs4.console.log('loading '+this._.path);
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
      //zs4.console.log(this.path+'.store()');
      if (this._.nostore){return null;}
      var store = new Object();

      for (var n in this){

        if (!zs4.is.type(this[n])||this[n]._.nostore==true)continue;

        //zs4.console.log('storing '+n);

        if (this[n]._.type == Object){
          var ret = this[n]._.store();
          if (ret != null) store[n] = ret;
          continue;
        }

        store[n] = this._.value[n];
      }

      return store;
    }).bind(this);

    this._.transform = (function(args,cb){
      //zs4.console.log('transforming '+this._.path);
      if (!zs4.is.object(args.input)){
        if (cb)cb(new zs4.error({text:'input not an object.'}));
        return;
      }

      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n])||args.input[n]==null)continue;

        if (this[n]._.type == Object){
          parallel.call(this[n],this[n]._.transform,new zs4.request({request:args.request,input:args.input[n],}));
        }else{
          parallel.call(this[n],this[n]._.transform,new zs4.request({request:args.request,input:args.input[n],parent:this._.value,}));
        }
      }

      var THIS = this;
      //zs4.console.log('parallel run '+THIS._.path);
      parallel.run(function(){
        //zs4.console.log('parallel done '+THIS._.path);
        if (zs4.is.function(THIS._.onchange)){THIS._.onchange.call(THIS,args,cb);}
        else {cb();}
      });
      //if (this.type == Object)zs4.console.log(this.path+'.transform() done');

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
      //zs4.console.log(this.path+'.load(\''+input+'\')');
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
      //zs4.console.log(this._.path+'._.transform(\''+args.input+'\')');
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

  if (zs4.is.object(o)){
    if (zs4.is.object(o.request))this.request = o.request;
    if (o.input!=null)this.input = o.input;
    if (zs4.is.object(o.parent))this.parent = o.parent;
  }

  if (!zs4.is.object(this.request))this.request = new Object();
  if (this.input==null)this.input = new Object();

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
      //zs4.console.log('token: \''+this.request.token+'\'');
      //zs4.console.log(this.request.payload);
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
      //zs4.console.log('authorizing... '+THIS.path);
      if (!zs4.is.array(arr))return this.userIsRoot();
      if (zs4.string.array.is.element(arr,zs4.const.EMAIL.PUBLIC)){
        //zs4.console.log('authorized public request to '+THIS.path);
        return true;
      }
      if (zs4.is.email(this.email)&&zs4.string.array.is.element(arr,this.email))return true;
      return this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;
      //zs4.console.log(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){
        //zs4.console.log(THIS);
        THIS.reply = zs4.THIS._.get(THIS);

        cb(this);

        if (THIS.request.needsSaving){
          //zs4.console.log('THIS.request.needsSaving');
          zs4.save(function(){zs4.console.log('THIS was saved')});
        }
      });
    };

    this.getReply = function(){
      var r = new Object({request:{},input:this.input,reply:this.reply});
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
          //zs4.console.log(d);
        }
      },JSON.stringify(o)
      );
      //return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
    },
  };

  zs4.post = function(o,cb){

    var req = new zs4.request({input:o})
    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10) req.request.token = zs4.THIS._.token;
    zs4.console.log(req);

  	zs4.io.post(req,function(ret){
      if (zs4.is.string(ret.request.token)&&ret.request.token.length>10)zs4.THIS._.token = ret.request.token;
      else zs4.THIS._.token = null;
      zs4.console.log(ret);
  		zs4.THIS._.got(ret.reply);
  		if (cb)cb(ret);
      else console.log('no callback specified for zs4.post()');
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
