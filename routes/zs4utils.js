var zs4 = module.exports;

var shared = require('../public/script/zs4-shared');
shared.install(shared,zs4);

//zs4.dummy = 'asdf';
zs4.debug = false;

if ((process.env.ZS4_DEBUG.trim()) == 'true' ){
  console.log('ZS4_DEBUG == true');
  zs4.debug = true;
}

zs4.console = {
  log:function(arg){
    if (zs4.debug)
      console.log(arg);
  }
};

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
