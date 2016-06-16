var fs = require('fs');

exports.respond = function(req,res){
  var zs4 = require('../zs4utils');

  zs4.console.log({msg:'inside fs api'})

  fs.readdir('.', function(err, list){
    if (err){
      res.send(zs4.create.error('fs failure:',err));
      return;
    }
    else if (zs4.is.array(list)){
      var ret = 
      zs4.console.log(list);
      res.send({list:list});
      return;
    }
    else{
      res.sent(zs4.create.error('no data.'));
    }

  });
}
