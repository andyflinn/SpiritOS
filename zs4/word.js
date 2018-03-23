'use strict';

var zs4 = require('./js/js');
var meaning = require('./js/meaning');
var debug = require('debug')('zs4word');
var fs = require('fs');

var word = exports;

var R = zs4.meaning.register;
R('login');
R('logout');

const LANG_JSON = './zs4/static/tables/lang.json';
const TRANSLATION_JSON = './zs4/word.json';

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
    TRANSLATION._.property(new zs4.type.lang({name:'lang',flags:'index authsetself textsearch',}));
    TRANSLATION._.property(new zs4.type.text({name:'translation',flags:'index authsetself textsearch',maxlength:zs4.const.STRING.MAXLENGTH,minlength:1}));
  },
});

zs4.meaning.import(JSON.parse(fs.readFileSync(TRANSLATION_JSON,'utf8')));
debug(zs4.meaning.export());

zs4.THIS.zs4._.property(new zs4.type.object({name:'language',flags:'api authgetpublic'}));

zs4.THIS.zs4.language._.property(new zs4.type.object({name:'translate',flags:'api apiarg'}));
zs4.THIS.zs4.language.translate._.property(new zs4.type.name({name:'meaning',flags:'apiarg'}));
zs4.THIS.zs4.language.translate._.property(new zs4.type.string({name:'context',flags:'apiarg'}));
zs4.THIS.zs4.language.translate._.property(new zs4.type.lang({name:'lang',flags:'apiarg'}));
zs4.THIS.zs4.language.translate._.property(new zs4.type.text({name:'translation',flags:'apiarg',maxlength:zs4.const.STRING.MAXLENGTH,minlength:1}));

zs4.THIS.zs4.language.translate._.transform = (function(req,cb){
  var THIS = this;
  req.setScope(THIS);
  function error(err){
    req.error(THIS,err);
    debug(err);
    THIS._.getTree(req); cb();
  }

  console.log(req.input);

  if (zs4.is.string(req.input)){
    if (!req.tokenExists()){
      req.result(THIS,zs4.meaning.export(req.input));
      cb(); return;
    }
    else {
      var result;
      if (req.input=='') result = zs4.meaning.export();
      else result = zs4.meaning.export(req.input);
      req.call({
        path:'zs4.type.translation.method.query',
        input:{
          search:'',
          select:{
            sc:'all',
            owner:{
              sc:'item',
              item:'zs4.head.owner',
              opcode:'eq',
              type:'const',
              const:req.getUserPath(),
              prop:'',
            },
          },
          sort:{
            item:'zs4.head.owner',
            descend:false,
          }
        },
        wantreply:true,
      },function(res){
        var arr = zs4.path.resolve(req,'request.get.zs4.type.translation.array');
        if (arr != null){
          for (var n in arr){
            if (!zs4.is.type(arr[n]))continue;
            var o = arr[n];
            var m = zs4.meaning.find(o.meaning._.value);
            if (m != null){
              result[o.meaning._.value][o.lang._.value] = new String(o.translation._.value);
            }
          }
        }
        //console.log(result);
        req.result(THIS,result);
        cb(); return;
      },true);

      return;
    }
  }

  if (!req.tokenExists()) return error('not logged in');
  if (!zs4.is.object(req.input))return error('no input object');
  if (!zs4.is.name(req.input.meaning))return error('invalid meaning');
  if (!zs4.is.name(req.input.lang)||(req.input.lang.length!=2))return error('invalid language \"'+req.input.lang+'\"');
  if (!zs4.is.string(req.input.translation)||(req.input.translation.length<1))return error('no translation');

  var ctx = req.input.context;

  var meaning = zs4.meaning.find(req.input.meaning,ctx);
  if (meaning==null)return error('meaning '+req.input.meaning+' not found.');

  debug('translate input:',req.input);

  var query = new Object({
    search:'',
    select:{
      sc:'all',
      owner:{
        sc:'item',
        item:'zs4.head.owner',
        opcode:'eq',
        type:'const',
        const:req.getUserPath(),
        prop:'',
      },
      meaning:{
        sc:'item',
        item:'meaning',
        opcode:'eq',
        type:'const',
        const:req.input.meaning,
        prop:'',
      },
      lang:{
        sc:'item',
        item:'lang',
        opcode:'eq',
        type:'const',
        const:req.input.lang,
        prop:'',
      },
    },
    sort:{
      item:'meaning',
      descend:false,
    }
  });

  debug('translate query:',query);

  req.call({
    path:'zs4.type.translation.method.query',
    input:query,
    wantreply:true,
  },
  function(res){
    var arr = zs4.path.resolve(req,'request.get.zs4.type.translation.array');
    debug('query result:',arr);
    if (!zs4.is.object(arr)||(zs4.count.type.members(arr)!=1)){
      req.call({
        path:'zs4.type.translation.method.new',
        input:{
          meaning:req.input.meaning,
          lang:req.input.lang,
          translation:req.input.translation,
          zs4:{
            head:{
              title:req.input.meaning + ' ('+req.input.lang+')',
              owner:req.getUserPath(),
              bits:zs4.THIS.zs4.head.bits._.bits.public.m,
            }
          },
        },
        wantreply:true,
      },
      function(res){
        console.log('new() returned',res);

        req.result(THIS,true);
        THIS._.getTree(req);
        cb();
      },true);
    }
    else {
      var obj = null;
      for (var n in arr){if (zs4.is.type(arr[n])){obj=arr[n];break;}}
      req.call({
        path:'zs4.type.translation.array.'+obj._.name,
        input:{
          translation:req.input.translation,
        },
        wantreply:true,
      },
      function(res){
        debug('update result: ',res);
        req.result(THIS,true);
        THIS._.getTree(req);
        cb();
      },true);
    }
  },true);

}).bind(zs4.THIS.zs4.language.translate);

