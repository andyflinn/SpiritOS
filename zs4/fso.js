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

  zs4.type.property(THIS,new zs4.type.object({name:'stat',required:true,api:true,}));
  addPath(THIS.stat);
  THIS.stat._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var THIS = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      fs.stat(req.input.path,function(err,stats){
        if (err){
          req.error(THIS,{text:'fs.stat(\''+req.input.path+'\')',data:err});
        }
        else{
          var result = fso.statsObject(stats);
          req.result(THIS,result);
        }
        THIS._.reply(req);
        cb();
      });
    }
    THIS._.reply(req);
    cb();
  }).bind(THIS);

  zs4.type.property(THIS,new zs4.type.object({name:'readdir',required:true,api:true,}));
  addPath(THIS.readdir);
  THIS.readdir._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var THIS = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      fs.readdir(req.input.path,function(err,list){
        if (err){
          req.error(THIS,{text:'fs.readdir(\''+req.input.path+'\')',data:err});
        }
        else {//if (zs4.is.array(list)){
          req.result(THIS,list);
        }
        THIS._.reply(req);
        cb();
      });
    }
    THIS._.reply(req);
    cb();
  }).bind(THIS);

  zs4.type.property(THIS,new zs4.type.object({name:'readfile',required:true,api:true,}));
  addPath(THIS.readfile);
  THIS.readfile._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var THIS = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      fs.readFile(req.input.path,'base64',function(err,data){
        if (err){
          req.error(THIS,{text:'fs.readFile(\''+req.input.path+'\')',data:err});
        }
        else {//if (zs4.is.array(list)){
          req.result(THIS,data);
        }
        THIS._.reply(req);
        cb();
      });
    }
    THIS._.reply(req);
    cb();
  }).bind(THIS);

}
