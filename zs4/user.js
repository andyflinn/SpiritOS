var zs4 = require('./static/zs4');
var email = require('./email');
var password = require('./password');
var rsa = require('./rsa');
var token = require('./token');

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

    USER.zs4.update._.transform = (function(req,cb){
      var REQUEST = req;
      REQUEST.setScope(USER);
      this._.transformInternal(REQUEST);

      console.log('user.zs4.update()');
      console.log(REQUEST.input);

      USER.account.balance._.value -= 1;

      REQUEST.result(USER.zs4.update,true);

      REQUEST.setScope(USER.account.balance);
      USER.account.balance._.get(REQUEST);

      REQUEST.setScope(USER);
      USER._.getTree(REQUEST);

      cb(); return;
    }).bind(USER);
  }
}
