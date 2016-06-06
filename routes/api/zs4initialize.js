var zs4 = require('../zs4utils');
var zs4db = require('../zs4mongoose');

var initialize = module.exports;

initialize.respond = function(req){
  zs4.console.log({msg:'inside initialize api'})
  req.replyJSON({msg:'this api is avalable'});
}
