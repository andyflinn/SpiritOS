var os = require('os');
const v8 = require('v8');
var zs4 = require('../zs4utils');
var zs4db = require('../zs4mongoose');

exports.respond = function(req){
  zs4.console.log({msg:'inside initialize api'})
  zs4.console.log(req.zs4);
  //req.replyJSON({msg:'this api is avalable'});

  var reply = {
    server:{public:zs4db.system.public},
  }

  if (req.zs4.user==null){
    zs4.console.log('serving public api.');
    req.replyJSON(reply);
  }else{
    zs4db.model.User.findOne({ email:req.zs4.user.email }, function(err, user) {
      if (err || user==null){
        return req.replyJSON(reply);
      }
      zs4.console.log('serving user api.');
      reply.user = user;
      if (req.zs4.user.admin){
        zs4.console.log('serving admin api.');
        reply.server = zs4db.system;
        reply.admin = {
          os:{
            arch:os.arch(),
            platform:os.platform(),
            release:os.release(),
            tmpdir:os.tmpdir(),
            totalmem:os.totalmem(),
            type:os.type(),
            uptime:os.uptime(),
            networkInterfaces:os.networkInterfaces(),
            freemem:os.freemem(),
            endianness:os.endianness(),
            cpus:os.cpus(),
            EOL:os.EOL,
          },
          v8:{
            stats:v8.getHeapStatistics(),
          },
        }
      }
      req.replyJSON(reply);
    });
  }



  //req.replyJSON(reply);
/*
  zs4db.model.User.paginate({}, { offset: 0 }, function(err, users) {
    if (err)  return console.error.err;
    console.log(users);
    req.replyJSON(users);
  });
*/
}
