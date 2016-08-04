var zs4 = require('./static/zs4');
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
        zs4.THIS._.load(value);
        cb(new zs4.done());
        return;
      }
    }
    cb(new zs4.error({text:'load failed.'}));
  });
};

zs4.save = function(cb){
  var out = zs4.THIS._.store();
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
  require('./rsa').schema(zs4.THIS.zs4);
  //require('./mongobase').schema(zs4.THIS.zs4);
  require('./express').schema(zs4.THIS.zs4);
  require('./email').schema(zs4.THIS.zs4);

  zs4.THIS._.transform = (function(args,cb){
    //zs4.console.log('transforming '+this.path)

    if (!zs4.is.object(args.input)){
      if (cb)cb(new zs4.error({text:'input not an object.'}));
      return;
    }

    var parallel = new zs4.processor.parallel();

    for (var n in this){
      if (!zs4.is.type(this[n])||args.input[n]==null)continue;

      if (this[n]._.type == Object){
        parallel.call(this[n],this[n]._.transform,new zs4.request({request:args.request,input:args.input[n],}));
      }else{
        parallel.call(this[n],this[n]._.transform,new zs4.request({request:args.request,input:args.input[n],parent:this._.value,}));
      }
    }

    var THIS = this;
    parallel.run(function(){
      //zs4.console.log(THIS.onchange);
      if (zs4.is.function(THIS._.onchange)){THIS._.onchange.call(THIS,args,cb);}
      else {cb();}
    });
    //if (this.type == Object)zs4.console.log(this.path+'.transform() done');

  }).bind(zs4.THIS);


}
