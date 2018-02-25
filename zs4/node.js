'use strict';

var zs4 = require('./js');
var os = require('os');
var system = require('child_process');
var node = exports;

node.schema = function(parent){
  parent._.property(new node.create());
};

node.create = function(name){

  var NODE = this;

  var input = new Object({name:'node',flags:'noset nostore',});
  zs4.type.object.call(NODE,input);

  function proc(){
    NODE._.property(new zs4.type.object({name:'process',flags:'noset',}));

    NODE.process._.property(new zs4.type.string({name:'platform',flags:'noset',}));
    NODE.process.platform._.value = process.platform;

    NODE.process._.property(new zs4.type.string({name:'title',flags:'noset',}));
    NODE.process.title._.value = process.title;

    NODE.process._.property(new zs4.type.string({name:'version',flags:'noset',}));
    NODE.process.version._.value = process.version;

    NODE.process._.property(new zs4.type.number({name:'uptimesecs',flags:'noset',}));
    NODE.process.uptimesecs._.getValue = function(){ return process.uptime();};

    NODE.process._.property(new zs4.type.string({name:'port',flags:'noset',}));
    if (zs4.is.string(process.env.PORT)){NODE.process.port._.value = process.env.PORT;}
    else {NODE.process.port._.value = ('(not in process.env)');}

    NODE.process._.property(new zs4.type.string({name:'node',flags:'noset',}));
    if (zs4.is.string(process.env.NODE)){NODE.process.node._.value = process.env.NODE;}
    else {NODE.process.node._.value = ('(not in process.env)');}


  }
  function osys(){
    NODE._.property(new zs4.type.object({name:'os',flags:'noset',}));

    var cpus = os.cpus();
    NODE.os._.property(new zs4.type.integer({name:'cpucount',flags:'noset',}));
    NODE.os.cpucount._.value = cpus.length;
    NODE.os._.property(new zs4.type.integer({name:'cpumhz',flags:'noset',}));
    NODE.os.cpumhz._.value = cpus[0].speed;
    NODE.os._.property(new zs4.type.string({name:'cputype',flags:'noset',}));
    NODE.os.cputype._.value = cpus[0].model;

    NODE.os._.property(new zs4.type.string({name:'endian',flags:'noset',}));
    NODE.os.endian._.value = os.endianness();

    NODE.os._.property(new zs4.type.integer({name:'memfree',flags:'noset',}));
    NODE.os.memfree._.getValue = function(){ return os.freemem();};

    NODE.os._.property(new zs4.type.integer({name:'memtotal',flags:'noset',}));
    NODE.os.memtotal._.getValue = function(){ return os.totalmem();};

    NODE.os._.property(new zs4.type.integer({name:'uptimesecs',flags:'noset',}));
    NODE.os.uptimesecs._.getValue = function(){ return os.uptime();};

    NODE.os._.property(new zs4.type.string({name:'homedir',flags:'noset',}));
    NODE.os.homedir._.value = os.homedir();

    NODE.os._.property(new zs4.type.string({name:'hostname',flags:'noset',}));
    NODE.os.hostname._.value = os.hostname();

    NODE.os._.property(new zs4.type.string({name:'platform',flags:'noset',}));
    NODE.os.platform._.value = os.platform();

    NODE.os._.property(new zs4.type.string({name:'release',flags:'noset',}));
    NODE.os.release._.value = os.release();

    NODE.os._.property(new zs4.type.string({name:'tmpdir',flags:'noset',}));
    NODE.os.tmpdir._.value = os.tmpdir();

    NODE.os._.property(new zs4.type.string({name:'type',flags:'noset',}));
    NODE.os.type._.value = os.type();

    NODE.os._.property(new zs4.type.string({name:'user',flags:'noset',}));
    var ua = zs4.string.split.separators(os.homedir(),'/:\\');
    if (ua.length==0)NODE.os.user._.value = '';
    else NODE.os.user._.value = ua[(ua.length-1)];


    NODE.os._.property(new zs4.type.text({name:'networkinterfaces',flags:'noset',}));
    NODE.os._.neteyeface = new Object({
      nif:os.networkInterfaces(),
    });
    NODE.os._.neteyeface.count = (function(){
      var nif = NODE.os._.neteyeface.nif;
      var count = 0;
      for (var n in nif){
        var o = nif[n];
        if (zs4.is.array(o)){
          count++;
        }
      }
      return count;
    }).bind(NODE);
    NODE.os._.neteyeface.search = (function(s){
      var nif = NODE.os._.neteyeface.nif;
      var count = 0;
      for (var n in nif){if(zs4.string.search(n,s))return true;}
      return false;
    }).bind(NODE);
    NODE.os._.neteyeface.totext = (function(){
      //var nif = NODE.os._.neteyeface.nif;
      var text = zs4.json.textify(NODE.os._.neteyeface.nif);
      return text;
    }).bind(NODE);
    NODE.os.networkinterfaces._.value = NODE.os._.neteyeface.totext();
    NODE.os._.property(new zs4.type.integer({name:'networkifcount',flags:'noset',}));
    NODE.os.networkifcount._.value = NODE.os._.neteyeface.count();
  };
  function is(){
    NODE._.property(new zs4.type.object({name:'is',flags:'noset',}));
    NODE.is._.property(new zs4.type.boolean({name:'heroku',flags:'noset',}));
    if (zs4.is.string(process.env.NODE)&&(process.env.NODE=='/app/.heroku/node/bin/node')){
      NODE.is.heroku._.value = true;
    }
    else {
      NODE.is.heroku._.value = false;
    }

        NODE.is._.property(new zs4.type.boolean({name:'root',flags:'noset',}));
        if (NODE.os.user._.value=='root' && NODE.os.platform._.value=='linux'){NODE.is.root._.value=true;}

        NODE.is._.property(new zs4.type.boolean({name:'gcloudshell',flags:'noset',}));
        if (NODE.os.hostname._.value.search('devshell-vm')>=0){NODE.is.gcloudshell._.value=true;}

        NODE.is._.property(new zs4.type.boolean({name:'windows',flags:'noset',}));
        if (NODE.os.platform._.value=='win32' && NODE.process.platform._.value=='win32'){NODE.is.windows._.value=true;}

        NODE.is._.property(new zs4.type.boolean({name:'unixish',flags:'noset',}));
        if (NODE.os.homedir._.value.charAt(0)=='/'){NODE.is.unixish._.value=true;}


  };
  function has(){
    NODE._.property(new zs4.type.object({name:'has',flags:'noset',}));
    NODE.has._.property(new zs4.type.boolean({name:'wifi',flags:'noset',}));
    NODE.has.wifi._.value = NODE.os._.neteyeface.search('Wi-Fi');
    NODE.has._.property(new zs4.type.boolean({name:'lonet',flags:'noset',}));
    NODE.has.lonet._.value = NODE.os._.neteyeface.search('lo');
    NODE.has._.property(new zs4.type.boolean({name:'ethnet',flags:'noset',}));
    NODE.has.ethnet._.value = NODE.os._.neteyeface.search('eth0');
  };
  function exec(){
    NODE._.property(new zs4.type.object({name:'system',flags:'api apiarg',}));
    NODE.system._.property(new zs4.type.string({name:'cmd',flags:'apiarg',}));
    NODE.system._.transform = (function(req,cb){
      var SYSTEM = this;
      var REQUEST = req;
      req.setScope(this);
      SYSTEM._.transformInternal(req);

      if (!zs4.is.object(req.input)||!zs4.is.string(req.input.cmd)||req.input.cmd==''){
        req.error(SYSTEM,'bad input');
        SYSTEM._.getTree(req); cb(); return;
      }

      system.exec(req.input.cmd,{},function(err,stdout,stderr){
        if (err){
          req.error(SYSTEM,'during '+req.input.cmd);
          SYSTEM._.getTree(req); cb(); return;
        }
        req.result(SYSTEM,stdout);
        SYSTEM._.getTree(req); cb(); return;
      });


    }).bind(NODE.system);

  }

  proc();
  osys();
  is();
  has();

  exec();
}
