var zs4 = require('./static/zs4');
var randomstring = require('randomstring');
var jwt = require('jwt-simple');

const RANDOMLENGTH = 32;
const TIMETOLIVE = (zs4.const.MS.WEEK*2);

var token;
if (zs4.is.node()) {
    token = exports;
}
else {
    token = new Object();
}

token.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'token',required:true,api:true,}));
  zs4.type.property(parent.token,new zs4.type.string({name:'secret',required:true,default:randomstring.generate(RANDOMLENGTH),}));

  parent.token.encode = (function(claims){
    var payload = new Object({
      iss:zs4.THIS.zs4.express._.value.host,
      iat:Date.now(),
      exp:(Date.now()+TIMETOLIVE),
    });

    if (zs4.is.object(claims)){
      if (zs4.is.boolean(claims.rpw)&&claims.rpw){payload.rpw=claims.rpw;}
      if (zs4.is.email(claims.email)){payload.email=claims.email;}
    }
    //zs4.console.log(zs4.const.MS.WEEK*2);
    //zs4.console.log(payload);
    return jwt.encode(payload, this._.value.secret);
  }).bind(parent.token);

  parent.token.decode = (function(token){

    var dec;
    try {
      dec = jwt.decode(token, this._.value.secret);
    }
    catch(err) {
      return null;
    }

    if (!zs4.is.object(dec))return null;

    return dec;
  }).bind(parent.token);


}
