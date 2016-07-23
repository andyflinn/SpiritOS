'use strict';

var zs4;
zs4 = new Object();
if (typeof window === 'undefined') {
    zs4 = exports;
}
else {
    zs4 = new Object();
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
    MAXLENGTH:256,
  },
  TEXT:{
    MINLENGTH:0,
    MAXLENGTH:256*256,
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
  SYSTEM:{
    ITSELF:'zs4@zs4.zs4',
    USER:'user@zs4.zs4',
    ADMIN:'admin@zs4.zs4',
    PUBLIC:'public@zs4.zs4',
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
        || !o.hasOwnProperty('name')
        || !o.hasOwnProperty('type')
        || !zs4.is.name(o.name)
        || !zs4.is.function(o.type)
        //|| !zs4.is.boolean(o.required)
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
          if (arr[i].trim() == trimmed)return true;
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
    trimToArray:function (arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        if (!zs4.string.array.is.element(to,arr[i].trim()))
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

zs4.scan = {
  object:function(obj,foo,data){
    zs4.console.log('scanning....');
    var scan = {
      o:obj,
      a:[],
      p:[],
      path:function(){
        var path = '';
        for (var i = 0 ; i < this.p.length ; i++){
          if (i>0)path+='.';
          path+=this.p[i];
        }
        return path;
      },
      parentPath:function(){
        var path = '';
        for (var i = 0 ; i < (this.p.length-1) ; i++){
          if (i>0)path+='.';
          path+=this.p[i];
        }
        return path;
      },
    }

    if (foo) scan.function = foo;
    if (data) scan.data = data;

    function item(path,name,item,parent){var ret = {path:path,name:name,item:item,parent:parent}; scan.a.push(ret); return ret;}
    function itemCircular(item){
      for (var i = 0 ; i < scan.a.length ; i++)if (scan.a[i].item==item)return true;
      return false;
    }
    function recurse(o){

      for (var n in o){
        scan.p.push(n);
        var path = scan.path();

        if (zs4.is.object(o[n])){
          //console.log('Object: '+o[n])
          if (itemCircular(o[n])){
            //console.log('circular: '+o[n])
          }
          else{
            var i = item(path,n,o[n],o);
            if (scan.function)scan.function(scan,i);
            recurse(o[n]);
          }
        }else{
          var i = item(path,n,o[n],o);
          if (scan.function)scan.function(scan,i);
          //item(path,n,o[n]);
        }
        scan.p.pop();
      };
    };

    recurse(obj);
    return scan;
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
  }
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
      //zs4.console.log('parallel callback');
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
        this.cb = cb;
        for (var i = 0 ; i < this.count ; i++){
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

    this.path = '';
    this.name = input.name;
    if (zs4.is.boolean(input.required))this.required = input.required; else this.required = true;
    if (zs4.is.function(input.api))this.api = input.api;
    if (zs4.is.boolean(input.nostore))this.nostore = input.nostore;
    if (zs4.is.boolean(input.noget))this.noget = input.noget;

    if (zs4.is.function(input.onchange)){
      this.onchange = input.onchange;
      //console.log('onchange installed for '+this.name);
    };

    // support mongoose
    if (zs4.is.boolean(input.index) && input.index == true) this.index = true;
    else if (zs4.is.object(input.index)&&zs4.is.boolean(input.index.unique)&&input.index.unique==true)this.index={unique:true};

  },

  property:function(schema,ns){
    if (!zs4.is.type(ns)){
      console.log('ADD SCHEMA FAILURE!!!!!  ');
      console.log(ns);
      return null;
    }
    schema[ns.name] = ns;

    if (ns.type == Object){
        //debug += ' Object';
        schema.value[ns.name] = ns.value;
    }
    else {
      schema.value[ns.name] = new ns.type();
      schema.value[ns.name] = ns.default;
      var d = schema.value[ns.name];
    }

    if (schema.path.length>0)ns.path = schema.path +'.'+ns.name;
    else ns.path = ns.name;
  },
  instance:function(schema){
    var instance = new Object();

    for (var n in schema){

      if (!zs4.is.type(schema[n]))continue;

      if (schema[n].type == Object){
        var ret = zs4.type.instance(schema[n])
        if (ret != null) instance[n] = ret;
        continue;
      }

      instance[n] = schema.value[n];
    }

    return instance;
  },

  validate:function(input){
    if (!zs4.is.object(input))return false;
    var ret = true;

    for (var n in this){
      if (this[n].required&&!input.hasOwnProperty(n))return false;

      if (this[n].type == Object){
        if (!this[n].validate(input[n]))return false;
        continue;
      }

      get[n] = this.value[n];
    }

    return true;
  },
  get:function(zs4id){
    //zs4.console.log(this.path+'.get()');
    if (this.noget){return null;}

    var get = new Object();

    for (var n in this){

      if (!zs4.is.type(this[n])||this[n].noget)continue;

      //zs4.console.log('getting '+n);

      if (this[n].type == Object){
        var ret;
        if (zs4.is.function(this[n].get))ret = this[n].get(zs4id);
        else ret = zs4.type.get.call(this[n],zs4id)

        if (ret != null) get[n] = ret;
        continue;
      }

      get[n] = this.value[n];
    }

    return get;
  },
  store:function(){
    //zs4.console.log(this.path+'.store()');
    if (this.nostore){return null;}
    var store = new Object();

    for (var n in this){

      if (!zs4.is.type(this[n])||this[n].nostore==true)continue;

      //zs4.console.log('storing '+n);

      if (this[n].type == Object){
        var ret = zs4.type.store.call(this[n])
        if (ret != null) store[n] = ret;
        continue;
      }

      store[n] = this.value[n];
    }

    return store;
  },
  load:function(input){
    if (!zs4.is.object(input))return;
    for (var n in this){
      if (!zs4.is.type(this[n]))continue;

      if (this[n].type == Object){
         if (zs4.is.object(input[n])) zs4.type.load.call(this[n],input[n]);
      }else{
        this[n].load(this.value,input[n]);
      }
    }
  },

  string:function(input){
    zs4.type.unknown.call(this,input);
    this.type = String;
    this.default = new String();
    if (zs4.is.boolean(input.trim))this.trim = input.trim; else this.trim = false;
    if (zs4.is.string(input.default))this.default = input.default;
    if (zs4.is.array(input.enum)){
      this.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.minlength))this.minlength = parseInt(input.minlength);
      if (zs4.is.number(input.maxlength))this.maxlength = parseInt(input.maxlength);
    }

    this.load = function(parent,input){
      //zs4.console.log(this.path+'.load(\''+input+'\')');
      if (input==null||!zs4.is.string(input)){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.string(this.default))parent[this.name]=this.default;
          else parent[this.name]=new String();
        }
        return this;
      }
      parent[this.name]=input;
    };

    this.transform = function(args,cb){
      //zs4.console.log(this.path+'.transform(\''+input+'\')');

      if (zs4.is.string(args.input)){
        if (this.trim)args.parent[this.name]=args.input.trim();
        else args.parent[this.name]=args.input;
        cb(args.input);
      }
      else{
        cb(new zs4.error({text:'bad input',data:{path:this.path,input:args.input}}));
      }
    };

    this.zs4check = function(input){
      if (!zs4.is.string(input))return false;
      if (zs4.is.number(this.minlength)&&input.length<this.minlength)return false;
      if (zs4.is.number(this.maxlength)&&input.length>this.maxlength)return false;
      if (zs4.is.array(this.enum)&&this.enum.length>0&&!zs4.string.array.is.element(this.enum,input))return false;
      return true;
    };

  },
  email:function(input){
    zs4.type.string.call(this,input);

    this.transform = function(args,cb){
      //zs4.console.log(this.path+'.transform(\''+input+'\')');

      if (zs4.is.email(args.input)){
        args.parent[this.name]=args.input.trim();
        cb(args.parent[this.name]);
      }
      else{
        cb(new zs4.error({text:'input not an email address',data:{path:this.path,input:args.input}}));
      }
    };
  },
  integer:function(input){
    zs4.type.unknown.call(this,input);
    this.type = Number;
    this.default = new Number();
    if (zs4.is.number(input.default))this.default = parseInt(input.default);
    if (zs4.is.array(input.enum)){
      this.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this.min = parseInt(input.min);
      if (zs4.is.number(input.max))this.max = parseInt(input.max);
    }

    this.load = function(parent,input){
      //zs4.console.log(this.path+'.load(\''+input+'\')');

      if (input==null || !zs4.is.number(input)){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.number(this.default))parent[this.name]=parseInt(this.default);
          else parent[this.name]=new Number(0);
        }
      }
      parent[this.name]=parseInt(input);
    }

    this.transform = function(args,cb){
      //zs4.console.log(this.path+'.transform(\''+input+'\')');

      if (zs4.is.number(args.input)){
        args.parent[this.name]=parseInt(args.input);
      }
      else if (zs4.is.string(args.input)){
        try{
          args.parent[this.name]=parseInt(args.input);
        }
        catch(err){}
        //parent[this.name]=parseInt(input);
      }
      else if (zs4.is.boolean(args.input)){
        if (args.input) args.parent[this.name]=1;
        else args.parent[this.name]=0;
      }
      if (cb)cb(args.parent[this.name]);
    }

    this.zs4check = function(input){
      if (!zs4.is.number(input))return false;
      if (zs4.is.number(this.min)&&input<this.min)return false;
      if (zs4.is.number(this.max)&&input>this.max)return false;
      if (zs4.is.array(this.enum)&&this.enum.length>0){
        for (var i = 0 ; i < this.enum.length ; i++){if (this.enum[i]==input)return true;}
        return true;
      }
      return true;
    };
  },
  boolean:function(input){
    zs4.type.unknown.call(this,input);
    this.type = Boolean;
    this.default = new Boolean();
    if (zs4.is.boolean(input.default))this.default = input.default; else this.default = false;

    this.load = function(parent,input){
      if (input==null||!zs4.is.boolean(input)){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.boolean(this.default))parent[this.name]=this.default;
          else parent[this.name]=new Boolean(false);
          return this;
        }
      }
      parent[this.name]=input;
    }

    this.transform = function(args,cb){
      //zs4.console.log(this.path+'.transform()');
      //zs4.console.log(args);

      if (zs4.is.boolean(args.input)){
        args.parent[this.name]=args.input;
        cb(args.input);
      }
      else if (zs4.is.string(args.input)){
        if (args.input=='true') args.parent[this.name]=true;
        if (args.input=='false') args.parent[this.name]=false;
        cb(args.parent[this.name]);
        //zs4.console.log('set to '+args.input);
        //zs4.console.log(args);

      }
      else{
        cb(new zs4.error({text:'bad input',data:{path:this.path,input:args.input}}));
      }
    };

    this.zs4check = function(input){
      if (!zs4.is.boolean(input))return false;
      return true;
    };
  },
  object:function(input){
    zs4.type.unknown.call(this,input);

    this.type = Object;
    this.value = new Object();

    this.path = '';

    this.transform = function(args,cb){
      //zs4.console.log('transforming '+this.path)

      if (!zs4.is.object(args.input)){
        if (cb)cb(new zs4.error({text:'input not an object.'}));
        return;
      }

      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n])||args.input[n]==null)continue;

        if (this[n].type == Object){
           if (zs4.is.object(args.input[n])) parallel.call(this[n],this[n].transform,{req:args.req,input:args.input[n]});
        }else{
          parallel.call(this[n],this[n].transform,{req:args.req,parent:this.value,input:args.input[n]});
        }
      }

      var THIS = this;
      parallel.run(function(){
        if (zs4.is.function(THIS.onchange)){THIS.onchange.call(THIS,args.req,cb);}
        else {cb();}
      });
      //if (this.type == Object)zs4.console.log(this.path+'.transform() done');

    };

  },

};

//zs4.console.log('___DEFINE___');
zs4.THIS = new zs4.type.object({name:'this',required:true,});
zs4.type.property(zs4.THIS,new zs4.type.object({name:'zs4',required:true,}));
