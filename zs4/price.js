'use strict';

var zs4 = require('./static/zs4');

var price = exports;

price.schema = function(parent){
  parent._.property(new price.create());
};

price.create = function(){
  var PRICE = this;

  zs4.type.scope.call(this);
  PRICE._.create = price.create;
  //PRICE._.flags.set.scopestats(true);
  PRICE.zs4.head.typename._.value = 'price';
  PRICE.zs4.head.typename._.default = 'price';
  PRICE._.name = 'price';

  //PRICE._.createPriceType()

  PRICE._.property(new zs4.type.scopescope({name:'scope',inscope:'',flags:'authsetself quickupdate',}));
  PRICE._.property(new zs4.type.string({name:'item',flags:'authsetself quickupdate',}));
}
