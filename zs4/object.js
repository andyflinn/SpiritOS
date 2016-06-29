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

zs4.error = function(o){
  this.text='unknown error';
  if (zs4.is.object(o)){
    if (zs4.is.string(o.text)){this.text = o.text.trim();}
    this.data = o.data;
  }
}

zs4.internal = {
  new:{
    schema:{
      object:function(input,output){
        console.log('object()');
        if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
          if (zs4.is.function(output))output({text:'no input'},null);
          return null;
        }
        console.log(input);
        //console.log('zs4.is.name(\''+o.name+'\')');

        this.name = input.name;
        this.type = Object;
        if (zs4.is.boolean(input.required))this.required = input.required; else this.required = true;
        this.object = zs4.new.schema.object;
        this.string = zs4.new.schema.string;
        this.integer = zs4.new.schema.integer;
        this.event = function(input,output){
          console.log('object.event()');
          if (!zs4.is.object(input)){
            if (zs4.is.function(output))output({text:'bad args'},null);
            return null;
          };

          if (zs4.is.object(input.new)){
            var res = new Object();;
            if (zs4.is.function(output))output(null,res);
            return res;
          }

          for (var n in input){
            //console.log(o[n]);
            if (!zs4.is.object(input[n]))continue;
            console.log(input[n]);
            if (n=='object'&&zs4.is.name(input[n].name)){
              this[input[n].name] = new object(input[n]);
              this[input[n].name].path = this.path + '.' + input[n].name;
            }
            else if (n=='string'&&zs4.is.name(input[n].name)){
              this[input[n].name] = new string(input[n]);
              this[input[n].name].path = this.path+'.'+input[n].name;
            }
            else if (n=='integer'&&zs4.is.name(input[n].name)){
              this[input[n].name] = new integer(input[n]);
              this[input[n].name].path = this.path+'.'+input[n].name;
            }
          }

          // operation would go here
          if (zs4.is.function(output))output(null,this);
        };

        if (zs4.is.function(output))output(null,this);
      },
    },
  }


};

zs4.new = {
  instance:function(schema,output){
    //console.log('instantiate()');
    //console.log(schema);
    function scanner(scan,item){
      if (zs4.is.object(item.item) && item.item.required){
        //console.log('instantiating '+item.path);
        var pp = scan.parentPath();
        if (pp=='')pp='data';
        else pp = 'data.'+pp;
        var parent = zs4.is.objectProperty(scan,pp)
        if (parent){
          parent[item.name] = item.item.event({new:{}});
        }

        //console.log('parent path: '+pp);
      }
    }
    var o = new Object();
    zs4.scan.object(schema,scanner,o);
    return (o);
  },
  schema:{
    string:function(input,output){
      console.log('string()');
      if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
        if (zs4.is.function(output))output({text:'no input'},null);
        return null;
      }
      console.log(input);

      this.name = input.name;
      this.type = String;
      if (zs4.is.boolean(input.required))this.required = input.required; else this.required = true;
      if (zs4.is.string(input.default))this.default = input.default;
      if (zs4.is.array(input.enum)){
        this.enum = input.enum;
      }else{
        if (zs4.is.number(input.minlength))this.minlength = parseInt(input.minlength);
        if (zs4.is.number(input.maxlength))this.maxlength = parseInt(input.maxlength);
      }

      this.event = function(input,output){
        console.log('string.event()');
        if (!zs4.is.object(input)){
          if (zs4.is.function(output))output({text:'bad args'},null);
          return null;
        };

        if (zs4.is.object(input.new)){
          var res = new String();;
          if (zs4.is.string(this.default))res = new String(this.default);
          if (zs4.is.function(output))output(null,res);
          return res;
        }

        for (var n in input){
          //console.log(o[n]);
          if (console.log(input[n]))continue;
        }

        // operation would go here
        if (zs4.is.function(output))output(null,this);
      };

      if (zs4.is.function(output))output(null,this);
    },
    integer:function(input,output){
      console.log('integer()');
      if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
        if (zs4.is.function(output))output({text:'no input'},null);
        return null;
      }
      console.log(input);

      this.name = input.name;
      this.type = Number;
      if (zs4.is.boolean(input.required))this.required = input.required; else this.required = true;
      if (zs4.is.number(input.default))this.default = parseInt(input.default);
      if (zs4.is.array(input.enum)){
        this.enum = input.enum;
      }else{
        if (zs4.is.number(input.min))this.min = parseInt(input.min);
        if (zs4.is.number(input.max))this.max = parseInt(input.max);
      }

      this.event = function(input,output){
        console.log('integer.event()');
        if (!zs4.is.object(input)){
          if (zs4.is.function(output))output({text:'bad args'},null);
          return null;
        };

        if (zs4.is.object(input.new)){
          var res = new Number();;
          if (zs4.is.number(this.default))res = new Number(parseInt(this.default));
          if (zs4.is.function(output))output(null,res);
          return res;
        }

      };

      if (zs4.is.function(output))output(null,this);
      return this;
    },
    object:function(input,output){
      return zs4.internal.new.schema.object.call(this,input,output);
    },

    schema:function(input,output){
      console.log('schema()');
      console.log(input);

      if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
        if (output)output({text:'no input'},null);
        return null;
      }

      this.path = input.name;
      this.name = input.name;

      if (zs4.is.boolean(input.required))this.required = input.required; else this.required = true;

      // handle type
      console.log('schema.new.type');
      this.type = Object;
      this.object = zs4.new.schema.object;
      this.string = zs4.new.schema.string;
      this.integer = zs4.new.schema.integer;
      this.event = function(input,output){
        console.log('schema.event()');
        if (input == null || !zs4.is.object(input)){
          if (zs4.is.function(output)) output({text:'no input'},null);
          return null;
        };
        console.log('past common event initialization');

        for (var n in input){
          //console.log(o[n]);
          if (!zs4.is.object(input[n]))continue;
          if (n=='object'&&zs4.is.name(input[n].name)){
            this[input[n].name] = new object(input[n]);
            this[input[n].name].path = this.path + '.' + input[n].name;
          }
          else if (n=='string'&&zs4.is.name(input[n].name)){
            this[input[n].name] = new string(input[n]);
            this[input[n].name].path = this.path+'.'+input[n].name;
          }
          else if (n=='integer'&&zs4.is.name(input[n].name)){
            this[input[n].name] = new integer(input[n]);
            this[input[n].name].path = this.path+'.'+input[n].name;
          }
          else {
            if (zs4.is.function(output)) output({text:'schema.event: not supported.',data:input[n]},null);
            return null;
          }
        }

        if (zs4.is.function(output)) output(null,this);
        return this;
      }

      if (zs4.is.function(output)) output(null,this);
      return this;
    },
  },

};

