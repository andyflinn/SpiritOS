var zs4 = require('./static/zs4');
var email = require('./email');

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
  email.schema(USER.this);

  return USER;
};
