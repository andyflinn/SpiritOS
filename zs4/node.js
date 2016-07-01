'use strict';

var zs4;
zs4 = new Object();
if (typeof window === 'undefined') {
    zs4 = exports;
}
else {
    zs4 = new Object();
}

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
      password:function(s){
        if	(!zs4.is.string(n) || s.trim()!=s || s.length < 4)return false;
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
    console.log('scanning....');
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
    noncircular:function(from){
      if (!zs4.is.object(from))return null;
      var a = [from];
      function c(o){
        for (var i = 0 ; i < a.length ; i++){
          if (a[i]==o)return true;return false;
        }
      }
      function recurse(f,t){
        for (var n in f){
          if (zs4.is.function(f[n])){
            //console.log(n+' is function.');
            continue;
          }
          if (zs4.is.object(f[n])){
            if(c(f[n]))continue;
            //console.log(n+' is object.');
            a.push(f[n]);
            var nu = new Object();
            recurse(f[n],nu);
            if (zs4.count.object.properties(nu)>0)t[n] = nu;
          }else{
            t[n] = f[n];
          }
        }
        return t;
      };
      return recurse(from,new Object());
    },

};

zs4.json =  {
  stringify:function(o){return JSON.stringify(zs4.copy.noncircular(o));},
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

zs4.processor = {
  sequential:function(){
    this.arr = [];
    this.count = 0;
    this.run = 0;
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
      //console.log(this);

    };
    this.run = function(cb){
      if (this.count==0){cb(this);return;}
      var cb_end = 'cb'+(this.count-1);
      this[cb_end] = (function(){
        //console.log('inside '+cb_end);
        //this.arr[i].result = arguments;
        cb(this);
      }).bind(this);

      this.foo0(this.cb0);
    };
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
  },

  property:function(schema,ns){
    if (!zs4.is.type(ns)){
      console.log('ADD SCHEMA FAILURE!!!!!  ');
      console.log(ns);
      return null;
    }
    //var debug = '   ';
    schema[ns.name] = ns;
    //debug += 'ns.name'

    if (ns.type == Object){
        //debug += ' Object';
        schema.value[ns.name] = ns.value;
    }
    else {
      schema.value[ns.name] = new ns.type();
      schema.value[ns.name] = ns.default;
      var d = schema.value[ns.name];
      //debug += ' Property value ' + d;
    }

    if (schema.path.length>0)ns.path = schema.path +'.'+ns.name;
    else ns.path = ns.name;

    //console.log('property('+zs4.json.stringify(ns)+')');
    //console.log(debug+' >> ('+zs4.json.stringify(schema.value)+')');
  },
  store:function(schema){
    console.log(schema.path+'.store()');
    if (schema.nostore)return null;
    var store = new Object();

    for (var n in schema){

      if (!zs4.is.type(schema[n])||schema[n].nostore==true)continue;

      console.log('storing '+n);

      if (schema[n].type == Object){
        var ret = zs4.type.store(schema[n])
        if (ret != null) store[n] = ret;
        continue;
      }

      store[n] = schema.value[n];
    }
    return store;
  },
  transformold:function(schema,input){
    console.log(schema.path+'.transform()');
    if (!zs4.is.object(input))return;
    for (var n in schema){
      if (!zs4.is.type(schema[n]))continue;

      if (schema[n].type == Object){
         if (zs4.is.object(input[n])) zs4.type.transform(schema[n],input[n]);
      }else{
        schema[n].transform(schema.value,input[n]);
      }
    }

    if (zs4.is.function(schema.api)){
      console.log('launching THIS.processor');
      THIS.processor.launch(schema.api,schema);
    }
    return schema.value;
  },
  transform:function(input,cb){
    console.log(this.path+'.transform()');
    if (!zs4.is.object(input))return;
    for (var n in this){
      if (!zs4.is.type(this[n]))continue;

      if (this[n].type == Object){
         if (zs4.is.object(input[n])) zs4.type.transform.call(this[n],input[n]);
      }else{
        this[n].transform(this.value,input[n]);
      }
    }

    if (cb)cb();
    //return this.value;
  },

  string:function(input){
    zs4.type.unknown.call(this,input);
    this.type = String;
    this.default = new String();
    if (zs4.is.boolean(input.trim))this.trim = input.trim; else this.trim = false;
    if (zs4.is.string(input.default))this.default = input.default;
    if (zs4.is.array(input.enum)){
      this.enum = input.enum;
    }else{
      if (zs4.is.number(input.minlength))this.minlength = parseInt(input.minlength);
      if (zs4.is.number(input.maxlength))this.maxlength = parseInt(input.maxlength);
    }

    this.transform = function(parent,input){
      console.log(this.path+'.transform(\''+input+'\')');

      if (input==null){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.string(this.default))parent[this.name]=this.default;
          else parent[this.name]=new String();
        }
        return this;
      }

      else if (zs4.is.string(input)){
        if (this.trim)parent[this.name]=input.trim();
        else parent[this.name]=input;
      }
      else{
        return new zs4.error({text:'bad input',data:{path:this.path,input:this.input}});
      }
    };

    return this;
  },
  integer:function(input){
    zs4.type.unknown.call(this,input);
    this.type = Number;
    this.default = new Number();
    if (zs4.is.number(input.default))this.default = parseInt(input.default);
    if (zs4.is.array(input.enum)){
      this.enum = input.enum;
    }else{
      if (zs4.is.number(input.min))this.min = parseInt(input.min);
      if (zs4.is.number(input.max))this.max = parseInt(input.max);
    }

    this.transform = function(parent,input){
      console.log(this.path+'.transform(\''+input+'\')');

      if (input==null){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.number(this.default))parent[this.name]=parseInt(this.default);
          else parent[this.name]=new Number(0);
        }
      }
      else if (zs4.is.number(input)){
        parent[this.name]=parseInt(input);
      }
      else if (zs4.is.string(input)){
        try{
          parent[this.name]=parseInt(input);
        }
        catch(err){}
        //parent[this.name]=parseInt(input);
      }
      else if (zs4.is.boolean(input)){
        if (input) parent[this.name]=1;
        else parent[this.name]=0;
      }
      else{
        return new zs4.error({text:'bad input',data:{path:this.path,input:this.input}});
      }
    };

    return this;
  },
  boolean:function(input){
    zs4.type.unknown.call(this,input);
    this.type = Boolean;
    this.default = new Boolean();
    if (zs4.is.boolean(input.default))this.default = input.default; else this.default = false;

    this.transform = function(parent,input){
      console.log(this.path+'.transform(\''+input+'\')');

      if (input==null){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.boolean(this.default))parent[this.name]=this.default;
          else parent[this.name]=new Boolean(false);
        }
      }
      else if (zs4.is.boolean(input)){
        parent[this.name]=input;
      }
      else if (zs4.is.string(input)){
        if (input=='true') parent[this.name]=true;
        if (input=='false') parent[this.name]=false;
      }
      else{
        return new zs4.error({text:'bad input',data:{path:this.path,input:this.input}});
      }
    };

    return this;
  },
  object:function(input){
    zs4.type.unknown.call(this,input);

    this.type = Object;
    this.value = new Object();

    this.path = '';

    return this;
  },

  flags:function(input){
    zs4.type.integer.call(this,input);

    this.transform = function(THIS,parent,input){
      console.log(this.path+'.transform(\''+input+'\')');

      if (input==null){
        if (!this.required){
          return null;
        }
        else{
          if (zs4.is.number(this.default))parent[this.name]=parseInt(this.default);
          else parent[this.name]=new Number(0);
        }
      }
      else if (zs4.is.number(input)){
        parent[this.name]=parseInt(input);
      }
      else if (zs4.is.string(input)){
        try{
          parent[this.name]=parseInt(input);
        }
        catch(err){}
        parent[this.name]=parseInt(input);
      }
      else if (zs4.is.boolean(input)){
        if (input) parent[this.name]=1;
        else parent[this.name]=0;
      }
      else{
        return new zs4.error({text:'bad input',data:{path:this.path,input:this.input}});
      }
    };

    return this;
  },
};

