var zs4 = require('../../static/zs4');
var xpress = require('express');

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
  console.log(this.zs4.head.typename._.value);
  this.zs4.head.bits._.bits.plugin.true();
  this._.name = 'toonsmith';
  TOONSMITH._.create = toonsmith.create;
  if (zs4.is.node()){
    TOONSMITH._.property(new zs4.type.text({name:'data',flags:'authgetpublic quickupdate',}));
  }
}

zs4.THIS.zs4.type._.property(new zs4.type.array({name:'toonsmith',template:new toonsmith.create(),}));
zs4.THIS.zs4.type.toonsmith._.flags.value |= zs4.THIS.zs4.type.toonsmith._.flags.apiarg;
