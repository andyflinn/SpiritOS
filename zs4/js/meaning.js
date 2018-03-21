'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('./js');
if (isWindow()) zs4 = window.zs4;

zs4.meaning = new Object({
  context:function(arr){
    var CTX = this;
    CTX._arr = arr;
    CTX._equals = function(a){
      if (CTX._arr.length != a.length)return false;
      for (var i = 0; i < a.length;i++){
        if (CTX._arr[i]!=a[i])return false;
      }
      return true;
    };
  },
  parseContext:function(str){
    if (!zs4.is.string(str))return null;
    var a = zs4.string.split.separators(str,' ,/:;-');
    if (a.length==0)return null;
    var ret = new Array();
    for (var i = a.length-1; i>=0;i--){
      if (!zs4.is.name(a[i]))continue;
      zs4.string.array.add.new(ret,a[i]);
    }
    if (ret.length==0)return null;
    ret.sort(function(a,b){return a.localeCompare(b);});
    return ret;
  },
  name:{

  },
  register:function(name,context){
    if (!zs4.is.name(name))return null;

    if (!zs4.is.object(zs4.meaning.name[name])){
      zs4.meaning.name[name]=new Object();
    }
    var meaning = zs4.meaning.name[name];
    if (!zs4.is.array(meaning._ctx))meaning._ctx = new Array();

    if (!zs4.is.string(context))return meaning;

    var b = zs4.meaning.parseContext(context);
    if (b == null)return meaning;

    //var found = false;
    for (var i = 0; i < meaning._ctx.length; i++){
      if (meaning._ctx[i]._equals(b))return meaning._ctx[i];
    }

    var nu = new zs4.meaning.context(b);
    meaning._ctx.push(nu);
    return nu;
  },
  find:function(name,context){
    if (!zs4.is.object(zs4.meaning.name[name]))return null;
    var meaning = zs4.meaning.name[name];
    var a = zs4.meaning.parseContext(context);
    if (a==null)return meaning;
    for (var i = 0; i < meaning._ctx.length; i++){
      if (meaning._ctx[i]._equals(a))return meaning._ctx[i];
    }
    return meaning;
  },
  export:function(lang){
    console.log('EXPORTING MEANINGS in '+lang);
    var ret = new Object();
    for (var n in zs4.meaning.name){
      var m = zs4.meaning.name[n];
      ret[n] = new Object();
      if (m.hasOwnProperty(lang)){
        ret[n][lang] = new String(m[lang]);
      }
      else if (m.hasOwnProperty('en')){
        ret[n].en = new String(m.en);
      }
      if (!zs4.is.array(ret[n]._ctx))ret[n]._ctx = new Array();
      var arr = ret[n]._ctx;
      for (var i = 0 ; i < m._ctx.length; i++){
        var ctx = m._ctx[i];
        var nu = new zs4.meaning.context(ctx._arr);
        arr.push(nu);
        if (ctx.hasOwnProperty(lang)){
          nu[lang] = new String(ctx[lang]);
        }
        else if (ctx.hasOwnProperty('en')){
          nu.en = new String(ctx.en);
        }
      }
    }
    return ret;
  },
  exportJSON:function(lang){
    var js = zs4.meaning.export(lang);
    return JSON.stringify(js);
  },
  import:function(o){
    for (var n in o){
      var m = zs4.meaning.register(n);
      if (m==null)continue;
      for (var lang in o[n]){
        if (!zs4.is.name(lang))continue;
        m[lang] = o[n][lang];
      }
      for (var i = 0; i < o[n]._ctx.length; i++){
        var ctx = o[n]._ctx[i];
        var nu = new zs4.meaning.context(ctx._arr);
        m._ctx.push(nu);
        for (var lang in ctx){
          if (!zs4.is.name(lang))continue;
          nu[lang] = ctx[lang];
        }

      }
    }
  },
  importJSON:function(json){
    js = zs4.json.parse(json);
    zs4.meaning.import(js);
  }
});

zs4.meaning.register('meaning');
zs4.meaning.register('lang');
zs4.meaning.register('translation');
