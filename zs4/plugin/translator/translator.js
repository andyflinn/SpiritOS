var zs4 = require('../../js/js');
//var xpress = require('express');
//var ts = require('../../static/translator/window');
var debug = require('debug')('zs4translator');
var fs = require('fs');

const APPNAME = 'translator';
debug('translator loading...');

zs4.meaning.register(APPNAME);

var ts;
var translator;
if (zs4.is.node()) {
    translator = exports;
    translator.window = fs.readFileSync('./zs4/plugin/translator/window.js','utf8');
}
else {
    translator = new Object();
}

translator.create = function(){
  var TRANSLATOR = this;
  zs4.type.scope.call(this);
  this.zs4.head.typename._.value = 'translator';
  this.zs4.head.typename._.default = 'translator';
  this.zs4.head.bits._.bits.plugin.true();
  this._.name = 'translator';

  var dbg = true;
  if (zs4.THIS.zs4.node.is.heroku._.value == true)dbg = false;

  TRANSLATOR._.create = translator.create;
  TRANSLATOR._.property(new zs4.type.text({name:'data',flags:'authgetpublic quickupdate authsetself',}));
  TRANSLATOR._.getScript = (function(req,cb){
    var js;
    js += '\n';

    if (dbg){
      js += fs.readFileSync('./zs4/plugin/translator/window.js','utf8');
    }
    else{
      js += translator.window;
    }
    js += '\n';
    debug('returning script');
    cb(js);
  }).bind(TRANSLATOR);
  TRANSLATOR._.getKeyWordArray = (function(){
    var ret = new Array();

    return ret;
  }).bind(TRANSLATOR);

  TRANSLATOR._.getAmpBody= (function(req,cb){
    var html = '';
    var section = new Array();

    function spaceImage(){
      return '<svg width=\"0.25em\" height=\"1em\"></svg>';
    };

    return cb(html);
  }).bind(TRANSLATOR);
}

// install application
var app = new translator.create();
zs4.THIS.zs4.app._.property(app);
app.zs4.head.title._.value = APPNAME;
app.zs4.head.author._.value = 'Andy Flinn';
app.zs4.head.description._.value = 'a tool to translate zs4 applications';
app.zs4.head.bits._.bits.public.true();
app._.flags.set.authgetpublic(true);
