'use strict';

var zs4 = require('./js/js');
var meaning = require('./js/meaning');
var debug = require('debug')('zs4word');
var fs = require('fs');

var word = exports;

/*
word.meaning = new Object({
  schema:function(parent){
    parent._.property(new word.meaning.create());
  },
  create:function(context){

    zs4.type.scope.call(this);

    var MEANING = this;
    MEANING._.create = word.meaning.create;

    MEANING.zs4.head.typename._.value = 'meaning';
    MEANING.zs4.head.typename._.default = 'meaning';
    MEANING._.name = 'meaning';

    MEANING._.property(new zs4.type.name({name:'name',flags:'index unique authsetself',}));
    MEANING._.property(new zs4.type.names({name:'context',flags:'authsetself textsearch',}));
  }
});

word.lang = new Object({
  schema:function(parent){
    parent._.property(new word.lang.create());
  },
  create:function(){

    word.meaning.create.call(this);

    var LANG = this;
    LANG._.create = word.lang.create;

    LANG.zs4.head.typename._.value = 'lang';
    LANG.zs4.head.typename._.default = 'lang';
    LANG._.name = 'lang';
  }
});
*/

word.translation = new Object({
  schema:function(parent){
    parent._.property(new word.translation.create());
  },
  create:function(){
    zs4.type.scope.call(this);

    var TRANSLATION = this;
    TRANSLATION._.flags.set.nosort(true);
    TRANSLATION._.create = word.translation.create;

    TRANSLATION.zs4.head.typename._.value = 'translation';
    TRANSLATION.zs4.head.typename._.default = 'translation';
    TRANSLATION._.name = 'translation';

    TRANSLATION._.property(new zs4.type.name({name:'meaning',flags:'index authsetself textsearch',}));
    TRANSLATION._.property(new zs4.type.string({name:'context',flags:'index authsetself textsearch',}));
    TRANSLATION._.property(new zs4.type.lang({name:'lang',flags:'index authsetself textsearch',}));
    TRANSLATION._.property(new zs4.type.text({name:'translation',flags:'authsetself quickupdate',maxlength:zs4.const.STRING.MAXLENGTH,minlength:1}));
  },
});

var L = fs.readFileSync('./zs4/static/tables/lang.json','utf8');
L = zs4.json.parse(L);

for (var n in L){
  zs4.string.array.add.new(zs4.lang,n);
  var m = zs4.meaning.register(n);
  if (m==null){
    debug('register language \"'+n+'\" failed.');
    continue;
  }
  var a = zs4.string.split.separators(L[n].name,',');
  if (a.length>0)m.en = a[0];
  var b = zs4.string.split.separators(L[n].nativeName,',');
  if (b.length>0)m[n] = b[0];
}

zs4.THIS.zs4._.property(new zs4.type.object({name:'translate',flags:'api apiarg'}));
zs4.THIS.zs4.translate._.property(new zs4.type.name({name:'meaning',flags:'apiarg'}));
zs4.THIS.zs4.translate._.property(new zs4.type.string({name:'context',flags:'apiarg'}));
zs4.THIS.zs4.translate._.property(new zs4.type.lang({name:'lang',flags:'apiarg'}));
zs4.THIS.zs4.translate._.property(new zs4.type.text({name:'translation',flags:'apiarg',maxlength:zs4.const.STRING.MAXLENGTH,minlength:1}));

zs4.THIS.zs4.translate._.transform = (function(req,cb){
  var THIS = this;
  req.setScope(THIS);
  function error(err){
    req.error(THIS,err);
    debug(err);
    THIS._.getTree(req); cb();
  }

  if (zs4.is.string(req.input)){
    req.result(THIS,zs4.meaning.export(req.input));
    cb(); return;
  }

  if (!req.tokenExists()) return error('not logged in');
  if (!zs4.is.object(req.input))return error('no input object');
  if (!zs4.is.name(req.input.meaning))return error('invalid meaning');
  if (!zs4.is.string(req.input.translation)||(req.input.translation.length<1))return error('no translation');

  var ctx = req.input.context;

  var meaning = zs4.meaning.find(req.input.meaning,ctx);
  if (meaning==null)return error('meaning '+req.input.meaning+'ctx('+ctx+') not found.');

  console.log(req.input);


  req.result(THIS,true);
  THIS._.getTree(req);
  cb();
}).bind(zs4.THIS.zs4.translate);
