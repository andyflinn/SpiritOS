var zs4 = require('./static/zs4');

var stat;
if (zs4.is.node()) {
    stat = exports;
}
else {
    stat = new Object();
}

stat.updateUser = function(req){
  console.log('stat.updateUser() ',req.request.stat);
}

zs4.stat = stat;

stat.feed = function(req,item,data){
  if (!item._.flags.get.scope())return;

  var u = req.getUserPath();
  var p = item._.path;
  var cb = function(){};

  var nu = new Object({
    p:p,
    d:data,
    u:u,
  })
  //console.log(nu);

  var a = req.request.stat;
  for (var i = 0 ; i < a.length; i++){
    if (a[i].p==nu.p && a[i].u==nu.u){
      for (var n in nu){
        if (a[i].hasOwnProperty(n)){a[i][n]+=nu[n];}
        else a[i][n] = nu[n];
        return;
      }
    }
  }
  a.push(nu);
}


stat.createBasic = function(name){
  var BASIC = this;
  zs4.type.object.call(BASIC);
  //BASIC.zs4.head.typename._.value = 'stat'+name;
  //BASIC.zs4.head.typename._.default = 'stat'+name;
  BASIC._.name = name;

  BASIC._.property(new zs4.type.object({name:'total',flags:'noset authsetself'}));
  BASIC._.property(new zs4.type.date({name:'sincedate',flags:'noset authsetself'}));
  BASIC._.property(new zs4.type.object({name:'since',flags:'noset authsetself'}));
  BASIC._.property(new zs4.type.object({name:'root',flags:'noset authsetself'}));

  BASIC._.createStatEntry = (function(n){

    BASIC.total._.property(new zs4.type.number({
      name:n,
      flags:'authpublic noset',
    }));
    BASIC.since._.property(new zs4.type.integer({
      name:n,
      flags:'authpublic noset',
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

  PATH._.property(new zs4.type.string({name:'path',flags:'index noset unique'}));
}
stat.createUserStat = function(){
  var PATHUSER = this;
  stat.createBasic.call(PATHUSER,'user');
  PATHUSER._.create = stat.createUserStat;

  PATHUSER._.property(new zs4.type.string({name:'path',flags:'noset index'}));
  PATHUSER._.property(new zs4.type.string({name:'user',flags:'noset index'}));
}
