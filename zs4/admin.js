var zs4 = require('./static/zs4');
var admin = exports;

admin.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'admin',required:true,}));
  zs4.type.property(parent.admin,new zs4.type.email({name:'email',required:true,}));
  zs4.type.property(parent.admin,new zs4.type.integer({
    name:'tokenexpiry',
    min:zs4.const.MS.MINUTE,
    max:zs4.const.MS.YEAR,
    required:true,
    default:(zs4.const.MS.WEEK*2),
  }));
};
