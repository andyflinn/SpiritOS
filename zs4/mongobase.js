var zs4 = require('./www/zs4');
var mongobase = exports;

mongobase.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'mongobase',required:true,}));
  zs4.type.property(parent.mongobase,new zs4.type.string({name:'url',required:true,default:'mongodb://127.0.0.1/'}));
};
