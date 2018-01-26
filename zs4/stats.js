var zs4 = require('./static/zs4');

var stat;
if (zs4.is.node()) {
    stat = exports;
}
else {
    stat = new Object();
}

stat.feed = function(req,item,data){
  if (item._.flags.get.nostat())return;
  if (zs4.string.startsWith(item._.path,'zs4.type.stat'))return;
  var user = req.getUserPath();

  var cb = function(){};



}


stat.createBasic = function(name){
  var BASIC = this;
  zs4.type.scope.call(BASIC);
  BASIC.zs4.head.typename._.value = 'stat'+name;
  BASIC.zs4.head.typename._.default = 'stat'+name;
  BASIC._.name = 'stat'+name;

  BASIC._.property(new zs4.type.object({name:'total',flags:'nostat noset authsetself'}));
  BASIC._.property(new zs4.type.date({name:'sincedate',flags:'nostat noset authsetself'}));
  BASIC._.property(new zs4.type.object({name:'since',flags:'nostat noset authsetself'}));
  BASIC._.property(new zs4.type.object({name:'root',flags:'nostat noset authsetself'}));

  BASIC._.createStatEntry = (function(n){

    BASIC.total._.property(new zs4.type.number({
      name:n,
      flags:'nostat authpublic noset',
    }));
    BASIC.since._.property(new zs4.type.integer({
      name:n,
      flags:'nostat authpublic noset',
    }));
  }).bind(BASIC)

  BASIC._.createStatEntry('transformcount');
  BASIC._.createStatEntry('getcount');
  BASIC._.createStatEntry('requestbytes');
  BASIC._.createStatEntry('responsebytes');
};

stat.createPathStat = function(){
  var PATH = this;
  stat.createBasic.call(PATH,'path');
  PATH._.create = stat.createPathStat;

  PATH._.property(new zs4.type.string({name:'path',flags:'nostat index noset unique'}));
}
stat.createUserStat = function(){
  var PATHUSER = this;
  stat.createBasic.call(PATHUSER,'user');
  PATHUSER._.create = stat.createUserStat;

  PATHUSER._.property(new zs4.type.string({name:'path',flags:'nostat noset index'}));
  PATHUSER._.property(new zs4.type.string({name:'user',flags:'nostat noset index'}));
}
