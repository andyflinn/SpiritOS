var zs4 = require('./static/zs4');
var fs = require('fs');

var fso;
if (zs4.is.node()) {
    fso = exports;
}
else {
    fso = new Object();
}

fso.statsObject = function(stats){
  var result = new Object({
    is:{
      file:stats.isFile(),
      dir:stats.isDirectory(),
      bdev:stats.isBlockDevice(),
      cdev:stats.isCharacterDevice(),
      fifo:stats.isFIFO(),
      sock:stats.isSocket(),
    },
  });

  if (result.is.file){
    result.size = stats.size;
  }

  return result;
};

fso.schema = function(parent){
  var THIS = new zs4.type.object({name:'fso',required:true,nostore:true});
  zs4.type.property(parent,THIS);

  function addPath(p){
    zs4.type.property(p,new zs4.type.string({name:'path',required:true,}));
  };

  zs4.type.property(THIS,new zs4.type.object({name:'stat',required:true,}));
  addPath(THIS.stat);
  THIS.stat._.transform = (function(args,cb){
    //zs4.console.log('password.transform('+JSON.stringify(args.input)+')');
    var THIS = this;
    fs.stat(args.input.path,function(err,stats){
      if (err){
        args.error(THIS,{text:'fs.stat(\''+args.input.path+'\')',data:err});
      }
      else{
        var result = fso.statsObject(stats);
        args.result(THIS,result);
      }

      cb();
    });

  }).bind(THIS);

  zs4.type.property(THIS,new zs4.type.object({name:'readdir',required:true,}));
  addPath(THIS.readdir);
  THIS.readdir._.transform = (function(args,cb){
    //zs4.console.log('password.transform('+JSON.stringify(args.input)+')');
    var THIS = this;
    fs.readdir(args.input.path,function(err,list){
      if (err){
        args.error(THIS,{text:'fs.readdir(\''+args.input.path+'\')',data:err});
      }
      else {//if (zs4.is.array(list)){
        args.result(THIS,list);
      }
      //else{
      //  args.error(THIS,{text:'fs.stat(\''+args.input.path+'\')',data:err});
      //}

      cb();
    });

  }).bind(THIS);

  zs4.type.property(THIS,new zs4.type.object({name:'readfile',required:true,}));
  addPath(THIS.readfile);
  THIS.readfile._.transform = (function(args,cb){
    //zs4.console.log('password.transform('+JSON.stringify(args.input)+')');
    var THIS = this;
    fs.readFile(args.input.path,'base64',function(err,data){
      if (err){
        args.error(THIS,{text:'fs.readFile(\''+args.input.path+'\')',data:err});
      }
      else {//if (zs4.is.array(list)){
        args.result(THIS,data);
      }
      //else{
      //  args.error(THIS,{text:'fs.stat(\''+args.input.path+'\')',data:err});
      //}

      cb();
    });

  }).bind(THIS);

}
