var zs4 = module.exports;

var shared = require('../public/script/zs4-shared');
shared.install(shared,zs4);

//zs4.dummy = 'asdf';
zs4.debug = false;

if ((process.env.ZS4_DEBUG.trim()) == 'true' ){
  console.log('ZS4_DEBUG == true');
  zs4.debug = true;
}

zs4.createResponseFrame = function(req){
  var response = {zs4:{user:null,req:req.body,res:null,}};
  if (zs4.debug) response.zs4.debug = {};
  if (req.user){
    response.zs4.user = {name:req.user.displayName,pic:req.user.picture, email:false, admin:false,};
    if (req.user.emails != null && req.user.emails.length > 0)
      response.zs4.user.email = true;
      if (zs4.debug){
        response.zs4.debug.user = req.user;
      }
      response.zs4.account = req.account;

      if ((process.env.ZS4_ADMIN_EMAIL.trim()) == req.user._json.email.trim() ){
        response.zs4.user.admin = true;
      }

  }

  return response;
}

zs4.getRequestUser = function(req,res){

  if (req.user == null) return null;
  if (req.user._json == null) return null;
  if (req.user._json.email == null) return null;
  //if (req.user.id == null) return null;
  //if (req.user._json.email == null) return null;
  return {
    email:req.user._json.email,
    name:req.user.displayName,
    pic:req.user.picture,
    identity:req.user.id,
    provider:req.user.provider,
  };
}
