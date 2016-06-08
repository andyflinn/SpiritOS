var zs4 = require('./zs4utils');
var zs4db = require('./zs4mongoose');

var zs4api = module.exports;

zs4api.api = [];

zs4api.register = function(name,module){
  var api = {
    name:name,
    module:require(module),
  };
  zs4api.api.push(api);
};

zs4api.register('initialize','./api/zs4initialize');
zs4api.register('query','./api/zs4query');

zs4api.createRequest = function(req,res){
  var object = {
    req:req,
    res:res,
    replyJSON:function(reply){
        this.zs4.res = reply;
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(this.zs4.res));
    },
    zs4:{
      user:null,
      req:req.body,
      res:null,
    },
  };

  if (zs4.debug) object.zs4.debug = {};
  if (req.user){
    var nam = req.user.displayName;
    var i = nam.indexOf('@');
    if (i>0)nam = nam.substr(0,i);

    object.zs4.user = {name:nam,pic:req.user.picture, email:false, admin:false,};
    if (req.user.emails != null && req.user.emails.length > 0)
      object.zs4.user.email = true;
      if (zs4.debug){
        object.zs4.debug.user = req.user;
      }
      object.zs4.account = req.account;

      if ((process.env.ZS4_ADMIN_EMAIL.trim()) == req.user._json.email.trim() ){
        object.zs4.user.admin = true;
      }
  }

  return object;
}

zs4api.respond = function(req,res){
  var request = zs4api.createRequest(req,res);
  zs4.console.log({log:'post',body:req.body});

  for (var i = 0 ; i < zs4api.api.length ; i++){
    if (zs4api.api[i].name == request.zs4.req.api)
      return zs4api.api[i].module.respond(request);
  }

  request.replyJSON(zs4.create.error('api not available.'));
}
