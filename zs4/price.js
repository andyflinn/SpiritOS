'use strict';

var zs4 = require('./js/js');
var debug = require('debug')('zs4price');

var price = exports;

price.schema = function(parent){
  parent._.property(new price.create());
};

price.create = function(){

  zs4.type.scope.call(this);

  var PRICE = this;
  var STAT = this.zs4.head.stat;
  PRICE._.create = price.create;

  PRICE.zs4.head.typename._.value = 'price';
  PRICE.zs4.head.typename._.default = 'price';
  PRICE._.name = 'price';

  //PRICE._.createPriceType()

  PRICE._.property(new zs4.type.scopescope({name:'scope',inscope:'',flags:'authsetself quickupdate',}));
  PRICE._.property(new zs4.type.string({name:'item',flags:'authsetself quickupdate',}));
  PRICE._.property(new zs4.type.object({name:'server',flags:'authsetself quickupdate',}));

  for (var n in STAT.item){
    var si = STAT.item[n];
    if (!zs4.is.type(si))continue;

    PRICE.server._.property(new zs4.type.object({name:n,flags:'authsetself quickupdate',}));
    var sp = PRICE.server[n];
    sp._.property(new zs4.type.boolean({name:'active',flags:'authsetself quickupdate',}));
    sp._.property(new zs4.type.um({name:'um',flags:'noset nostore',default:si.um._.value,}));
    sp._.property(new zs4.type.number({name:'coins',flags:'authsetself quickupdate',}));
  }

}