word.boot = function(input,cb){
  zs4.debug('zs4.stat.boot() is active');

  var q = new Object({zs4:{type:{translation:{method:{
    query:{
      search:'',
      sort:{
        item:'zs4.head.updated',
        descend:true,
      },
      select:{
        sc:'all',
      }
    }
  }}}}});

  var req = new zs4.request({input:q});
  req.request.node = true;

  zs4.THIS._.transform(req,function(ret){
    var array = req.request.get.zs4.type.translation.array;
    if (zs4.is.object(array)){
      var a = new Array();
      for (var n in array){
        var item = array[n];
        if (!zs4.is.type(item))continue;
        a.push(array[n]);
      }
    }
    //console.log('booting translations',a);
    a.sort(function(a,b){
      var ret = a.meaning._.value.localeCompare(b.meaning._.value);
      if (ret != 0)return ret;
      return a.lang._.value.localeCompare(b.lang._.value);
    });

    var arr = new Array();
    var lang; var meaning;

    function loadTranslation(){
      var m = zs4.meaning.find(meaning);
      if (m==null)return;
      debug('loading '+lang+' string for '+meaning+' --> '+arr[0].translation._.value);
      m[lang]= arr[0].translation._.value;
    };

    for (var i = 0; i < a.length; i++){
      if ((a[i].meaning._.value != meaning) || (a[i].lang._.value != lang)){
        debug('encountered '+a[i].lang._.value+' string for '+a[i].meaning._.value);
        if (arr.length > 0) loadTranslation();

        meaning = a[i].meaning._.value;
        lang = a[i].lang._.value;
        arr = new Array();
        arr.push(a[i]);
      }
      else {
        arr.push(a[i]);
      }
    }
    if (arr.length > 0) loadTranslation();

    if (zs4.THIS.zs4.js.debug._.value==true){
      fs.writeFileSync(TRANSLATION_JSON, zs4.json.textify(zs4.meaning.export()),'utf8');
    }

    cb();
  });
}

zs4.boot.call(zs4.THIS,word.boot,zs4.THIS);
