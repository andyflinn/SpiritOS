'use strict';

var zs4 = require('./static/zs4');

var price = exports;

var STAT = new zs4.stat.create('stat');

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
  PRICE._.property(new zs4.type.object({name:'server',flags:'authsetself quickupdate',}));

  for (var n in STAT.item){
    var si = STAT.item[n];
    if (!zs4.is.type(si))continue;

    PRICE.server._.property(new zs4.type.object({name:n,flags:'authsetself quickupdate',}));
    var sp = PRICE.server[n];
    sp._.property(new zs4.type.boolean({name:'active',flags:'authsetself quickupdate',}));
    sp._.property(new zs4.type.um({name:'um',flags:'noset nostore authsetself',default:si.um._.value,}));
    sp._.property(new zs4.type.number({name:'coins',flags:'authsetself quickupdate',}));
  }

}
