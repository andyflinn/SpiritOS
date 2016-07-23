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

  require('./admin').schema(zs4.THIS.zs4);
  require('./password').schema(zs4.THIS.zs4);
  require('./mongobase').schema(zs4.THIS.zs4);
  require('./www').schema(zs4.THIS.zs4);
  require('./email').schema(zs4.THIS.zs4);

}