if (node){
  zs4.module = {
    require:function(str,output){
      console.log('require(\'./'+str+'\')');
      var r = null;
      try{
        r = require('./'+str);
      }
      catch(err){
        if (zs4.is.function(output))output(err,null);
        return null;
      }
      return r;
    },

  };

  zs4.event = function(input,output){

    console.log('zs4.event()');
    var fs = require('fs');

    const ZS4 = 'zs4';
    const DOT_ZS4 = '.'+ZS4;
    const OBJECT = 'object';
    const MAX_BYTE = 256;
    const MAX_WORD = (MAX_BYTE * MAX_BYTE);
    const SECOND = 1000;


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

    var THIS = null;
    fs.readFile(DOT_ZS4,'utf8', function(err, data){
      console.log('readFile(\''+DOT_ZS4+'\')');
      function save(){
        var save = JSON.stringify(THIS);
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
      function respond(THIS,input,output){
        var must_save = false;
        console.log('respond(THIS)');

        if (!zs4.is.object(input)){
          var err = new zs4.error({text:'zs4.event(): no argument'});
          if (zs4.is.function(output))output(err,null);
          console.log(err);
          return null;
        }
        else{
          var pc = zs4.count.object.properties(input);
          if (pc==0){
            fs.readdir('./zs4',function(err,arr){
              console.log('readdir(\'./zs4\')');
              if (err){
                input.error = new zs4.error({text:'can\'t readdir(\'./zs4\')'});
                if (zs4.is.function(output))output(input.error,null);
                console.log(input.error);
                return null;
              }

              var api = {};
              for (var i = 0 ; i < arr.length ; i++){
                if (arr[i]=='object.js')continue;
                var split = zs4.string.split.separators(arr[i],'.');
                if (split.length==2&&zs4.is.name(split[0])&&split[1]=='js'){
                  api[split[0]] = {};
                }
              }

              if (zs4.is.function(output))output(null,api);
              input.response = api;
              console.log(api);
              return api;
            });
          }
          else if (pc == 1){
            for (var n in input){
              var module = zs4.module.require(n);
              if (module == null){
                input[n].error = new zs4.error({text:'can\'t zs4.module.require(\'./'+n+'\')'});
                if (zs4.is.function(output))output(input[n].error,null);
                console.log(input[n].error);
                return null;
              }
              if (!THIS.hasOwnProperty(n)){
                must_save = true;
                THIS[n]=new Object();
              }

            }
          }

        }
      };

      //console.log('inside callback for: readFile(\''+DOT_ZS4+'\')');
      if (err) {
        console.log('creating new '+DOT_ZS4);
        THIS = new Object();
        respond(THIS,input,output)
      }
      else {
        THIS = zs4.json.parse(data);
        if (THIS==null){
          console.log('unable to parse '+DOT_ZS4);
          console.log('creating new '+DOT_ZS4);
          THIS = new Object();
        }
        respond(THIS,input,output)
      }

    });

  };
}
