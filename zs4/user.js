var zs4 = require('./js/js');
var email = require('./email');
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
  this.zs4.head.typename._.value = 'user';
  this.zs4.head.typename._.default = 'user';
  zs4.meaning.register('user');

  this._.name = 'user';
  USER._.create = user.create;
  if (zs4.is.node()){
    USER.zs4._.property(new zs4.type.email({name:'email',flags:'index unique authsetself quickupdate'}));
    USER.zs4.email._.value = zs4.integer.to.name(Date.now())+'@zs4.zs4';

    USER._.property(new zs4.type.object({name:'info',flags:'authsetself quickupdate'}));
    USER.info._.property(new zs4.type.date({name:'birth',flags:'authsetself quickupdate'}));

    USER._.property(new zs4.type.object({name:'account',flags:'noset'}));
    USER.account._.property(new zs4.type.integer({name:'balance',flags:'quickupdate'}));
  }
}
