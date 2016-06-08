var zs4 = require('../zs4utils');
var zs4db = require('../zs4mongoose');

exports.respond = function(req){
  zs4.console.log({msg:'inside initialize api'})
  zs4.console.log(req.zs4);
  //req.replyJSON({msg:'this api is avalable'});

  var reply = {
    server:{public:zs4db.system.public},
  }

  if (req.zs4.user != null){
    reply.user = req.zs4.user;
    if (reply.user.admin){
        zs4.console.log('serving admin api.');
        reply.server = zs4db.system;
        reply.admin = {
        }
    }

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
