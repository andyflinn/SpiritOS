var zs4 = require('./zs4/www/zs4');
var node = require('./zs4/node');

var msg = new Object();
var path = msg;

new Object({path:{}});

for (var i = 2 ; i < process.argv.length ; i++){
    if (zs4.is.name(process.argv[i])){
      path[process.argv[i]] = new Object();
      path = path[process.argv[i]];
    }else{
      var arr = zs4.string.split.separators(process.argv[i],':/\\=');
      if (arr.length == 2 && zs4.is.name(arr[0])) path[arr[0]]=arr[1];
    }
}
console.log(msg);

node.configure(msg,function(err,data){
  if (err){
    console.log('error: '+err);
    exit(-1);
  }

  console.log(JSON.stringify(data));
});
