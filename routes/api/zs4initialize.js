var zs4 = require('../zs4utils');
var zs4db = require('../zs4mongoose');

exports.respond = function(req){
  zs4.console.log({msg:'inside initialize api'})
  //req.replyJSON({msg:'this api is avalable'});

  var reply = {
    //system:zs4db.system,
  }

  req.replyJSON(reply);
/*
  zs4db.model.User.paginate({}, { offset: 0 }, function(err, users) {
    if (err)  return console.error.err;
    console.log(users);
    req.replyJSON(users);
  });
*/
}
