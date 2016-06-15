exports.respond = function(req,res){
  var zs4 = require('../zs4utils');
  var zs4db = require('../zs4mongoose');

  zs4.console.log({msg:'inside initialize api'})

  zs4db.model.User.paginate({}, { offset: 0 }, function(err, users) {
    if (err)  return console.error.err;
    console.log(users);
    req.replyJSON(users);
  });
}
