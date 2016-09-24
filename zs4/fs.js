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
  parent._.property(new fs.create());

  //console.log(parent.fs.stat);
};

fs.create = function(){
  var DRIVER = this;
  var THIS = this;
  input = new Object({name:'fs',flags:'nostore',});
  zs4.type.object.call(this,input);
  THIS._.create = fs.create;

  THIS._.property(new  zs4.type.string({name:'path',flags:'quickupdate',default:'./',}))

  THIS._.property(new zs4.type.object({name:'stat',flags:'nostore api',}));
  THIS.stat._.property(new zs4.type.string({name:'path',flags:'required nostore',minlength:1,}));
  THIS.stat._.transform = (function(req,cb){
    var STAT = this;
    req.setScope(this);
    function get(){
      STAT._.get(req);
      req.setScope(STAT.path);
      STAT.path._.get(req,STAT);
      cb();
      return;
    };
    this._.transformInternal(req);
    this._.print('transform()');
    if (!(req.flags.value & req.flags.authset)){
      var err = 'not authorized';
      req.error(THIS,err);
      this._.print(err);
      return get();
    }

    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      STAT._.print('cb-before: '+JSON.stringify(req.request.callback));
      nodefs.stat(req.input.path,function(err,stats){
        if (err){
          req.error(STAT,{text:'fs.stat(\''+req.input.path+'\')',data:err});
        }
        else{
          var result = fs.statsObject(stats);
          req.result(STAT,result);
        }
        STAT._.print('cb-after: '+JSON.stringify(req.request.callback));
        return get();
      });
      return;
    }

    return get();
  }).bind(THIS.stat);

  THIS._.property(new zs4.type.object({name:'readdir',flags:'nostore api',}));
  THIS.readdir._.property(new zs4.type.string({name:'path',flags:'required nostore',minlength:1,}));
  THIS.readdir._.transform = (function(req,cb){
    req.setScope(this);
    function get(){
      THIS.readdir._.get(req);
      req.setScope(THIS.readdir.path);
      THIS.readdir.path._.get(req,THIS.readdir);
      cb();
      return;
    };
    this._.transformInternal(req);
    if (!(req.flags.value & req.flags.authset)){
      var err = 'not authorized';
      req.error(THIS,err);
      this._.print(err);
      return get();
    }
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
        return get();
      });
      return;
    }
    return get();
  }).bind(THIS.readdir);

  THIS._.property(new zs4.type.object({name:'readfile',flags:'nostore api',}));
  THIS.readfile._.property(new zs4.type.string({name:'path',flags:'required nostore',minlength:1,}));
  THIS.readfile._.transform = (function(req,cb){
    var READFILE = this;
    req.setScope(this);
    function get(){
      READFILE._.get(req);
      req.setScope(READFILE.path);
      READFILE.path._.get(req,READFILE);
      cb();
      return;
    };
    this._.transformInternal(req);
    if (!(req.flags.value & req.flags.authset)){
      var err = 'not authorized';
      req.error(READFILE,err);
      this._.print(err);
      return get();
    }
    var THIS = this;
    if (zs4.is.object(req.input)&&(zs4.is.string(req.input.path))){
      nodefs.readFile(req.input.path,function(err,data){
        if (err){
          req.error(THIS,{text:'fs.readFile(\''+req.input.path+'\')',data:err});
        }
        else {//if (zs4.is.array(list)){
          req.result(THIS,data);
        }
        return get();
      });
      return;
    }
    return get();
  }).bind(THIS.readfile);

  THIS.list = function(req,cb){
    var REQUEST = req;
    var FOLDER = this;
    console.log('FOLDER._.path: '+FOLDER._.path);
    console.log('DRIVER._.path: '+DRIVER._.path);
    console.log('DRIVER.path._.value: ',DRIVER.path._.value);
    if (FOLDER._.rootFolder==true){
      FOLDER._.driver.path = DRIVER.path._.value;
      console.log('ROOT FOLDER!!!!');
    }
    else {
      if (!zs4.is.string(FOLDER._.driver.path)||!FOLDER._.driver.path.startsWith(DRIVER.path._.value)){
        req.error(FOLDER,'internal error');
        FOLDER._.getTree(req); cb(); return;
      }

      console.log('CHILD FOLDER!!!!');
    }

    nodefs.readdir(FOLDER._.driver.path,function(err,list){
      if (err||!list){
        req.error(FOLDER,'fs.readdir failure');
        FOLDER._.getTree(req); cb(); return;
      }
      if (list.length==0){
        req.error(FOLDER,'folder empty');
        FOLDER._.getTree(req); cb(); return;
      }
      else {
        //console.log('readdir returned: ',list);
        function getFileInfo(req,cb){
          console.log('getFileInfo('+req.input+')');
          nodefs.stat(FOLDER._.driver.path+'/'+req.input,function(err,stats){
            if (err||!stats){cb();return;}
            if (stats.isFile()){
              var nu = new zs4.type.file({name:'x'});
              nu._.name = req.input;
              FOLDER._.elementConnect(FOLDER,nu);
              nu._.get(req);
            }
            else if (stats.isDirectory()){
              console.log('stat('+req.input+')');
              var nu = new zs4.type.folder({name:'x'});
              nu._.name = req.input;
              FOLDER._.elementConnect(FOLDER,nu);
              nu._.getTree(req);
              nu.zs4._.getTree(req);
            }
            cb();
          });
        };

        var parallel = new zs4.processor.parallel();

        for (var i = 0 ; i < list.length ;i++){
          if (!zs4.is.name(list[i])||list[i]=='zs4')continue;
          var r = req.create({input:list[i],})
          parallel.call(FOLDER,getFileInfo,r);
        }

        parallel.run(function(){
          FOLDER._.getTree(req); cb(); return;
        });
      }
    });
  }

}

// folder driver
