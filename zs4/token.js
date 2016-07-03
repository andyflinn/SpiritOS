var zs4 = require('./www/zs4');
var password = require('./password');

var token = exports;

token.password = require('./password');

token.schema = new zs4.type.object({name:'usertoken',required:true,});
zs4.type.property(token.schema,new zs4.type.email({name:'email',required:true,}));
password.schema(token.schema);

token.requesttoken = function(emailaddr,cb){
  //zs4.console.log(zs4.THIS);
  var msg = zs4.type.instance(zs4.THIS.zs4.email.message);
  zs4.console.log('inside token.requesttoken()');
  msg.from = zs4.THIS.zs4.admin.value.email;
  msg.to = emailaddr;
  msg.subject = 'token';
  msg.text = 'here';

  zs4.console.log(msg);

  zs4.THIS.zs4.email.send(msg,cb);
}
