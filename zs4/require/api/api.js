var A = this;

const DEBUG = false;
const NAMECHARS = 'zabcdefghijklmnopqrstuvwxy';

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
  //debugger;
  if	(o==null)return false;
  if	(o instanceof Object){
    if (typeof(o)=='function')return false;
    if	(typeof(o.length)=='number' || (o instanceof Array)==true)return false;
    return true;
  }
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
function isSpace(ch){
  if (ch=='\n'||ch=='\r'||ch=='\t'||ch==' ')return true;
  return false;
};
function isNumchar(ch){
  if (ch>='0'&&ch<='9')return true;
  return false;
};

function arraySearch(a,f){
  for(var i=0;i<a.length;i++){
    var r=f(a[i]);if(r!=null)return r;
  }
  return null;
}
function parseBoolean(v){
  if (v==null)return false;
  if (isBoolean(v))return v;
  if (isString(v)){
    if(v.length==0 || v=='false')return false;
    if(v=='true' || v=='1')return true;
    return true;
  }
  if (isNumber(v)){
    if(v==0)return false;
    return true;
  }
  return false;
}

var args = arguments;

var f, b, e, o, p, r, t, v, z;

function bits(c){
  var B = this;
  p.call(B);

  if (c==null)c=new Object();

  var i = 0;

  const L = 32;
  const BITMASK = 0x0ffffffff;

  var value = 0;
  function get(){return value;};
  function set(v){value = parseInt(v);};

  B.property('process',{enumerable:false,value:function(R){
    R.stashValue(value);
  }});

  B.property('v',{
    enumerable:false,
    get:get,
    set:set,
  });
  B.property('and',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v & parseInt(v));
      }
    },
  });
  B.property('or',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v | parseInt(v));
      }
    },
  });
  B.property('xor',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v ^ parseInt(v));
      }
    },
  });
  B.property('not',{
    enumerable:false,
    get:function(){return ((~(B.v))&BITMASK) },
    set:function(v){
      if (isNumber(v)){
        B.v = ((~parseInt(v))&BITMASK);
      }
    },
  });

  B.property('b',{
    value:{},
    enumerable:false,
  });
  p.call(B.b);

  function a(n,v){
    if (!isName(n))return;
    if (v==null)v=i++;
    var m = 1<<v;

    function get(){
      if(value & m)return true;return false;
    };
    function set(v){
      if (isBoolean(v)){
        if (v) {
          value |= m;
          return true;
        }
        else {
          value &= (~m);
          return false;
        }
      }
    }

    B.b.property(n,{
      value:{},
      enumerable:true,
    });
    p.call(B.b[n]);

    if (c.bitbits==true){
      var bb = new zBits({});
      B.b[n].property('bb',{enumerable:false,value:bb,});
    }

    B.b[n].property('value',{enumerable:false,value:v});
    B.b[n].property('mask',{enumerable:false,value:m});

    B.b[n].property('v',{get:get,set:set,enumerable:false,});

    B.b[n].property('and',{
      enumerable:false,
      get:get,
      set:function(v){
        if (isBoolean(v)){
          B.b[n].v = (B.b[n].v && v);
        }
      },
    });
    B.b[n].property('or',{
      enumerable:false,
      get:get,
      set:function(v){
        if (isBoolean(v)){
          B.b[n].v = (B.b[n].v || v);
        }
      },
    });
    B.b[n].property('xor',{
      enumerable:false,
      get:function(){if (B.b[n].v)return true; return false;},
      set:function(v){
        if (isBoolean(v)){
          if (v==true){
            if (B.b[n].v) B.b[n].v = false;
            else B.b[n].v = true;
          }
        }
      },
    });
    B.b[n].property('not',{
      enumerable:false,
      get:function(){if (B.b[n].v)return false; return true;},
      set:function(v){
        if (isBoolean(v)){
          if (v==true) B.b[n].v = false;
          else B.b[n].v = false;
        }
      },
    });

  };

  B.property('a',{enumerable:false,value:a,});

  function valueToString(v){
    v = parseInt(v);
    var s = '';
    for (var n in B.b){
      if (B.b[n].mask&v){
        if (s == '')s += n;
        else s += (' '+n);
      }
    }
    return s;
  }
  function stringToValue(s){
    var v = 0;
    if (isString(s)){
      var a = s.split(' ');
      for (var i = 0 ; i < a.length ; i++){
        if (B.b.hasOwnProperty(a[i]).trim){
          v |= B.b[a[i]].mask;
        }
      }
    }

    return v;
  }
  function sGet(){
    return valueToString(B.v);
  }
  function sSet(s){
    if (isString(s)){
      B.v = stringToValue(s);
    }
  }

  B.property('s',{
    value:{},
    enumerable:false,
  });
  p.call(B.s);

  B.s.property('v',{
    enumerable:false,
    get:sGet,
    set:sSet,
  });
  B.s.property('and',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v & v);
      }
    },
  });
  B.s.property('or',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v | v);
      }
    },
  });
  B.s.property('xor',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v ^ v);
      }
    },
  });
  B.s.property('not',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        B.v = ((~(B.v))&BITMASK);
      }
    },
  });

  return B;
}
function zBits(c){
  var B = this;
  bits.call(B,c);
  B.a('readable');
  B.a('writable');
  B.a('enumerable');
  B.a('hidden');

  B.b.readable.v = B.b.writable.v = true;
}
function tBits(c){
  var B = this;
  bits.call(B,c);
  B.a('window');
  B.a('global');
}
function rBits(c){
  var B = this;
  bits.call(B,{});
  B.a('store');
  B.a('get');
  B.a('set');
  B.a('changed');
}
function fBits(c){
  var B = this;
  bits.call(B,c);
  B.a('parallel');
  B.a('sequential');
  B.a('breakpoint');
  B.a('breakpointinactive');
}

