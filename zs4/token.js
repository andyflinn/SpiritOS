var zs4 = require('./www/zs4');
var mongoose = require('mongoose');
var randomstring = require('randomstring');

const RANDOMLENGTH = 8;

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
  salt: {
    type: String,
    required: true,
    trim: true,
    maxlength:(RANDOMLENGTH+2),
    index: { unique: true },
  },
  expires: {
    type: Number,
    required: true,
  },
});

token.create = function(email){
  var THIS = new zs4.type.object({name:'this',required:true,});
  token.password.schema(THIS);

  var tokob = {
    email:email,
    hashed:'',
    salt:randomstring.generate(RANDOMLENGTH),
    expires:Date.now()+(15*zs4.const.MS.MINUTE),
  };
  tokob.hashed = THIS.password.generate(email+tokob.salt);
  zs4.console.log(tokob);

  return new token.model(tokob);
}
token.lastMopUp = 0;

token.validate = function(req,res,cb){
  function onError(){
    res.cookie('zs4' , '', {expire :0});
  };

  if (req.zs4==null)req.zs4 = new Object();

  if (req.query!=null&&req.query.token!=null&&req.query.token.length >10)req.zs4.token=req.query.token;
  else if (zs4.is.string(req.cookies.zs4)){req.zs4.token=req.cookies.zs4;}

  if (req.zs4.token==null){
    onError();
    cb(new zs4.error({text:'ERROR no return token'}));
  }
  token.model.findOne({ 'hashed': req.zs4.token },function(err,tokob){
    if (err){
      onError();
      cb(new zs4.error({text:'token not found',data:err}));
    }
    else if (tokob.expires < Date.now()){
      onError(); tokob.remove();
      cb(new zs4.error({text:'token expired',data:req.zs4.token}));
    }
    else{
      tokob.expires = Date.now()+zs4.THIS.zs4.admin.value.tokenexpiry;
      tokob.save(function(err){
        if (err){
          onError();
          cb(new zs4.error({text:'cannot save updated token'}));
        }
        else{
          res.cookie('zs4' , tokob.hashed, {expire :tokob.expires});
          req.zs4.email = tokob.email;
          zs4.console.log(req.zs4.email);
          cb(new zs4.done({text:'token updated.',data:tokob.email}));
        }
      });
    }
  });


};

token.requesttoken = function(emailaddr,cb){
  //zs4.console.log(zs4.THIS);
  var msg = zs4.type.instance(zs4.THIS.zs4.email.message);

  var tokob = token.create(emailaddr);

  zs4.console.log('inside token.requesttoken()');
  msg.from = zs4.THIS.zs4.admin.value.email;
  msg.to = emailaddr;
  msg.subject = 'zs4 token';
  msg.text = (zs4.THIS.zs4.www.getHostURL()+'/returntoken?token='+tokob.hashed);

  zs4.console.log(msg);
  tokob.save(function(err){
    if (err) cb(new zs4.error({text:'unable to save token.',data:err}));
    else zs4.THIS.zs4.email.send(msg,cb);
  });
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
