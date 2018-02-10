var zs4 = require('./static/zs4');

zs4.commandLine = function(){
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
          var arr = zs4.string.split.separators(process.argv[i],'=');
          if (arr.length == 2 && zs4.is.name(arr[0])){
            if (arr[1]=='true')path[arr[0]]=true;
            else if (arr[1]=='false')path[arr[0]]=false;
            else path[arr[0]]=arr[1];
          }
          else if (arr.length > 2 && zs4.is.name(arr[0])){
            var val = arr[1];
            for (var i = 2 ; i < arr.length; i++)val += ('='+arr[i]);
            path[arr[0]] = val;
          }
        }
    }
  }

  //console.log(msg);

  zs4.define();
  //zs4.console.log('defined');
  zs4.load(function(){
    //zs4.console.log('loaded');
    // set up root authority
    var req = new zs4.request({input:msg});
    req.request.node = true;

    zs4.THIS._.transform(req,function(){
      zs4.console.log('transformed');
      if (req.request.needsSaving){
        zs4.console.log('req.request.needsSaving');
        zs4.save(function(){
          zs4.console.log('saved');
          console.log(zs4.json.textify(zs4.THIS._.store()));
        });
      }
    });
  });
};

zs4.plugin.registerStatic=function(dir){
  zs4.plugin.static.push(dir);
};
zs4.plugin.registerStyle=function(path){
  zs4.plugin.style.push(path);
};
zs4.plugin.registerScript=function(path){
  zs4.plugin.script.push(path);
};
zs4.plugin.registerApp=function(scope,script){
  zs4.plugin.registerScript(script);
  zs4.plugin.script.push(path);
};

zs4.node = new Object({require:{}});

const ZS4 = 'zs4';
const DOT_ZS4 = '.'+ZS4;

var fs = require('fs');

zs4.THIS.zs4.head.typename._.value = 'node';
zs4.THIS.zs4.head.typename._.default = 'node';
zs4.THIS.zs4._.property(new zs4.type.search());
zs4.THIS.zs4._.property(new zs4.type.type());
zs4.THIS.zs4._.property(new zs4.type.hi());
zs4.THIS.zs4._.property(new zs4.type.bye());

zs4.boot = new zs4.processor.sequential();

zs4.load = function(cb){
  function envvar(v,cb){
    var env = zs4.json.parse(process.env[v]);
    if (zs4.is.object(env)&&zs4.is.object(env.zs4)){
      console.log('launching from process.env.'+v);
      zs4.THIS._.load(env);
      cb(new zs4.done());
      return true;
    }
    cb(new zs4.error({text:'process.env.'+v+' did not contain a valid zs4 config'}));
    return false;
  };
  function file(f,cb){
    fs.readFile(f,'utf8',function(err,data){
      console.log('launching from ./'+f);
      if (!err && data){
        var value = zs4.json.parse(data);
        if (value!=null){
          zs4.THIS._.load(value);
          cb(new zs4.done());
          return true;
        }
        else {
          cb(new zs4.error({text:('cannot parse file '+f)}));
          return false;
        }
      }
      else {
        cb(new zs4.error({text:('cannot load file '+f)}));
        return false;
      }
    });
  };

  if (zs4.THIS.zs4.node.is.heroku._.getValue()){
    return envvar('ZS4',cb);
  }

  return file(DOT_ZS4,cb);
};

zs4.save = function(cb){
  var out = zs4.THIS._.store();
  if (out==null){cb(new zs4.error({text:'no save data.'}));return;}
  var save = zs4.json.textify(out);
  fs.writeFile(DOT_ZS4,save, function(err){
    if (err){cb(new zs4.error({text:'failed to save object.'}));}
    else {cb(new zs4.done({text:DOT_ZS4+' saved.'}));}
  });
};

