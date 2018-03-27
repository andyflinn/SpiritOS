var A = this;

var args = arguments;

console.log(arguments);
function a(fCheck,idx){

}

function p(o,p,def){
  console.log('p(',o,',',p,',',def,');');
  Object.defineProperty(o,p,def);
};


function z(){
  var Z = this;

  var on = new Object();
  function hasEventHandler(name){
    if (!zs4.is.name(name))return false;
    if (!on.hasOwnProperty(name))return false;
    return true;
  };
  p(Z,'hasEventHandler',{enumerable:false,value:hasEventHandler,});
  function triggerEvent(name){
    if (!on.hasOwnProperty(name))return;

    var ON = on[name];
    for (var i = 0; i < ON.f.length;i++){
      ON.f[i](ON);
    }
  }
  p(Z,'triggerEvent',{enumerable:false,value:triggerEvent,});
  function on(name,func,remove){
    if (!zs4.is.name(name))return false;
    if (!zs4.is.function(func))return false;
    var ON;
    if (on.hasOwnProperty(name)){
      ON = on[name];
    }
    else {
      if (remove) return false;
      ON = on[name] = new Object();
      ON.f = new Array();
    }

    var found = false;
    for (var i = 0; i < ON.f.length;i++){
      if (ON.f[i]==func){
        if (remove==true){
          ON.f.splice(i,1);
          if (ON.f.length==0){
            delete on[name];
          }
          return false;
        }
        found=true;
      }
    }
    if (!found)ON.f.push(func);

    return true;
  };
  p(Z,'on',{enumerable:false,value:on,});

};

function j(j){
  var J = this;
  if (j==null)return JSON.stringify(J.v);
  if (zs4.is.string(j)){
    try {
      JSON.parse()
    }
    catch (e){

    }
  }
}

function o(){
  var O = this;
  z.call(O);

  var value = new Object();
  var type = new Object();
  function to(n,t){
    var T = this;
    T.n = n;
    T.c = t;
  }

  function get(){
    var r = new Object();
    for (var n in value){
      r[n] = value[n];
    }
    return r;
  }
  function set(v){
    if (zs4.is.object(v)){
      for (var n in v){
        if (value.hasOwnProperty(n)) value[n] = v[n];
      }
    }
  }
  p(O,'v',{
    enumerable:false,
    get:get,
    set:set,
  });

  function a(t,n){
    if (!type.hasOwnProperty(n))return;
    value[n] = new type[n].c();
  }
  p(O,'a',{enumerable:false,value:a,});
  function d(n){
    if (value.hasOwnProperty(n)) delete value[n];
  }
  p(O,'d',{enumerable:false,value:d,});

  function t(n,t){
    if (zs4.is.name(n)){
      if (zs4.is.function(t)){
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
  p(O,'t',{enumerable:false,value:t});
};

function t(){
  var T = this;
  o.call(T);

};

function b(){
  var B = this;
  z.call(B);

  var value = 0;
  function get(){return value;};
  function set(v){value = parseInt(v);};

  p(B,'v',{
    enumerable:false,
    get:get,
    set:set,
  });

  p(B,'b',{
    value:{},
    enumerable:false,
  });

  var i = 0;

  const L = 32;
  const BITMASK = 0x0ffffffff;

  function a(n,v){
    if (!zs4.is.name(n))return;
    if (v==null)v=i++;
    var m = 1<<v;

    function get(){
      if(value & m)return true;return false;
    };
    function set(v){
      if (zs4.is.boolean(v)){
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

    p(B.b,n,{get:get,set:set,enumerable:true,});
  };

  p(B,'a',{enumerable:false,value:a,});

  function s(s){
    if (s==null){
      var s = '';
      for (var n in B.b){
        if (B.b[n]){
          if (s == '')s += n;
          else s += (' '+n);
        }
      }
      return s;
    }
    else if (zs4.is.string(s)){
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        if (b[a[i]]){
          B.b[a[i]]=true;
        }
      }
      return B.s();
    }
  };

  p(B,'s',{enumerable:false,value:s,});

  return B;
};

o.call(A);
A.t('b',b);
A.t('o',o);
