var zs4 = {};
var node = false;

if (typeof window === 'undefined') {
    zs4 = exports;
    node = true;
} else {
    window.zs4 = zs4;
}

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
      arr = []; buf = '';
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

    function item(path,name,item){var ret = {path:path,name:name,item:item}; scan.a.push(ret); return ret;}
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
            var i = item(path,n,o[n]);
            if (scan.function)scan.function(scan,i);
            recurse(o[n]);
          }
        }else{
          var i = item(path,n,o[n]);
          if (scan.function)scan.function(scan,i);
          item(path,n,o[n]);
        }
        scan.p.pop();
      };
    };

    recurse(obj);
    return scan;
  },
};

zs4.json =  {
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

zs4.event = function(input,output){

  console.log('zs4.event()');
  var fs = require('fs');
  var http = require('http');
  var password = require('password-hash');
  const PASSWORD_ALGORITHM = 'sha1';
  const PASSWORD_SALTLENGTH = 32;
  const PASSWORD_ITERATIONS = 8;

  const ZS4 = 'zs4';
  const DOT_ZS4 = '.'+ZS4;
  const OBJECT = 'object';
  const MAX_BYTE = 256;
  const MAX_WORD = (MAX_BYTE * MAX_BYTE);
  const SECOND = 1000;

  // type checking utilities
  function isArray(a){
    if	(a==null)return false;
    return (a instanceof Array);
  };
  function isBoolean(b){
    if	(b==null)return false;
    if	(typeof(b)!='boolean')return false;
    return true;
  };
  function isFunction(f){
    if (f==null)return false;
    return (f instanceof Function);
  };
  function isString(s){
    if	(s==null)return false;
    if	(typeof(s)!='string')return false;
    return true;
  };
  function isPassword(s){
    if	(!isString(n) || s.trim()!=s || s.length < 4)return false;
    return true;
  };
  function isNumber(b){
    if	(b==null)return false;
    if	(typeof(b)!='number')return false;
    return true;
  };
  function isObject(o){
    if	(o==null)return false;
    if ((o instanceof Function)==true)return false;
    if	((o instanceof Array)==true)return false;
    if	(o instanceof Object)return true;
    return false;
  };
  function isName(n){
    if	(!isString(n))return false;
    if	(n=="zs4")return true;
    var l=n.length;
    if	(l<1)return false;
    for (var i=0;i<l;i++){
      if(n.charAt(i)<'a'||n.charAt(i)>'z')return false;
    }
    return true;
  };
  function isObjectProperty(o,p){
    if(!isObject(o)||!isString(p))return null;
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
  };
  function isSpace(ch){
    if (ch=='\n'||ch=='\r'||ch=='\t'||ch==' ')return true;
    return false;
  };

  // string functions
  function stringSplitWords(str){
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
  };
  function stringSplitSeparators(str,sep){
    arr = []; buf = '';
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
  };
  function stringToLower(str){return str.toLowerCase();};

  function stringArrayStringExists(arr,str){
    var trimmed = str.trim();
    for (var i = 0 ; i < arr.length ; i++){
      if (arr[i].trim() == trimmed)return true;
    }
    return false;
  };
  function stringArrayAddStringIfNew(arr,str){
    if (stringArrayStringExists(arr,str))return arr;
    arr.push(str.trim());
    return arr;
  };
  function StringArrayTrimToArray(arr,to){
    for (var i = (arr.length-1) ; i >= 0 ; i--){
      if (!stringArrayStringExists(to,arr[i].trim()))
        arr.splice(i,1);
    }
  };
  function StringArrayAddToArray(arr,to){
    for (var i = (arr.length-1) ; i >= 0 ; i--){
      stringArrayStringExists(to,arr[i]);
    }
  };

  // object scanners
  function scanObject(obj,foo,data){
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

    function item(path,name,item){var ret = {path:path,name:name,item:item}; scan.a.push(ret); return ret;}
    function itemCircular(item){
      for (var i = 0 ; i < scan.a.length ; i++)if (scan.a[i].item==item)return true;
      return false;
    }
    function recurse(o){

      for (var n in o){
        scan.p.push(n);
        var path = scan.path();

        if (isObject(o[n])){
          //console.log('Object: '+o[n])
          if (itemCircular(o[n])){
            //console.log('circular: '+o[n])
          }
          else{
            var i = item(path,n,o[n]);
            if (scan.function)scan.function(scan,i);
            recurse(o[n]);
          }
        }else{
          var i = item(path,n,o[n]);
          if (scan.function)scan.function(scan,i);
          item(path,n,o[n]);
        }
        scan.p.pop();
      };
    };

    recurse(obj);
    return scan;
  };


  function jsonParse(string,output){
    try {
      var r = JSON.parse(string);
      if (isFunction(output))output(null,r);
      return r;
    }
    catch(err) {
        if (isFunction(output))output(err,null);
        return null;
    }
  }


  // REAL ZS4 FUNCTIONS

  function string(input,output){
    console.log('string()');
    if (input == null || !isObject(input) || !isName(input.name)){
      if (isFunction(output))output({text:'no input'},null);
      return null;
    }
    console.log(input);

    this.name = input.name;
    this.type = String;
    if (isBoolean(input.required))this.required = input.required; else this.required = true;
    if (isString(input.default))this.default = input.default;
    if (isArray(input.enum)){
      this.enum = input.enum;
    }else{
      if (isNumber(input.minlength))this.minlength = parseInt(input.minlength);
      if (isNumber(input.maxlength))this.maxlength = parseInt(input.maxlength);
    }

    this.event = function(input,output){
      console.log('string.event()');
      if (!isObject(input)){
        if (isFunction(output))output({text:'bad args'},null);
        return null;
      };

      if (isObject(input.new)){
        var res = new String();;
        if (isString(this.default))res = new String(this.default);
        if (isFunction(output))output(null,res);
        return res;
      }

      for (var n in input){
        //console.log(o[n]);
        if (console.log(input[n]))continue;
      }

      // operation would go here
      if (isFunction(output))output(null,this);
    };

    if (isFunction(output))output(null,this);
  };

  function integer(input,output){
    console.log('integer()');
    if (input == null || !isObject(input) || !isName(input.name)){
      if (isFunction(output))output({text:'no input'},null);
      return null;
    }
    console.log(input);

    this.name = input.name;
    this.type = Number;
    if (isBoolean(input.required))this.required = input.required; else this.required = true;
    if (isNumber(input.default))this.default = parseInt(input.default);
    if (isArray(input.enum)){
      this.enum = input.enum;
    }else{
      if (isNumber(input.min))this.min = parseInt(input.min);
      if (isNumber(input.max))this.max = parseInt(input.max);
    }

    this.event = function(input,output){
      console.log('integer.event()');
      if (!isObject(input)){
        if (isFunction(output))output({text:'bad args'},null);
        return null;
      };

      if (isObject(input.new)){
        var res = new Number();;
        if (isNumber(this.default))res = new Number(parseInt(this.default));
        if (isFunction(output))output(null,res);
        return res;
      }

    };

    if (isFunction(output))output(null,this);
    return this;
  };

  function object(input,output){
    return objectChild.call(this,input,output);
  }

  function objectChild(input,output){
    console.log('object()');
    if (input == null || !isObject(input) || !isName(input.name)){
      if (isFunction(output))output({text:'no input'},null);
      return null;
    }
    console.log(input);
    //console.log('isName(\''+o.name+'\')');

    this.name = input.name;
    this.type = Object;
    if (isBoolean(input.required))this.required = input.required; else this.required = true;
    this.object = object;
    this.string = string;
    this.integer = integer;
    this.event = function(input,output){
      console.log('object.event()');
      if (!isObject(input)){
        if (isFunction(output))output({text:'bad args'},null);
        return null;
      };

      if (isObject(input.new)){
        var res = new Object();;
        if (isFunction(output))output(null,res);
        return res;
      }

      for (var n in input){
        //console.log(o[n]);
        if (!isObject(input[n]))continue;
        console.log(input[n]);
        if (n=='object'&&isName(input[n].name)){
          this[input[n].name] = new object(input[n]);
          this[input[n].name].path = this.path + '.' + input[n].name;
        }
        else if (n=='string'&&isName(input[n].name)){
          this[input[n].name] = new string(input[n]);
          this[input[n].name].path = this.path+'.'+input[n].name;
        }
        else if (n=='integer'&&isName(input[n].name)){
          this[input[n].name] = new integer(input[n]);
          this[input[n].name].path = this.path+'.'+input[n].name;
        }
      }

      // operation would go here
      if (isFunction(output))output(null,this);
    };

    if (isFunction(output))output(null,this);
  };

  function schema(input,output){
    console.log('schema()');
    console.log(input);

    if (input == null || !isObject(input) || !isName(input.name)){
      if (output)output({text:'no input'},null);
      return null;
    }

    this.path = input.name;
    this.name = input.name;

    if (isBoolean(input.required))this.required = input.required; else this.required = true;

    // handle type
    console.log('schema.new.type');
    this.type = Object;
    this.object = object;
    this.string = string;
    this.integer = integer;
    this.event = function(input,output){
      console.log('schema.event()');
      if (input == null || !isObject(input)){
        if (isFunction(output)) output({text:'no input'},null);
        return null;
      };
      console.log('past common event initialization');

      for (var n in input){
        //console.log(o[n]);
        if (!isObject(input[n]))continue;
        if (n=='object'&&isName(input[n].name)){
          this[input[n].name] = new object(input[n]);
          this[input[n].name].path = this.path + '.' + input[n].name;
        }
        else if (n=='string'&&isName(input[n].name)){
          this[input[n].name] = new string(input[n]);
          this[input[n].name].path = this.path+'.'+input[n].name;
        }
        else if (n=='integer'&&isName(input[n].name)){
          this[input[n].name] = new integer(input[n]);
          this[input[n].name].path = this.path+'.'+input[n].name;
        }
        else {
          if (isFunction(output)) output({text:'schema.event: not supported.',data:input[n]},null);
          return null;
        }
      }

      if (isFunction(output)) output(null,this);
      return this;
    }

    if (isFunction(output)) output(null,this);
    return this;
  };

  function instantiate(schema,output){
    //console.log('instantiate()');
    //console.log(schema);
    function scanner(scan,item){
      if (isObject(item.item) && item.item.required){
        //console.log('instantiating '+item.path);
        var pp = scan.parentPath();
        if (pp=='')pp='data';
        else pp = 'data.'+pp;
        var parent = isObjectProperty(scan,pp)
        if (parent){
          parent[item.name] = item.item.event({new:{}});
        }

        //console.log('parent path: '+pp);
      }
    }
    var o = new Object();
    scanObject(schema,scanner,o);
    return (o);
  }

  var THIS = null;
  //var zs4 = new Object();

/*
  zs4.http = new schema({name:'http',required:false,});
  zs4.http.event({object:{name:'server',required:false,}});
  zs4.http.server.event({integer:{name:'port',required:true,default:3000,}});
  zs4.http.server.event({object:{name:'secure',required:false,}});
  zs4.http.server.secure.event({integer:{name:'port',required:true,default:3443,}});
  zs4.http.server.secure.event({string:{name:'key',required:true,}});
  zs4.http.server.secure.event({string:{name:'cert',required:true,}});
*/

  console.log('reading '+DOT_ZS4);
  fs.readFile(DOT_ZS4,'utf8', function(err, data){
    //console.log('inside callback for: readFile(\''+DOT_ZS4+'\')');
    if (err) {
      console.log('creating new '+DOT_ZS4);
      THIS = new Object();
    }
    else {
      THIS = jsonParse(data);
      if (THIS==null){
        console.log('unable to parse '+DOT_ZS4);
        console.log('creating new '+DOT_ZS4);
        THIS = new Object();
      }
    }

    console.log(input);

    if (isObject(input)){
      if (isObject(input.password)){
        console.log('requiring(\'./password\')')
        var password = require('./password');

        /*
        zs4.password = new schema({name:'password',required:true,});

        function event(input,output){
          console.log('password.event()');
          if (input == null){
            if (isFunction(output))output({text:'no input'},null);
            return null;
          };

          if (isObject(input.initialized)){
            console.log(THIS);
            if (password.isHashed(THIS.password.hashed)){
              if (isFunction(output)) output(null,true);
              return true;
            }else{
              if (isFunction(output)) output(null,false);
              return false;
            }
          }

          if (isObject(input.set)){
            if (!isPassword(input.set.new)){
              if (isFunction(output)) output({text:'bad new password'},null);
              return null;
            }
            if (!password.isHashed(THIS.password.hashed)){
              THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
              if (isFunction(output)) output(null,true);
              return true;
            }
            else {
              if (!isPassword(input.set.old)||!password.verify(input.set.old,THIS.password.hashed)){
                if (isFunction(output)) output({text:'old password incorrect'},null);
                return null;
              }
              THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
              if (isFunction(output)) output(null,true);
              return true;
            }
          }
        };
        zs4.password.event({string:{name:'hashed',required:true,}})
        if (!THIS.hasOwnProperty('password')){THIS.password = instantiate(zs4.password);}
        */

      }
      // must return message options
      O = THIS;
    }
    else {
      O = THIS;
    }

    // SAVE OBJECT BACK TO DISK
    console.log('writing '+DOT_ZS4);
    var save = JSON.stringify(THIS);
    console.log(save);
    fs.writeFile(DOT_ZS4,save, (err) => {
      if (err){
        if(isFunction(output))output({text:'failed to save object'},null);
        return null;
      }
      if(isFunction(output))output(null,O);
      return O;
    });
  });

};
