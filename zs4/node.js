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

zs4.request = function(o){

  if (zs4.is.object(o)){
    if (zs4.is.object(o.request))this.request = o.request;
    if (zs4.is.object(o.input))this.input = o.input;
  }

  if (!zs4.is.object(this.request))this.request = new Object();
  if (!zs4.is.object(this.input))this.input = new Object();

  if (!zs4.is.email(this.request.email))this.request.email = zs4.const.EMAIL.PUBLIC;

  this.needsSaving = false;
  this.save = function(){this.needsSaving=true};

  this.userIsRoot = function(){
    if (zs4.is.email(this.request.email)&&zs4.THIS.zs4.admin.value.email==this.request.email)return true;
    if (this.request.node) return true;
    return false;
  }

  this.process = function(cb){
    zs4.console.log(this.userIsRoot());
    var THIS = this;
    zs4.THIS.transform(this,function(){
      //zs4.console.log(THIS);
      var get = zs4.THIS.get(THIS);
      if (get==null)get = new Object();
      cb(get);
      if (THIS.needsSaving){
        zs4.save(function(){zs4.console.log('THIS was saved')});
      }
    });
  };
};
