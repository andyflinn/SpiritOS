var zs4 = require('./zs4/static/zs4');

var msg = new Object();
var path = msg;

path['zs4'] = new Object();
path = path['zs4'];

//console.log(process.argv);
if (process.argv.length==2){
  path.express = new Object({run:{}});
}
else {
  for (var i = 2 ; i < process.argv.length ; i++){
      if (zs4.is.name(process.argv[i])){
        path[process.argv[i]] = new Object();
        path = path[process.argv[i]];
      }
      else{
        var arr = zs4.string.split.separators(process.argv[i],':/\\=');
        if (arr.length == 2 && zs4.is.name(arr[0])){
          if (arr[1]=='true')path[arr[0]]=true;
          else if (arr[1]=='false')path[arr[0]]=false;
          else path[arr[0]]=arr[1];
        }
      }
  }
}

//console.log(msg);

zs4.define();
zs4.console.log('defined');
zs4.load(function(){
  zs4.console.log('loaded');
  // set up root authority
  var req = new zs4.request({input:msg});
  req.request.node = true;

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
