var zs4 = require('./static/zs4');
var email = require('./email');
var password = require('./password');
var rsa = require('./rsa');
var token = require('./token');
var debug = require('debug')('zs4user');

var user;
if (zs4.is.node()) {
    user = exports;
}
else {
    user = new Object();
}

user.create = function(){
  var USER = this;
  zs4.type.scope.call(this);
  //USER._.flags.set.scopestats(true);
  this.zs4.head.typename._.value = 'user';
  this.zs4.head.typename._.default = 'user';
  this._.name = 'user';
  USER._.create = user.create;
  if (zs4.is.node()){
    USER.zs4._.property(new password.create());
    USER.zs4._.property(new zs4.type.email({name:'email',flags:'index unique authsetself quickupdate'}));
    USER.zs4.email._.value = zs4.integer.to.name(Date.now())+'@zs4.zs4';

    USER._.property(new zs4.type.object({name:'info',flags:'authsetself quickupdate'}));
    USER.info._.property(new zs4.type.date({name:'birth',flags:'authsetself quickupdate'}));

    USER._.property(new zs4.type.object({name:'account',flags:'noset'}));
    USER.account._.property(new zs4.type.integer({name:'balance',flags:'quickupdate'}));

    USER._.property(new zs4.type.object({name:'social',flags:'authsetself quickupdate'}));
    if (zs4.is.type(zs4.THIS.zs4.passport)){
      var PASSPORT = zs4.THIS.zs4.passport
      for (var n in PASSPORT)if (zs4.is.type(PASSPORT[n])){
        var SOCIAL = PASSPORT[n];
        var network = SOCIAL._.name;
        //debug('instantiating '+SOCIAL._.name+' for USER');
        USER.social._.property(new zs4.type.object({name:network,flags:''}));
        USER.social[network]._.property(new zs4.type.date({name:'date',flags:''}));
        USER.social[network]._.property(new zs4.type.string({name:'display',flags:''}));
        USER.social[network]._.property(new zs4.type.string({name:'id',flags:''}));
        USER.social[network]._.property(new zs4.type.string({name:'email',flags:''}));
      }
    }

    USER.zs4.update._.transform = (function(req,cb){
      var REQUEST = req;
      REQUEST.setScope(USER);
      this._.transformInternal(REQUEST);

      var arr;
      if (zs4.is.object(REQUEST.input)){
        for (var n in REQUEST.input) {
          if (zs4.is.array(REQUEST.input[n])&&n=='array'){
            arr = REQUEST.input[n];
            //debug('ARRAY input.'+n);
          }
        }
      }

      if (zs4.is.array(arr)){
        var stat = USER.zs4.head.stat; //new zs4.stat.create('stat');
        var statitem = new Array();
        for (var n in stat.item){ statitem.push(new String(n));}

        for (var i = 0; i < arr.length; i++){
          var item = arr[i];
          if (item.u != USER._.path)continue;
          if (item.p.substr(0,USER._.path.length)==USER._.path)continue;

          var priced = false;
          var ori = zs4.THIS._.resolvePath(item.p);
          if (zs4.is.type(ori)){
            if (ori._.price.length>0){
              //debug('USER update found PRICED iteM');
              priced = true;

            }
          }

          //debug(item.d,item.p);

          for (var n in item.d){
            var msg = n+':';

            if (!zs4.string.array.is.element(statitem,n)){
              msg += ' nostat';
            }
            else if (!zs4.is.number(item.d[n])){
              msg += ' v-no-number='+item.d[n];
            }
            else {
              msg+= ' found';
              //debug(arr[i].d,arr[i].p,arr[i].u);
              stat.item[n]._.stat.accumulate(item.d[n],0);
              if (priced){
                //debug('PRICE '+n+' search in '+ item.p);
                var price = ori._.price[0];
                var prop = price.server[n];
                if (prop.active._.value==true){
                  debug('BILLING USER '+USER._.path+' for '+n+' at '+ item.p
                  + '    qty:'+item.d[n]
                  + ' * coins:'+prop.coins._.value
                  + ' = '+prop.coins._.value
                  );
                  USER.account.balance._.value -= (item.d[n] *prop.coins._.value) ;
                }
                else {
                  //debug('PRICE '+n+' not found in '+ item.p
                  //+ ' active:'+prop.active._.value
                  //+ ' coins:'+prop.coins._.value
                  //);
                }
              }
            }

            //debug(msg);
          }

        }


      }

      // return a successfull result
      REQUEST.result(USER.zs4.update,true);

      REQUEST.setScope(USER.account.balance);
      USER.account.balance._.get(REQUEST);

      REQUEST.setScope(USER);
      USER._.getTree(REQUEST);

      cb(); return;
    }).bind(USER);
  }
}
