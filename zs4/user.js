var zs4 = require('./static/zs4');
var email = require('./email');
var password = require('./password');
var rsa = require('./rsa');
var token = require('./token');

const RANDOMLENGTH = 32;
const TIMETOLIVE = (zs4.const.MS.WEEK*2);

var user;
if (zs4.is.node()) {
    user = exports;
}
else {
    user = new Object();
}

user.array = function(input){
  var USER = new zs4.type.array(input);
  password.schema(USER.template.zs4);
  email.schema(USER.template.zs4);
  //zs4.console.log(JSON.stringify(USER));
  return USER;
};
