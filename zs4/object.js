console.log('running zs4');
var fs = require('fs');

const ZS4 = 'zs4';
const DOT_ZS4 = '.'+ZS4;
const OBJECT = 'object';
const MAX_BYTE = 256;
const MAX_WORD = (MAX_BYTE * MAX_BYTE);
const SECOND = 1000;

var I = null;

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
  if(!this.object(o)||!this.string(p))return null;
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
    }
  }

  if (foo) scan.function = foo;
  if (data) scan.data = data;

  function item(path,name,item){scan.a.push({path:path,name:name,item:item})}
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
          item(path,n,o[n]);
          recurse(o[n]);
        }
      }else{
        item(path,n,o[n]);
      }
      scan.p.pop();
    };
  };

  recurse(obj);
  return scan;
};
function scanObjectForName(obj,name,type){
  console.log('scanObjectForName(' + obj + ',"' + name + '")');
  if (!isObject(obj) || !isName(name))return null;
  var scan = scanObject(obj);
  //console.log(scan);
  for (var i = 0 ; i < scan.a.length ; i++){
    //console.log('checking ' + scan.a[i].path);
    if (scan.a[i].name==name){
      if ((type==null)
        || (type==Object || isObject(scan.a[i].item))
        || (type==String || isString(scan.a[i].item))
        || (type==Number || isNumber(scan.a[i].item))
        || (type==Boolean || isBoolean(scan.a[i].item))
      ){
        console.log('found '+name);
        console.log(scan.a[i].item);
        return scan.a[i].item;
      }
    }
  }
  return null;
};

function pathResolve(path){
  if (path == null || path.length == 0)return this;
  var a = stringSplitSeparators(path,'./\\_-');
  if (a == null || a.length == 0)return null;

  var ret = this;
  for (var i = 0 ; i < a.length ; i++){
    if (!isName(a[i])||!ret.hasOwnProperty(a[i])||!isObject(ret[a[i]])) return null;
    ret = ret[a[i]];
  }

  return ret;
}

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
function call(input,output){
  console.log('call()');
  if (!isObject(input)){
    if (isFunction(output))output({text:'no input'},null);
    return null;
  }

  if (isFunction(output))output(null,this);
}

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

  this.event = function(input,output){
    console.log('string.event()');
    if (!isObject(input)){
      if (isFunction(output))output({text:'bad args'},null);
      return null;
    };

    console.log('past common event initialization');

    for (var n in input){
      //console.log(o[n]);
      if (console.log(input[n]))continue;
    }

    // operation would go here
    if (isFunction(output))output(null,this);
  };

  if (isFunction(output))output(null,this);
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
  this.event = function(input,output){
    console.log('object.event()');
    if (!isObject(input)){
      if (isFunction(output))output({text:'bad args'},null);
      return null;
    };

    console.log('past common event initialization');

    for (var n in input){
      //console.log(o[n]);
      if (!isObject(input[n]))continue;
      if (n=='object'&&isName(input[n].name)){
        console.log(o.object);

        this[input[n].name] = new object(input[n]);
        this[input[n].name].parent = this.path;
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

  this.path = '';
  this.name = input.name;

  if (isBoolean(input.required))this.required = input.required; else this.required = true;

  // handle type
  console.log('schema.new.type');
  this.type = Object;
  this.object = object;
  this.string = string;
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
        //console.log(o.object);

        this[input[n].name] = new object(input[n]);
        this[input[n].name].parent = this.path;
        this[input[n].name].path = input[n].name;
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

//if (!isObject(input)){if(isFunction(output))output({text:'no input'},null);return null;}


fs.readFile(DOT_ZS4,'utf8', (err, data) => {
  if (err) { I = new Object(); }
  else { I = jsonParse(data);}
  if (I == null) I = new Object();

  //I.zs4 = {
  //  this:new schema({name:'this'}),
  //};

  // SAVE OBJECT BACK TO DISK
  var save = JSON.stringify(I);
  fs.writeFile(DOT_ZS4,save, (err) => {
    if (err){
      if(isFunction(output))output({text:'failed to save object'},null);
      return null;
    }
    if(isFunction(output))output(null,I);
    return I;
  });

});

/*
if (this.object == null){
  var scan = null;
  if ( (input!=null)
    && (scan = scanObjectForName(input,OBJECT,Object))
  ){
    this.object = scan;
    this.object.zs4 = this;
    //install.call(this);

    console.log('this[\'this\'] = new schema({name:\'this\'});');
    this['this'] = new schema({name:'this'});
    this['this'].event({object:{name:'zs4',type:Object,}});
    console.log(this['this']);

    if (output)output(null,this);
    return this;
  }else{
    console.log('need zs4.event({object:{}})');
    if (output)output(null,this);
    return null;
  }
}


var call = new call();
*/

//if(isFunction(output))output(null,I)
//return I;
