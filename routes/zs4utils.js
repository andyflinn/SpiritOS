var zs4 = module.exports;

var shared = require('../public/js/zs4-shared');
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

  if (req.user == null){
    zs4.console.log('getRequestUser(): req.user ==null');
    return null;
  }

  zs4.console.log('getRequestUser()');
  zs4.console.log(req.user);

  var nam = req.user;
  var i = nam.indexOf('@');
  if (i>0)nam = nam.substr(0,i);

  return {
    email:req.user,
    name:nam,
  };
}
