var zs4 = require('../../static/zs4');
var xpress = require('express');
var ts = require('./static/toonsmith/window');

console.log('toonsmith loading...');

var toonsmith;
if (zs4.is.node()) {
    toonsmith = exports;
}
else {
    toonsmith = new Object();
}

zs4.plugin.registerStatic('./plugin/toonsmith/static/');
zs4.plugin.registerScript('tables/midi.js');
zs4.plugin.registerStyle('toonsmith/style.css');
zs4.plugin.registerScript('toonsmith/window.js');
zs4.plugin.registerScript('toonsmith/script.js');

toonsmith.create = function(){
  var TOONSMITH = this;
  zs4.type.scope.call(this);
  this.zs4.head.typename._.value = 'toonsmith';
  this.zs4.head.typename._.default = 'toonsmith';
  //console.log(this.zs4.head.typename._.value);
  this.zs4.head.bits._.bits.plugin.true();
  this._.name = 'toonsmith';
  //this._.flags.set.authuser();
  TOONSMITH._.create = toonsmith.create;
  TOONSMITH._.property(new zs4.type.text({name:'data',flags:'authgetpublic quickupdate authsetself',}));
  TOONSMITH._.getTextOnly = (function(){
    var ret = '';
    var skip = false;
    for (var i = 0 ; i < TOONSMITH.data._.value.length ; i++){
      var cur_ch = TOONSMITH.data._.value.charAt(i);
      if (skip==true){if (cur_ch == ']'){skip=false;}continue;}
      else if (cur_ch == '['){skip=true;continue;}
      else {ret += cur_ch;}
     }
     return ret;
  }).bind(TOONSMITH);

  TOONSMITH._.getKeyWordArray = (function(){
    var ret = new Array();
    ret.push(new String('zs4'));
    ret.push(new String('toonsmith'));

    var textOnly = TOONSMITH._.getTextOnly();
    //console.log(textOnly);
    var arr = zs4.string.split.separators(textOnly,zs4.const.SPECIALCHARS);

    for (var i = 0; i < arr.length; i++){
      zs4.string.array.add.new(ret,zs4.string.to.lower(arr[i]));
    }

    return ret;
  }).bind(TOONSMITH);

  TOONSMITH._.oldGetAmpBody = TOONSMITH._.getAmpBody;
  TOONSMITH._.getAmpBody= (function(req,cb){
    var html = '';

    var plain = TOONSMITH._.getTextOnly();
    this._.getAmpPlainTextDecorated(req,TOONSMITH._.getTextOnly(),function(decorated){
      html += decorated;

      return cb(html);
    })
  }).bind(TOONSMITH);
}

zs4.THIS.zs4.type._.property(new zs4.type.array({name:'toonsmith',template:new toonsmith.create(),}));
zs4.THIS.zs4.type.toonsmith._.flags.value |= zs4.THIS.zs4.type.toonsmith._.flags.apiarg;
zs4.THIS.zs4.type.toonsmith.method.new._.flags.set.authuser();
