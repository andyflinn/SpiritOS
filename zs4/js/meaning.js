'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('./js');
if (isWindow()) zs4 = window.zs4;

zs4.meaning = new Object({
  name:{

  },
  register:function(name,context){
    if (!zs4.is.name(name))return null;

    if (!zs4.is.object(zs4.meaning.name[name])){
      zs4.meaning.name[name]=new Object();
    }
    return zs4.meaning.name[name];
  },
  find:function(name){
    if (!zs4.is.object(zs4.meaning.name[name]))return null;
    return zs4.meaning.name[name];
  },
  export:function(lang){
    if (lang==null) console.log('EXPORTING ALL MEANINGS');
    else console.log('EXPORTING MEANINGS in '+lang);

    var ret = new Object();
    for (var n in zs4.meaning.name){
      var m = zs4.meaning.name[n];
      ret[n] = new Object();

      if (lang==null){
        for (var t in m){
          ret[n][t]=new String(m[t]);
        }
      }
      else if (m.hasOwnProperty(lang)){
        ret[n][lang] = new String(m[lang]);
      }
      else if (m.hasOwnProperty('en')){
        ret[n].en = new String(m.en);
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
    }
  },
  importJSON:function(json){
    js = zs4.json.parse(json);
    zs4.meaning.import(js);
  },
  translate:function(word,lang){
    if (word=='nomeaning')return '';
    var m = zs4.meaning.find(word);
    if (m==null)return word;
    if (m.hasOwnProperty(lang))return m[lang];
    else if (zs4.is.string(m.en)) return m.en;
    else return word;
  },
});

zs4.meaning.register('nomeaning');
zs4.meaning.register('meaning');
zs4.meaning.register('lang');
zs4.meaning.register('translation');
zs4.meaning.register('translator');
zs4.meaning.register('translated');
zs4.meaning.register('untranslated');
zs4.meaning.register('sortmeaning');
zs4.meaning.register('sorttranslation');
zs4.meaning.register('twoletteritems');
