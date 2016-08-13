var zs4 = require('./static/zs4');
var nodefs = require('fs');

var fs = exports;

fs.statsObject = function(stats){
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

fs.schema = function(parent){
  zs4.type.property(parent,new fs.create({name:'fs',required:true,}));

  //console.log(parent.fs.stat);
};


fs.create = function(input){

  var THIS = this;
  if (!zs4.is.object(input))input = new Object({name:'fs',required:true,nostore:true,});
  zs4.type.object.call(this,input);
  THIS._.create = fs.create;

  zs4.type.property(THIS,new zs4.type.object({name:'stat',required:true,nostore:true,api:true,}));
  zs4.type.property(THIS.stat,new zs4.type.string({name:'path',required:true,nostore:true,}));
  THIS.stat._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var STAT = this;


    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      console.log(STAT._.path+' cb-before: '+JSON.stringify(req.request.callback));
      nodefs.stat(req.input.path,function(err,stats){
        if (err){
          req.error(STAT,{text:'fs.stat(\''+req.input.path+'\')',data:err});
        }
        else{
          var result = fs.statsObject(stats);
          req.result(STAT,result);
        }
        console.log(STAT._.path+' cb-after: '+JSON.stringify(req.request.callback));
        STAT._.get(req); cb(); return;
      });
      return;
    }

    STAT._.get(req); cb(); return;
  }).bind(THIS.stat);

  //console.log(THIS.stat);

  zs4.type.property(THIS,new zs4.type.object({name:'readdir',required:true,nostore:true,api:true,}));
  zs4.type.property(THIS.readdir,new zs4.type.string({name:'path',required:true,nostore:true,}));
  THIS.readdir._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var READDIR = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      //console.log(READDIR._.path+'.readdir('+JSON.stringify(req.input)+')');
      nodefs.readdir(req.input.path,function(err,list){
        //console.log('readdir('+req.input.path+')')
        if (err){
          req.error(READDIR,{text:'fs.readdir(\''+req.input.path+'\')',data:err});
          //console.log('error.readdir('+req.input.path+')');
        }
        else {
          req.result(READDIR,list);
          //console.log('result.readdir('+req.input.path+')');
          //console.log(list);
        }
        READDIR._.get(req); cb(); return;
      });
      return;
    }
    READDIR._.get(req); cb(); return;
  }).bind(THIS.readdir);

  zs4.type.property(THIS,new zs4.type.object({name:'readfile',required:true,nostore:true,api:true,}));
  zs4.type.property(THIS.readfile,new zs4.type.string({name:'path',required:true,nostore:true,}));
  THIS.readfile._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    var THIS = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      nodefs.readFile(req.input.path,'base64',function(err,data){
        if (err){
          req.error(THIS,{text:'fs.readFile(\''+req.input.path+'\')',data:err});
        }
        else {//if (zs4.is.array(list)){
          req.result(THIS,data);
        }
        THIS._.get(req);
        cb();
      });
      return;
    }
    THIS._.get(req); cb(); return;
  }).bind(THIS.readfile);

}
