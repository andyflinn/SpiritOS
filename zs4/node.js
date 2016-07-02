var zs4 = require('./www/zs4');

var node = exports;
zs4.node = node;
node.configure = function(input,output){
  zs4.console.log('node.transform('+zs4.json.stringify(input)+')');
  var fs = require('fs');

  const ZS4 = 'zs4';
  const DOT_ZS4 = '.'+ZS4;
  const MAX_BYTE = 256;
  const MAX_WORD = (MAX_BYTE * MAX_BYTE);
  const SECOND = 1000;

  var value = null;
  zs4.console.log('___READ___');
  fs.readFile(DOT_ZS4,'utf8', function(err, data){
    zs4.console.log('readFile(\''+DOT_ZS4+'\')');
    function save(what){
      var save = zs4.json.stringify(what);
      zs4.console.log('writing '+DOT_ZS4+': '+save);
      fs.writeFile(DOT_ZS4,save, (err) => {
        if (err){
          if(zs4.is.function(output))output({text:'failed to save object'},null);
          return null;
        }
        if(zs4.is.function(output))output(null,true);
        return true;
      });
    };
    function respond(val,input,output){
      zs4.console.log('node.transform.respond('+zs4.json.stringify(val)+','+zs4.json.stringify(input)+')');

      zs4.console.log('___DEFINE___');
      var THIS = new zs4.type.object({name:'this',required:true,});
      zs4.type.property(THIS,new zs4.type.string({name:'abc',required:true,default:'def'}));
      zs4.type.property(THIS,new zs4.type.object({name:'zs4',required:true}));

      var password = require('./password');
      password.schema(THIS.zs4);

      var www = require('./www');
      www.schema(THIS.zs4);

      var store = require('./store');
      store.schema(THIS.zs4);

      zs4.THIS = THIS;
      zs4.console.log(zs4.json.stringify(THIS.value));

      zs4.console.log('___PROC___');
      var seq = new zs4.processor.sequential();
      seq.call(THIS,zs4.type.load,val);
      seq.call(THIS,zs4.type.transform,input);
      seq.run(function(){
        zs4.console.log('___END___');
      });

      /*
      zs4.console.log('___LOAD___');
      zs4.console.log(zs4.json.stringify(val));
      zs4.type.transform.call(THIS,val);
      zs4.console.log(zs4.json.stringify(THIS.value));

      var must_save = false;

      if (!zs4.is.object(input)){
        var err = new zs4.error({text:'zs4.transform(): no argument, use zs4.transform({})'});
        if (zs4.is.function(output))output(err,null);
        zs4.console.log(err);
        return null;
      }

      zs4.console.log('___TRANSFORM___');
      var ret = zs4.type.transform.call(THIS,input);
      zs4.console.log(zs4.json.stringify(THIS.value));
      */

      zs4.console.log('___SAVE___');
      var out = zs4.type.store.call(THIS);
      zs4.console.log(out);
      save(out);
    };


    if (err) {
      zs4.console.log('creating new '+DOT_ZS4);
      value = new Object();
      respond(value,input,output)
    }
    else {
      zs4.console.log(data);
      value = zs4.json.parse(data);
      if (value==null){
        zs4.console.log('unable to parse '+DOT_ZS4);
        zs4.console.log('creating new '+DOT_ZS4);
        value = new Object();
      }

      respond(value,input,output);
    }

  });

};
