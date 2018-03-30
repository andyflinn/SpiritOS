var SCOPE = this;

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

function propertyObject(parent,name){
  var nu = new Object({});
  parent.p(name,{enumerable:false,value:nu});
  p.call(nu);
  return nu;
}

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

  B.p('c',{enumerable:false,value:function(R){
    R.stashValue(value);
  }});

  B.p('v',{
    enumerable:false,
    get:get,
    set:set,
  });
  B.p('and',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v & parseInt(v));
      }
    },
  });
  B.p('or',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v | parseInt(v));
      }
    },
  });
  B.p('xor',{
    enumerable:false,
    get:get,
    set:function(v){
      if (isNumber(v)){
        B.v = (B.v ^ parseInt(v));
      }
    },
  });
  B.p('not',{
    enumerable:false,
    get:function(){return ((~(B.v))&BITMASK) },
    set:function(v){
      if (isNumber(v)){
        B.v = ((~parseInt(v))&BITMASK);
      }
    },
  });

  propertyObject(B,'b');

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

    B.b.p(n,{
      value:{},
      enumerable:true,
    });
    p.call(B.b[n]);

    if (c.bitbits==true){
      var bb = new zBits({});
      B.b[n].p('bb',{enumerable:false,value:bb,});
    }

    B.b[n].p('value',{enumerable:false,value:v});
    B.b[n].p('mask',{enumerable:false,value:m});

    B.b[n].p('v',{get:get,set:set,enumerable:false,});

    B.b[n].p('and',{
      enumerable:false,
      get:get,
      set:function(v){
        if (isBoolean(v)){
          B.b[n].v = (B.b[n].v && v);
        }
      },
    });
    B.b[n].p('or',{
      enumerable:false,
      get:get,
      set:function(v){
        if (isBoolean(v)){
          B.b[n].v = (B.b[n].v || v);
        }
      },
    });
    B.b[n].p('xor',{
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
    B.b[n].p('not',{
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

  B.p('a',{enumerable:false,value:a,});

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

  propertyObject(B,'s');

  B.s.p('v',{
    enumerable:false,
    get:sGet,
    set:sSet,
  });
  B.s.p('and',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v & v);
      }
    },
  });
  B.s.p('or',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v | v);
      }
    },
  });
  B.s.p('xor',{
    enumerable:false,
    get:sGet,
    set:function(v){
      if (isString(v)){
        v = stringToValue(v);
        B.v = (B.v ^ v);
      }
    },
  });
  B.s.p('not',{
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
p = function(){
  var P = this;

  if (!isFunction(P.p)){
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
    function p(name,def){
      internal(prop,P,name,def);
    }
    if (DEBUG==true)internal(prop,P,'prop',{enumerable:false,value:prop})
    internal(prop,P,'p',{enumerable:false,value:p});
  }
}


e = function(){
  var E = this;
  p.call(E);

  if (!isObject(E.e))
  {
    var a = new Array();
    var t = new Array();
    function makeI(n,f){
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
    var event = propertyObject(E,'e');

    var type = propertyObject(event,'t');

    var define = function(n){
      if (!isName(n))throw 'notname';
      if (isObject(event.t[n]))return event.t[n];
      propertyObject(event.t,n);
      return event.t[n];
    }
    event.p('d',{enumerable:false,value:define,});

    var fire = function(n){
      for (var i = 0; i < a.length ; i++){
        if (a[i].n==n){
          a[i].f(event.t[n]);
        }
      }
    }
    event.p('f',{enumerable:false,value:fire,});

    var handler = propertyObject(event,'h');

    var add = function(n,f){
      if (!isName(n))throw 'notname';
      if (!isFunction(f))throw 'notfunction';
      if (!isObject(event.t[n]))throw 'nottype';
      var I = findI(n,f);
      if (isObject(I)){I.c++;}
      else {I = new makeI(n,f);}
      console.log(a,I);
      return I;
    }
    handler.p('a',{enumerable:false,value:add,});

    var remove = function(n,f){
      if (!isName(n))throw 'notname';
      if (!isFunction(f))throw 'notfunction';
      findI(n,f).d();
      console.log(a);
    };
    handler.p('r',{enumerable:false,value:remove,});
  }

};

z = function(c){
  var Z = this;
  if (c==null)c=new Object();
  p.call(Z);

  var zb = new zBits({bitbits:true});
  Z.p('zb',{enumerable:false,value:zb,});

  e.call(Z)
};

r = function(c){
  var R = this;
  z.call(R,c);

  var rb = new rBits({bitbits:true});
  R.p('rb',{enumerable:false,value:rb,});

  if (isString(c.rb))rb.s.v = c.rb;

  var output;
  if (isObject(c.output))output = c.output;
  else output = new Object();
  R.output = output;

  var path = new Array();
  R.p('path',{enumerable:false,value:path,})

  function currentPath(){
    var p = '';
    for (var i = 0 ; i < path.length; i++){
      if (i>0)p+='.';
      p+=path[i];
    }
    return p;
  }
  R.p('currentPath',{enumerable:false,value:currentPath,})

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
  R.p('stashValue',{enumerable:false,value:stashValue,})
}

o = function(c){
  var O = this;
  z.call(O,c);

  var value = new Object();
  var type = new Object();

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
  O.p('v',{
    enumerable:false,
    get:get,
    set:set,
  });

  O.p('c',{enumerable:false,value:function(R,cb){
    //if (!isFunction(cb)) throw 'nocb';
    var start = false;
    if (R==null){
      start = true;
      R = new r({});
    }

    for (var n in value){
      if (isFunction(value[n].c)){
        R.path.push(n);
        value[n].c(R);
        R.path.pop();
      }
    }

    if (start==true){
      console.log(R);
    }
  }});

  function a(t,n){
    //console.log(t,n)
    if (!isName(t)||!isFunction(O.t[t]))throw 'nottype';
    if (!isName(n))throw 'notname';
    if (O.hasOwnProperty(n))throw 'alreadyexists '+n;
    value[n] = new O.t[t]({});
    O.p(n,{value:value[n],enumerable:true,});
  }
  O.p('a',{enumerable:false,value:a,});

  function d(n){
    if (value.hasOwnProperty(n)){
      value[n].triggerEvent('delete');
      delete value[n];
    }
  }
  O.p('d',{enumerable:false,value:d,});

  propertyObject(O,'t');
  O.t.p('b',{enumerable:false,value:b,});
  O.t.p('f',{enumerable:false,value:f,});
  O.t.p('o',{enumerable:false,value:o,});
  //console.log(O.t)
};

v = function(c){
  var V = this;
  z.call(V,c);
}

t = function(c){
  var T = this;
  z.call(T,c);

  var tb = new tBits({bitbits:true});
  T.p('tb',{enumerable:false,value:tb,});
};

b = function(c){
  var B = this;
  v.call(B,c);

  bits.call(B,{bitbits:true});
};

f = function(c){
  var F = this;
  z.call(F,c);

  var fb = new fBits(c);
  F.p('fb',{enumerable:false,value:fb,});

  function validateArgs(c){
    if (isObject(c)&&isFunction(c.f)&&c.f.length==2){
      return true;
    }
    return false;
  }
  //F.p('validateArgs',{enumerable:false,value:validateArgs,})

  function noop(f,cb){if(cb)cb()};
  var foo = noop;
  function fooGet(){return foo;};
  function fooSet(f){if (isFunction(f)) foo = f;};
  F.p('foo',{
    enumerable:false,
    get:fooGet,
    set:fooSet,
  });

  function cbDefault(r){};
  var cb = cbDefault;
  function cbGet(){return cb;};
  function cbSet(f){if (isFunction(f)) cb = f;};
  F.p('cb',{
    enumerable:false,
    get:cbGet,
    set:cbSet,
  });

  var proc = new Array();
  F.p('proc',{enumerable:false,value:proc,})

  F.p('count',{
    enumerable:false,
    get:function(){return proc.length;},
  })
  var index = 0;
  F.p('index',{
    enumerable:false,
    get:function(){return index;},
  })

  function a(c){
    if (!validateArgs(c))return false;
    proc.push(c);
    return true;
  }
  F.p('a',{enumerable:false,value:a,});
};

o.call(SCOPE);

// testing
SCOPE.a('b','bits');
SCOPE.bits.a('a'); SCOPE.bits.b.a.v = true;
SCOPE.bits.a('b');
SCOPE.bits.a('c'); SCOPE.bits.b.c.v = true;
SCOPE.a('f','funk');
SCOPE.a('o','object');
SCOPE.object.a('b','morebits');
