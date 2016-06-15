
exports.respond = function(req,res){

  var os = require('os');
  const v8 = require('v8');
  var zs4 = require('../zs4utils');
  var zs4db = require('../zs4mongoose');

  zs4.console.log({msg:'inside initialize api'})

  var reply = {
    server:{public:zs4db.system.public},
  }

  if (req.user==null){
    zs4.console.log('serving public api.');
    res.send(reply);
  }else{
    zs4db.model.User.findOne({ email:req.user }, function(err, user) {
      if (err || user==null){
        res.send(zs4.create.error('user '+req.user+' not found.'));
        return;
      }
      zs4.console.log('serving user api.');
      reply.user = user;
      if (req.user==zs4.env.ZS4_ADMIN_EMAIL){
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
      res.send(reply);
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
