var zs4 = require('./static/zs4');
var randomstring = require('randomstring');
var jwt = require('jwt-simple');

const RANDOMLENGTH = 32;
const TIMETOLIVE = (zs4.const.MS.WEEK*2);

var token = exports;

token.schema = function(parent){
  var THIS = new zs4.type.object({name:'token',flags:'api',});
  parent._.property(THIS);
  THIS._.property(new zs4.type.string({name:'secret',flags:'required',default:randomstring.generate(RANDOMLENGTH),}));

  THIS.encode = (function(nuload){
    var payload = new Object({
      iat:Date.now(),
      exp:(Date.now()+TIMETOLIVE),
    });

    if (zs4.is.string(nuload.iss))payload.iss = nuload.iss;
    if (zs4.is.string(nuload.scope))payload.scope = nuload.scope;

    THIS._.print('token payload: '+JSON.stringify(payload));

    var ret = jwt.encode(payload, this._.value.secret);
    //console.log(ret);
    return ret;
  }).bind(THIS);

  THIS.decode = (function(token){

    var dec;
    try {
      dec = jwt.decode(token, this._.value.secret);
    }
    catch(err) {
      return null;
    }

    if (!zs4.is.object(dec))return null;

    if (!zs4.is.object(dec)
    ||  !zs4.is.string(dec.iss)
    ||  !zs4.is.string(dec.scope)
    )return null;

    return dec;
  }).bind(THIS);


}
