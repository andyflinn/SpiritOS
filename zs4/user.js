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
  this._.name = 'user';
  USER._.create = user.create;
  USER.zs4._.property(new password.create());
  USER.zs4._.property(new email.create());
}
