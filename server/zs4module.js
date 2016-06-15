var zs4 = module.exports;

console.log('initializing module zs4module');

// load objects common to client and server
var shared = require('../public/js/zs4-shared');
shared.install(shared,zs4);

zs4.admin = {
  config:{
    mongoose:{

    },
    session:{

    },
    smpt:{

    },
    ssl:{

    },

  },
};

var fs = require('fs');
zs4.fs = {
  readJsonFile:function(f){
    var r = null;
    try {
      r = JSON.parse(fs.readFileSync(f).toString());
    }
    catch (err){
      r = null;
    }
    return r;
  },
};
