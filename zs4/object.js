console.log('running zs4');

const ZS4 = 'zs4';
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
  if (!isName(name))return null;
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
function schema(name){
  if (name == null || !isName(name))return null;

  var schema = this;

  schema.name = {
    name:name,
    type:String,
    required:true,
    validate:isName,
    default:new String(),
  };

  schema.type = {
    name:'type',
    enum:[String,Boolean,Date,Number,Object,Function],
    required:true,
    default:Object,
  };

  schema.required = {
    name:'required',
    type:Boolean,
    required:true,
    default:true,
  };

  schema.default = {
    name:'default',
    type:Object,
    required:false,
  };

  // schema functions
  schema.validate = {
    name:'validate',
    type:Function,
    required:false,
  };

  schema.create = {
    name:'create',
    type:Function,
    required:false,
  };

  schema.onevent = {
    name:'onevent',
    type:Function,
    required:false,
    default:function(event){
    },
  };

  schema.zs4 = {
    event:function(){
    },
  };
};


// install. this runs as soon as
// this function receives an 'object' event;

// scan for input object
var inputObject = null;
var inputFunction = null;
for (var i = 0 ; i < arguments.length ; i++){
  if (isObject(arguments[i])&&inputObject==null)inputObject=arguments[i];
  if (isFunction(arguments[i])&&inputFunction==null)inputFunction=arguments[i];
}
console.log('inputObject:'+inputObject);

if (this.object == null){
  var scan = null;
  if ( (inputObject!=null)
    && (scan = scanObjectForName(inputObject,OBJECT,Object))
  ){
    this.object = scan;
    this.object.zs4 = this;
    //install.call(this);

    this.schema = new schema('schema');

    if (inputFunction)inputFunction(null,this);
    return this;
  }else{
    console.log('need zs4.event({object:{}})');
    if (inputFunction)inputFunction(null,this);
    return null;
  }
}

function Machine(){
  this.events = new Array();
};

function Event(object){
  this.path = '';
  this.data = object;
  this.reply = null;
  this.error = null;
  this.created = new Date();
  this.updated = this.created;
  this.expires = this.created + DEFAULT_EVENT_LIFETIME;
  this.pending = true;
};







return this;
