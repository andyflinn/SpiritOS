var zs4 = require('./static/zs4');
var admin = exports;

admin.schema = function(parent){
  zs4.type.property(parent,new admin.create({name:'admin',required:true,api:true,}));
};

admin.schema = function(input){

  var THIS = this;
  if (!zs4.is.object(input))input = new Object({name:'admin',required:true,api:true,});
  zs4.type.object.call(this,input);
  THIS._.api = true;
  THIS._.create = admin.create;
};
