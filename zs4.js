var zs4 = require('./zs4/static/zs4');
var node = require('./zs4/node');

var msg = new Object();
var path = msg;

path['zs4'] = new Object();
path = path['zs4'];

for (var i = 2 ; i < process.argv.length ; i++){
    if (zs4.is.name(process.argv[i])){
      path[process.argv[i]] = new Object();
      path = path[process.argv[i]];
    }
    else{
      var arr = zs4.string.split.separators(process.argv[i],':/\\=');
      if (arr.length == 2 && zs4.is.name(arr[0])) path[arr[0]]=arr[1];
    }
}

zs4.define();
zs4.console.log('defined');
zs4.load(function(){
  zs4.console.log('loaded');
  // set up root authority
  var req = new zs4.request({request:{node:true,},input:msg});

  zs4.THIS._.transform(req,function(){
    zs4.console.log('transformed');
    if (req.request.needsSaving){
      zs4.console.log('req.request.needsSaving');
      zs4.save(function(){
        zs4.console.log('saved');
        console.log(zs4.json.stringify(zs4.THIS._.store()));
      });
    }
    else{
      //console.log(zs4.json.stringify(zs4.type.store.call(zs4.THIS)));
    }
  });
});
