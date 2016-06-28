var zs4 = require('./zs4/node/module');

for (var i = 0 ; i < process.argv.length ; i++){
  console.log(process.argv[i]);
}

if (process. argv. length <= 2) {
  zs4.event(null,function(err,data){
    if (err){
      console.log('error: '+err);
      exit(-1);
    }

    console.log(JSON.stringify(data));
  });
}
