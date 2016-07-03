var zs4 = require('./www/zs4');
var mongoose = require('mongoose');

var token = exports;

token.password = require('./password');

token.schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength:zs4.const.EMAIL.MINLENGTH,
    maxlength:zs4.const.EMAIL.MAXLENGTH,
    index:true,
    set:zs4.string.to.lower,
  },
  hashed: {
    type: String,
    required: true,
    trim: true,
    maxlength:zs4.const.STRING.MAXLENGTH,
    index: { unique: true },
  },
  expires: {
    type: Number,
    required: true,
    trim: true,
  },
});

token.create = function(email){
  var THIS = new zs4.type.object({name:'this',required:true,});
  token.password.schema(THIS);
}

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

// the section below should be inserted to a sequential boot procedure....

token.boot = function(token,cb){
  token.conn = mongoose.createConnection(zs4.THIS.zs4.mongobase.getDataBaseUrl('token'));
  token.conn.on('error', console.error.bind(console, 'connection error:'));
  token.conn.once('open', function() {
    console.log ('Connected to: ' + zs4.THIS.zs4.mongobase.getDataBaseUrl('token'));
    token.model = token.conn.model('token',token.schema);
    cb();
  });
}

zs4.boot.call(token,token.boot,token);
