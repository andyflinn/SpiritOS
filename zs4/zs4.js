var zs4 = require('./js/js');
var debug = require('debug')('zs4node');

zs4.commandLine = function(){
  var msg = new Object();
  var path = msg;

  path['zs4'] = new Object();
  path = path['zs4'];

  debug(process.argv);
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

  //debug(msg);

  zs4.define();
  //zs4.debug('defined');
  zs4.load(function(){
    //zs4.debug('loaded');
    // set up root authority
    var req = new zs4.request({input:msg});
    req.request.node = true;

    zs4.THIS._.transform(req,function(){
      zs4.debug('transformed');
      if (req.request.needsSaving){
        zs4.debug('req.request.needsSaving');
        zs4.save(function(){
          zs4.debug('saved');
          console.log(zs4.json.textify(zs4.THIS._.store()));
        });
      }
    });
  });
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
  function guess(cb){
    var z = zs4.THIS.zs4;
    z.express.port._.value = 8080;

    z.email.smtp.from._.value = 'countinn@gmail.com';
    z.password.hashed._.value = z.password.generate('password');
    debug('user/pass: countinn@gmail.com/password');

    var node = zs4.THIS.zs4.node;

    return cb();
  };
  function envvar(v,cb){
    var env = zs4.json.parse(process.env[v]);
    if (zs4.is.object(env)&&zs4.is.object(env.zs4)){
      debug('launching from process.env.'+v);
      zs4.THIS._.load(env);
      cb(new zs4.done());
      return true;
    }
    cb(new zs4.error({text:'process.env.'+v+' did not contain a valid zs4 config'}));
    return false;
  };
  function file(f,cb){
    fs.readFile(f,'utf8',function(err,data){
      debug('launching from ./'+f);
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

  return file(DOT_ZS4,function(){
    return cb();
  });
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
  var nodefs = require('fs');
  var path = require('path');

  zs4.node.require.require = require('./require');
  zs4.node.require.require.schema(zs4.THIS.zs4);

  zs4.node.require.fs = fs;
  zs4.node.require.fs.schema(zs4.THIS.zs4);

  zs4.THIS.zs4._.property(new zs4.type.object({name:'app',flags:'authgetpublic',}));

  zs4.node.require.meaning = require('./js/meaning');

  zs4.node.require.um = require('./js/um');

  zs4.node.require.node = require('./node');
  zs4.node.require.node.schema(zs4.THIS.zs4);

  zs4.node.require.password = require('./password');
  zs4.node.require.password.schema(zs4.THIS.zs4);


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


  zs4.node.require.jsondb = require('./jsondb');
  zs4.array.jsondb = new zs4.node.require.jsondb.create({name:'jsondb',boot:true,});
  zs4.node.require.jsondb.schema(zs4.THIS.zs4);

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
  };

  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'config',template:new zs4.scope.config(),}));
  zs4.THIS.zs4.type.config._.flags.value |= zs4.THIS.zs4.type.config._.flags.apiarg;
  zs4.THIS.zs4.type.config._.flags.set.authgetpublic(false);

  var word = require('./word');
  //zs4.THIS.zs4.type._.property(new zs4.type.array({name:'meaning',template:new word.meaning.create(),}));
  //zs4.THIS.zs4.type.meaning._.flags.set.authgetpublic(false);
  //zs4.THIS.zs4.type.meaning._.flags.value |= zs4.THIS.zs4.type.meaning._.flags.apiarg;
  //zs4.THIS.zs4.type.meaning.method.new._.flags.set.authgetpublic(false);
  //zs4.THIS.zs4.type.meaning.method.new._.flags.set.authuser(false);
  //zs4.THIS.zs4.type.meaning.method.deleteone._.flags.set.authgetpublic(false);
  //zs4.THIS.zs4.type.meaning.method.deleteall._.flags.set.authgetpublic(false);

  //zs4.THIS.zs4.type._.property(new zs4.type.array({name:'lang',template:new word.lang.create(),}));
  //zs4.THIS.zs4.type.lang._.flags.value |= zs4.THIS.zs4.type.lang._.flags.apiarg;
  //zs4.THIS.zs4.type.lang.method.new._.flags.set.authgetpublic(false);
  //zs4.THIS.zs4.type.lang.method.new._.flags.set.authuser(false);
  //zs4.THIS.zs4.type.lang.method.deleteone._.flags.set.authgetpublic(false);
  //zs4.THIS.zs4.type.lang.method.deleteall._.flags.set.authgetpublic(false);

  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'translation',template:new word.translation.create(),}));
  //zs4.THIS.zs4.type.translation._.flags.value |= zs4.THIS.zs4.type.translation._.flags.apiarg;

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

  // App type — file is source of truth; code field mirrors it; gitstatus is output-only
  function appGitStatus(key){
    try {
      var fp = path.join(process.cwd(),'apps',key,'main.js');
      var out = require('child_process').execSync('git status --porcelain '+fp,{cwd:process.cwd(),timeout:2000}).toString().trim();
      if (out==='') return 'committed';
      return out.charAt(0)==='?' ? 'untracked' : 'modified';
    } catch(e){ return 'unknown'; }
  }

  function appWriteFile(key, code){
    var appDir = path.join(process.cwd(),'apps',key);
    try { nodefs.mkdirSync(appDir,{recursive:true}); } catch(e){}
    nodefs.writeFile(path.join(appDir,'main.js'), code, function(){});
  }

  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'app',template:new zs4.type.app(),}));
  zs4.THIS.zs4.type.app._.flags.value |= zs4.THIS.zs4.type.app._.flags.apiarg;
  zs4.THIS.zs4.type.app._.flags.set.authgetpublic(false);
  zs4.THIS.zs4.type.app.method.new._.flags.set.authgetpublic(false);
  zs4.THIS.zs4.type.app.method.new._.flags.set.authuser(false);

  // When code is saved, sync to file and refresh gitstatus
  zs4.THIS.zs4.type.app._.onUpdate = function(key, doc){
    if (zs4.is.string(doc.code)) appWriteFile(key, doc.code);
    doc.gitstatus = appGitStatus(key);
  };

  zs4.THIS.zs4.type.app.method.new._.transform = (function(req,cb){
    var REQUEST = req;
    var NEW = zs4.THIS.zs4.type.app.method.new;
    var THIS = zs4.THIS.zs4.type.app;
    req.setScope(this);
    if (req.input === undefined || req.input === null){
      NEW._.get(req); cb(); return;
    }

    if (!(req.flags.value & req.flags.authset)){
      req.error(NEW,'not authorized'); NEW._.get(req); cb(); return;
    }

    var nu = THIS.template._.new();
    nu._.flags.set.notrans(false);
    nu._.flags.set.scope(true);
    nu.zs4.head.title._.value = zs4.is.object(req.input)&&zs4.is.string(req.input.title) ? req.input.title : '';
    nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();

    var rootEmail = zs4.THIS.zs4.email.smtp.from._.value;
    nu.zs4.head.author._.value = rootEmail;
    if (zs4.is.object(zs4.array.jsondb)){
      var rootDoc = zs4.array.jsondb.find('user','zs4.email',rootEmail);
      if (rootDoc) nu.zs4.head.owner._.value = 'zs4.type.user.array.'+rootDoc._id;
    }

    zs4.array.jsondb.new.call(THIS,nu,function(ret){
      if (!zs4.is.type(ret)){ NEW._.get(REQUEST); cb(); return; }

      var key = ret._.name;
      var filePath = './apps/'+key+'/main.js';

      var mainJs = [
        '// zs4 app — key: '+key,
        '// Edit: '+filePath,
        '// fn.call(THIS, THIS, window)',
        'function(THIS, window) {',
        '  var p = document.createElement(\'p\');',
        '  p.textContent = THIS._.name + \' (untitled) — edit '+filePath+'\';',
        '  window.appendChild(p);',
        '}',
      ].join('\n');

      ret.zs4.head.title._.value = key + ' (untitled)';
      ret.zs4.head.description._.value = 'Edit '+filePath+' to build this app.';
      ret.code._.value = mainJs;
      ret.gitstatus._.value = 'untracked';

      appWriteFile(key, mainJs);

      zs4.array.jsondb.updateID.call(THIS, key, ret._.store(), function(){
        THIS._.array.elementConnect(THIS.array,ret);
        ret._.transform(REQUEST.create({input:{}}),function(){
          REQUEST.result(NEW,ret._.path);
          NEW._.get(REQUEST);
          REQUEST.setScope(THIS.array);
          THIS.array._.get(REQUEST);
          cb();
        });
      });
    });
  }).bind(zs4.THIS.zs4.type.app.method.new);

  // Media type
  zs4.THIS.zs4.type._.property(new zs4.type.array({name:'media',template:new zs4.type.media(),}));
  zs4.THIS.zs4.type.media._.flags.value |= zs4.THIS.zs4.type.media._.flags.apiarg;
  zs4.THIS.zs4.type.media._.flags.set.authgetpublic(false);
  zs4.THIS.zs4.type.media.method.deleteone._.flags.set.authgetpublic(false);

  zs4.THIS.zs4.type.media.method.new._.transform = (function(req,cb){
    var REQUEST = req;
    var NEW = zs4.THIS.zs4.type.media.method.new;
    var THIS = zs4.THIS.zs4.type.media;
    req.setScope(this);

    if (!(req.flags.value & req.flags.authset)){
      req.error(NEW,'not authorized'); NEW._.get(req); cb(); return;
    }
    if (!req.tokenExists()&&!req.userIsRoot()){
      req.error(NEW,'not logged in'); NEW._.get(req); cb(); return;
    }
    if (!zs4.is.object(req.input)
      ||!zs4.is.string(req.input.filedata)||req.input.filedata.length===0
      ||!zs4.is.string(req.input.filename)||req.input.filename.length===0
    ){
      req.error(NEW,'missing file data'); NEW._.get(req); cb(); return;
    }

    var filename = req.input.filename.trim();
    var ext = filename.lastIndexOf('.')>=0 ? filename.slice(filename.lastIndexOf('.')+1).toLowerCase() : '';
    var mimetype = zs4.is.string(req.input.mimetype) ? req.input.mimetype : 'application/octet-stream';
    var base64 = req.input.filedata;
    if (base64.indexOf('base64,')>=0) base64 = base64.split('base64,')[1];

    var buffer;
    try { buffer = new Buffer(base64,'base64'); }
    catch(e){ req.error(NEW,'invalid file data'); NEW._.get(req); cb(); return; }

    var mediaDir = path.join(process.cwd(),'media');
    if (!nodefs.existsSync(mediaDir)){ try{nodefs.mkdirSync(mediaDir);}catch(e){} }

    var nu = THIS.template._.new();
    nu._.flags.set.notrans(false);
    nu._.flags.set.scope(true);
    nu.zs4.head.title._.value = filename;
    nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();

    if (!req.userIsRoot()){
      nu.zs4.head.owner._.value = req.request.payload.scope;
      var creatorObj = zs4.THIS._.resolvePath(req.request.payload.scope);
      if (creatorObj) nu.zs4.head.author._.value = creatorObj.zs4.email._.value;
    } else {
      var rootEmail = zs4.THIS.zs4.email.smtp.from._.value;
      nu.zs4.head.author._.value = rootEmail;
      var ownerPath = '';
      if (zs4.is.object(zs4.array.jsondb)){
        var rootDoc = zs4.array.jsondb.find('user','zs4.email',rootEmail);
        if (rootDoc) ownerPath = 'zs4.type.user.array.'+rootDoc._id;
      }
      nu.zs4.head.owner._.value = ownerPath;
    }

    zs4.array.jsondb.new.call(THIS,nu,function(ret){
      if (!zs4.is.type(ret)){ NEW._.get(REQUEST); cb(); return; }

      var fileKey = ret._.name + (ext ? '.'+ext : '');
      var filePath = path.join(mediaDir,fileKey);

      nodefs.writeFile(filePath,buffer,function(err){
        if (err){
          req.error(NEW,'failed to save file');
          zs4.array.jsondb.deleteID.call(THIS,ret._.name,function(){
            NEW._.get(REQUEST); cb();
          });
          return;
        }
        ret.originalname._.value = filename;
        ret.mimetype._.value = mimetype;
        ret.size._.value = buffer.length;
        ret.path._.value = '/media/'+fileKey;
        zs4.array.jsondb.updateID.call(THIS,ret._.name,ret._.store(),function(){
          REQUEST.result(NEW,ret._.path);
          NEW._.get(REQUEST);
          REQUEST.setScope(THIS.array);
          THIS.array._.get(REQUEST);
          cb();
        });
      });
    });
  }).bind(zs4.THIS.zs4.type.media.method.new);

  zs4.THIS.zs4._.property(new zs4.type.object({name:'css'}));
  zs4.THIS.zs4.css._.css = new Object();
  zs4.THIS.zs4.css._.css.css = JSON.stringify(nodefs.readFileSync('./zs4/style.css','utf8'));

  zs4.THIS.zs4._.property(new zs4.type.object({name:'js'}));
  zs4.THIS.zs4.js._.property(new zs4.type.boolean({name:'debug',flags:'quickupdate'}));
  zs4.THIS.zs4.js._.js = new Object();

  if (zs4.THIS.zs4.node.is.heroku._.value == true){
    zs4.THIS.zs4.js.debug._.value = false;
  }
  else {
    zs4.THIS.zs4.js.debug._.value = true;
  }

  // plugins
  var plugin = new Object();

  var rdr = nodefs.readdirSync('./zs4/plugin');
  debug('readPlugins: ' + zs4.is.array(rdr) +  ' ' + rdr);
  for ( var i = 0 ; i < rdr.length ; i++ ){
    var fnam = './plugin/'+rdr[i]+'/'+rdr[i]+'.js';
    zs4.plugin.list[rdr[i]]=require(fnam);
  }

  // Run express only once all components/plugins are loaded and ready
  zs4.node.require.express = require('./express');
  zs4.node.require.express.schema(zs4.THIS.zs4);

  // Ensure root user exists in the database on startup
  zs4.boot.call({}, function(input, cb){
    var z = zs4.THIS.zs4;
    var adminEmail = z.email.smtp.from._.value;
    var USERARRAY = z.type.user;

    var existing = zs4.array.jsondb.find('user', 'zs4.email', adminEmail);
    if (existing){
      debug('root user already exists: ' + adminEmail);
      cb(); return;
    }

    var nu = USERARRAY.template._.new();
    nu.zs4.email._.value = adminEmail;
    nu.zs4.password.hashed._.value = z.password.hashed._.value;
    nu.zs4.head.title._.value = 'Root';
    nu.zs4.head.owner._.value = '';
    nu.zs4.head.created._.value = Date.now();
    nu.zs4.head.updated._.value = Date.now();

    zs4.array.jsondb.new.call(USERARRAY, nu, function(ret){
      debug(ret ? 'root user created: '+adminEmail : 'root user creation failed');
      cb();
    });
  }, {});

  // On startup: sync ./apps/(key)/main.js → DB code field, refresh gitstatus
  zs4.boot.call({}, function(input, cb){
    var appFile = path.join(process.cwd(),'data','app.json');
    if (!nodefs.existsSync(appFile)){ cb(); return; }
    try {
      var data = JSON.parse(nodefs.readFileSync(appFile,'utf8'));
      var changed = false;
      Object.keys(data).filter(function(k){ return k!=='_meta'; }).forEach(function(k){
        var mainJs = path.join(process.cwd(),'apps',k,'main.js');
        if (nodefs.existsSync(mainJs)){
          var fileCode = nodefs.readFileSync(mainJs,'utf8');
          if (data[k].code !== fileCode){ data[k].code = fileCode; changed = true; }
        }
        var gs = appGitStatus(k);
        if (data[k].gitstatus !== gs){ data[k].gitstatus = gs; changed = true; }
      });
      if (changed) nodefs.writeFileSync(appFile, JSON.stringify(data,null,2));
    } catch(e){ debug('app sync error: '+e.message); }
    cb();
  }, {});

}