if (zs4.is.node()){

      zs4.transform = function(input,output){
        console.log('node.transform('+zs4.json.stringify(input)+')');
        var fs = require('fs');

        const ZS4 = 'zs4';
        const DOT_ZS4 = '.'+ZS4;
        const MAX_BYTE = 256;
        const MAX_WORD = (MAX_BYTE * MAX_BYTE);
        const SECOND = 1000;

        var value = null;
        console.log('___READ___');
        fs.readFile(DOT_ZS4,'utf8', function(err, data){
          console.log('readFile(\''+DOT_ZS4+'\')');
          function save(what){
            var save = zs4.json.stringify(what);
            console.log('writing '+DOT_ZS4+': '+save);
            fs.writeFile(DOT_ZS4,save, (err) => {
              if (err){
                if(zs4.is.function(output))output({text:'failed to save object'},null);
                return null;
              }
              if(zs4.is.function(output))output(null,true);
              return true;
            });
          };
          function respond(val,input,output){
            console.log('node.transform.respond('+zs4.json.stringify(val)+','+zs4.json.stringify(input)+')');

            console.log('___DEFINE___');
            var THIS = new zs4.type.object({name:'this',required:true,});
            zs4.type.property(THIS,new zs4.type.string({name:'abc',required:true,default:'def'}));
            zs4.type.property(THIS,new zs4.type.object({name:'zs4',required:true}));

            var password = require('./password');
            password.schema(THIS.zs4);

            var www = require('./www');
            www.schema(THIS.zs4);

            var store = require('./store');
            store.schema(THIS.zs4);

            console.log(zs4.json.stringify(THIS.value));

            console.log('___PROC___');
            var seq = new zs4.processor.sequential();
            seq.call(THIS,zs4.type.transform,val);
            seq.call(THIS,zs4.type.transform,input);
            seq.run(function(){
              console.log('___END___');
            });

            /*
            console.log('___LOAD___');
            console.log(zs4.json.stringify(val));
            zs4.type.transform.call(THIS,val);
            console.log(zs4.json.stringify(THIS.value));

            var must_save = false;

            if (!zs4.is.object(input)){
              var err = new zs4.error({text:'zs4.transform(): no argument, use zs4.transform({})'});
              if (zs4.is.function(output))output(err,null);
              console.log(err);
              return null;
            }

            console.log('___TRANSFORM___');
            var ret = zs4.type.transform.call(THIS,input);
            console.log(zs4.json.stringify(THIS.value));
            */

            console.log('___SAVE___');
            var out = zs4.type.store(THIS);
            console.log(out);
            save(out);
          };


          if (err) {
            console.log('creating new '+DOT_ZS4);
            value = new Object();
            respond(value,input,output)
          }
          else {
            console.log(data);
            value = zs4.json.parse(data);
            if (value==null){
              console.log('unable to parse '+DOT_ZS4);
              console.log('creating new '+DOT_ZS4);
              value = new Object();
            }

            respond(value,input,output);
          }

        });

      };
}