// feature utils;
function propertyObject(parent,name){
  var nu = new Object({});
  parent.property(name,{enumerable:false,value:nu});
  p.call(nu);
  return nu;
}

p = function(){
  var P = this;

  if (!isFunction(P.property)){
    function internal(prop,P,name,def){
      Object.defineProperty(P,name,def);

      function po(P,name,def){
        var PO = this;
        PO.n = name;
        PO.d = def;
        PO.enumerable = function(){
          if (isBoolean(def.enumerable)){
            if (def.enumerable==true)return true;
            else return false;
          }
          else {
            return true;
          }
        };
      }

      prop.push(new po(P,name,def));
    }

    var prop = new Array();
    function property(name,def){
      internal(prop,P,name,def);
    }
    if (DEBUG==true)internal(prop,P,'prop',{enumerable:false,value:prop})
    internal(prop,P,'property',{enumerable:false,value:property});
  }
}


e = function(){
  var E = this;
  p.call(E);

  if (!isObject(E.event))
  {
    var a = new Array();
    var t = new Array();
    function I(n,f){
      var I = this;
      I.n = n;
      I.f = f;
      I.c = 1;
      I.d = function(){
        I.c--;
        if (I.c==0){
          for (var i=0;i<a.length;i++){
            if (a[i]==I && a[i].c==0){
              a.splice(i,1);
              break;
            }
          }
          return true;
        }
      }

      a.push(I);
    }

    function findI(n,f){
      for (var i=0;i<a.length;i++){
        if (a[i].n == n && a[i].f == f) return a[i];
      }
      return null;
    }
    var event = propertyObject(E,'event');

    var type = propertyObject(E.event,'type');

    var define = function(n){
      if (!isName(n))throw 'notname';
      if (isObject(event.type[n]))return event.type[n];
      propertyObject(event.type,n);
      return event.type[n];
    }
    event.property('d',{enumerable:false,value:define,});

    var fire = function(n){
      for (var i = 0; i < a.length ; i++){
        if (a[i].n==n){
          a[i].f(event.type[n]);
        }
      }
    }
    event.property('f',{enumerable:false,value:fire,});

    var handler = propertyObject(event,'h');

    var add = function(n,f){
      if (!isName(n))throw 'notname';
      if (!isFunction(f))throw 'notfunction';
      if (!isObject(event.type[n]))throw 'nottype';
      var I = findI(n,f);
      if (isObject(I)){I.c++;}
      else {I = new I(n,f);}
      console.log(a,I);
      return I;
    }
    handler.property('a',{enumerable:false,value:add,});

    var remove = function(n,f){
      if (!isName(n))throw 'notname';
      if (!isFunction(f))throw 'notfunction';
      findI(n,f).d();
      console.log(a);
    };
    handler.property('r',{enumerable:false,value:remove,});
  }

};

z = function(c){
  var Z = this;
  if (c==null)c=new Object();
  p.call(Z);

  var zb = new zBits({bitbits:true});
  Z.property('zb',{enumerable:false,value:zb,});

  e.call(Z)
};

