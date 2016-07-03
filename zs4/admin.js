var zs4 = require('./www/zs4');
var admin = exports;

admin.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'admin',required:true,}));
  zs4.type.property(parent.admin,new zs4.type.email({name:'email',required:true,}));
};
