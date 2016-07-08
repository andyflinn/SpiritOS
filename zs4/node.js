var zs4 = require('./www/zs4');
var fs = require('fs');

const ZS4 = 'zs4';
const DOT_ZS4 = '.'+ZS4;

var node = exports;
zs4.node = node;

zs4.boot = new zs4.processor.sequential();

zs4.load = function(cb){
  fs.readFile(DOT_ZS4,'utf8',function(err,data){
    if (!err && data){
      value = zs4.json.parse(data);
      if (value!=null){
        zs4.type.load.call(zs4.THIS,value);
        cb(new zs4.done());
        return;
      }
    }
    cb(new zs4.error({text:'load failed.'}));
  });
};

zs4.save = function(cb){
  var out = zs4.type.store.call(zs4.THIS);
  if (out==null){cb(new zs4.error({text:'no save data.'}));return;}
  var save = zs4.json.stringify(out);
  fs.writeFile(DOT_ZS4,save, (err) => {
    if (err){cb(new zs4.error({text:'failed to save object.'}));}
    else {cb(new zs4.done({text:DOT_ZS4+' saved.'}));}
  });
};

zs4.define = function(){

  //zs4.console.log('___DEFINE___');
  var THIS = zs4.THIS = new zs4.type.object({name:'this',required:true,});
  zs4.type.property(THIS,new zs4.type.object({name:'zs4',required:true,}));

  var admin = require('./admin');
  admin.schema(THIS.zs4);

  var password = require('./password');
  password.schema(THIS.zs4);

  var mongobase = require('./mongobase');
  mongobase.schema(THIS.zs4);

  var www = require('./www');
  www.schema(THIS.zs4);

  var email = require('./email');
  email.schema(THIS.zs4);
}
