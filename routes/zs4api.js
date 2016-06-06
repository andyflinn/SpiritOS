var zs4 = require('./zs4utils');
//var zs4db = require('./zs4mongoose');

var zs4api = module.exports;

zs4api.respond = function(req,res){
  console.log('zs4 post');
  console.log(req.body);
  var response = zs4.createResponseFrame(req);




  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(response));
}
