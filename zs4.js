var zs4 = require('./zs4/www/zs4');
var node = require('./zs4/node');

var msg = new Object();
var path = msg;

path['zs4'] = new Object();
path = path['zs4'];

for (var i = 2 ; i < process.argv.length ; i++){
    if (zs4.is.name(process.argv[i])){
      path[process.argv[i]] = new Object();
      path = path[process.argv[i]];
    }else{
      var arr = zs4.string.split.separators(process.argv[i],':/\\=');
      if (arr.length == 2 && zs4.is.name(arr[0])) path[arr[0]]=arr[1];
    }
}


zs4.define();
zs4.console.log('defined');
zs4.load(function(){
  zs4.console.log('loaded');
  // set up root authority
  if (zs4.is.email(zs4.THIS.zs4.admin.value.email)){
    zs4.console.log('admin email: '+zs4.THIS.zs4.admin.value.email);
    msg.zs4 = {email:zs4.THIS.zs4.admin.value.email}
  }
  zs4.type.transform.call(zs4.THIS,msg,function(){
    zs4.console.log('transformed');
    zs4.save(function(){
      zs4.console.log('saved');
      //cb(zs4.type.get.call(zs4.THIS));
    });
  });
});
