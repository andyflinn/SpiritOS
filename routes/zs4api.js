var zs4 = require('./zs4utils');
var zs4api = module.exports;

zs4.console.log('initializing module zs4api');
zs4api.api = [];

zs4api.register = function(name,module){
  var api = {
    name:name,
    module:require(module),
  };
  zs4api.api.push(api);
};

zs4api.register(zs4.const.API.NAME.INITIALIZE,'./api/zs4initialize');
zs4api.register(zs4.const.API.NAME.QUERY,'./api/zs4query');
zs4api.register(zs4.const.API.NAME.ADMIN,'./api/zs4admin');

zs4api.respond = function(req,res){
  //var request = zs4api.createRequest(req,res);
  zs4.console.log({log:'post',body:req.body});

  for (var i = 0 ; i < zs4api.api.length ; i++){
    if (zs4api.api[i].name == req.body.api){
      zs4.console.log('found api '+ zs4api.api[i].name + ' ...authorizing...');
      zs4.console.log(zs4api.api[i].auth);
      zs4.console.log(req.user);
      if (!zs4.authorized(zs4api.api[i].auth,req.user)){
        res.send(zs4.create.error('not authorized'));
        return;
    }
    return zs4api.api[i].module.respond(req,res);}
  }
  res.send(zs4.create.error('api not found.'));
}