zs4.define = function(){

  var fs = require('./fs');
  zs4.node.require.fs = fs;
  zs4.node.require.fs.schema(zs4.THIS.zs4);

  zs4.node.require.um = require('./static/um');

  zs4.node.require.node = require('./node');
  zs4.node.require.node.schema(zs4.THIS.zs4);

  zs4.node.require.password = require('./password');
  zs4.node.require.password.schema(zs4.THIS.zs4);

  zs4.node.require.passport = require('./passport');
  zs4.node.require.passport.schema(zs4.THIS.zs4);

  zs4.node.require.rsa = require('./rsa');
  zs4.node.require.rsa.schema(zs4.THIS.zs4);

  zs4.node.require.token = require('./token');
  zs4.node.require.token.schema(zs4.THIS.zs4);

  zs4.node.require.email = require('./email');
  zs4.node.require.email.schema(zs4.THIS.zs4);

  zs4.node.require.paypal = require('./paypal');
  zs4.node.require.paypal.schema(zs4.THIS.zs4);

  zs4.node.require.price = require('./price');
  //zs4.node.require.price.schema(zs4.THIS.zs4);

  zs4.node.require.mongodb = require('./mongodb');
  zs4.array.mongodb = new zs4.node.require.mongodb.create({name:'mongodb',boot:true,});
  zs4.THIS.zs4._.property(zs4.array.mongodb);

  zs4.THIS.zs4._.property(new zs4.type.folder({name:'folder'}));

  zs4.scope.config = function(){
    var CONFIG = this;
    zs4.type.scope.call(CONFIG);
    CONFIG._.create = zs4.scope.config;
    CONFIG.zs4.head.typename._.value = 'config';
    CONFIG.zs4.head.typename._.default = 'config';
    CONFIG._.name = 'config';

    zs4.node.require.password.schema(CONFIG.zs4);
    zs4.node.require.rsa.schema(CONFIG.zs4);
    zs4.node.require.token.schema(CONFIG.zs4);
    zs4.node.require.email.schema(CONFIG.zs4);
    zs4.node.require.paypal.schema(CONFIG.zs4);
    CONFIG.zs4._.property(new zs4.node.require.mongodb.template({name:'mongodb'}));
  };

  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'config',template:new zs4.scope.config(),}));
  zs4.THIS.zs4.type.config._.flags.value |= zs4.THIS.zs4.type.config._.flags.apiarg;
  zs4.THIS.zs4.type.config._.flags.set.authgetpublic(false);

  var user = require('./user');
  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'user',template:new user.create(),}));
  zs4.THIS.zs4.type.user._.flags.value |= zs4.THIS.zs4.type.user._.flags.apiarg;
  zs4.THIS.zs4.type.user.method.new._.flags.set.authgetpublic(false);
  zs4.THIS.zs4.type.user.method.new._.flags.set.authuser(false);
  zs4.THIS.zs4.type.user.method.deleteone._.flags.set.authgetpublic(false);
  zs4.THIS.zs4.type.user.method.deleteall._.flags.set.authgetpublic(false);

  var price = require('./price');
  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'price',template:new price.create(),}));
  zs4.THIS.zs4.type.price._.flags.value |= zs4.THIS.zs4.type.price._.flags.apiarg;
  zs4.THIS.zs4.type.price._.flags.set.authgetpublic(false);

  // plugins
  var plugin = new Object();

  var nodefs = require('fs');
  var rdr = nodefs.readdirSync('./zs4/plugin');
  console.log('readPlugins: ' + zs4.is.array(rdr) +  ' ' + rdr);
  for ( var i = 0 ; i < rdr.length ; i++ ){
    var fnam = './plugin/'+rdr[i]+'/'+rdr[i]+'.js';
    zs4.plugin.list[rdr[i]]=require(fnam);
  }

  zs4.boot.call(zs4.THIS,zs4.stat.boot,zs4.THIS);

  // Run express only once all components/plugins are loaded and ready
  zs4.node.require.express = require('./express');
  zs4.node.require.express.schema(zs4.THIS.zs4);

}