r = function(c){
  var R = this;
  z.call(R,c);
  R.property('type',{enumerable:false,value:r});

  var rb = new rBits({bitbits:true});
  R.property('rb',{enumerable:false,value:rb,});

  if (isString(c.rb))rb.s.v = c.rb;

  var output;
  if (isObject(c.output))output = c.output;
  else output = new Object();
  R.output = output;

  var path = new Array();
  R.property('path',{enumerable:false,value:path,})

  function currentPath(){
    var p = '';
    for (var i = 0 ; i < path.length; i++){
      if (i>0)p+='.';
      p+=path[i];
    }
    return p;
  }
  R.property('currentPath',{enumerable:false,value:currentPath,})

  function stashValue(v){
    //console.log('R.stashValue(\''+currentPath()+'\')');
    var o = R.output;
    var s = o;
    for (var i = 0 ; i < (path.length-1); i++){
      if (!isObject(o[path[i]]))o[path[i]]=new Object();
      o = o[path[i]];
    }
    //console.log(s);
    o[path[(path.length-1)]] = v;
    //console.log(s);
  }
  R.property('stashValue',{enumerable:false,value:stashValue,})
}

o = function(c){
  var O = this;
  z.call(O,c);
  O.property('type',{enumerable:false,value:o});

  var value = new Object();
  var type = new Object();
  function to(n,t){
    var T = this;
    t.call(T);
    T.property('n',{value:n,enumerable:false,});
    T.property('c',{value:t,enumerable:false,});
  }

  function get(){
    var r = new Object();
    for (var n in value){
      r[n] = value[n].v;
    }
    return r;
  }
  function set(v){
    if (isObject(v)){
      for (var n in v){
        if (value.hasOwnProperty(n)) value[n] = v[n];
      }
    }
  }
  O.property('v',{
    enumerable:false,
    get:get,
    set:set,
  });

  O.property('process',{enumerable:false,value:function(R,cb){
    if (!isFunction(cb)) throw 'nocb';
    var start = false;
    if (R==null){
      start = true;
      R = new r({});
    }

    for (var n in value){
      if (isFunction(value[n].process)){
        R.path.push(n);
        value[n].process(R);
        R.path.pop();
      }
    }

    if (start==true){
      console.log(R);
    }
  }});

  function a(t,n){
    if (!type.hasOwnProperty(t))return;
    value[n] = new type[t].c({});
    if (value[n].type==o){
      for (var f in type){
        value[n].t(f,type[f].c);
      }
    }
    O.property(n,{value:value[n],enumerable:true,});

  }
  O.property('a',{enumerable:false,value:a,});

  function d(n){
    if (value.hasOwnProperty(n)){
      value[n].triggerEvent('delete');
      delete value[n];
    }
  }
  O.property('d',{enumerable:false,value:d,});

  function t(n,t){
    if (isName(n)){
      if (isFunction(t)){
        type[n] = new to(n,t);
      }
      else if (type.hasOwnProperty(n)){
        return type[n];
      }
      else {
        return false;
      }
    }
    else {
      var r = new Object();
      for (var n in type) r[n] = type[n];
      return r;
    }
  }
  O.property('t',{enumerable:false,value:t});

};

v = function(c){
  var V = this;
  z.call(V,c);
  V.property('type',{enumerable:false,value:v});
}
t = function(c){
  var T = this;
  z.call(T,c);

  var tb = new tBits({bitbits:true});
  T.property('tb',{enumerable:false,value:tb,});
};

b = function(c){
  var B = this;
  v.call(B,c);

  bits.call(B,{bitbits:true});
};

f = function(c){
  var F = this;
  z.call(F,c);
  F.property('type',{enumerable:false,value:f});

  var fb = new fBits(c);
  F.property('fb',{enumerable:false,value:fb,});

  function validateArgs(c){
    if (isObject(c)&&isFunction(c.f)&&c.f.length==2){
      return true;
    }
    return false;
  }
  //F.property('validateArgs',{enumerable:false,value:validateArgs,})

  function noop(f,cb){if(cb)cb()};
  var foo = noop;
  function fooGet(){return foo;};
  function fooSet(f){if (isFunction(f)) foo = f;};
  F.property('foo',{
    enumerable:false,
    get:fooGet,
    set:fooSet,
  });

  function cbDefault(r){};
  var cb = cbDefault;
  function cbGet(){return cb;};
  function cbSet(f){if (isFunction(f)) cb = f;};
  F.property('cb',{
    enumerable:false,
    get:cbGet,
    set:cbSet,
  });

  var proc = new Array();
  F.property('proc',{enumerable:false,value:proc,})

  F.property('count',{
    enumerable:false,
    get:function(){return proc.length;},
  })
  var index = 0;
  F.property('index',{
    enumerable:false,
    get:function(){return index;},
  })

  function a(c){
    if (!validateArgs(c))return false;
    proc.push(c);
    return true;
  }
  F.property('a',{enumerable:false,value:a,});
};

o.call(A);
A.t('b',b);
A.t('o',o);
A.t('f',f);

// testing
A.a('b','bits');
A.bits.a('a'); A.bits.b.a.v = true;
A.bits.a('b');
A.bits.a('c'); A.bits.b.c.v = true;
A.a('f','funk');
A.a('o','object');
A.object.a('b','morebits');
