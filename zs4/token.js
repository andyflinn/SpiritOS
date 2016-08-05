var zs4 = require('./static/zs4');

var token;
if (zs4.is.node()) {
    token = exports;
}
else {
    token = new Object();
}

token.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'token',required:true,}));
  zs4.type.property(parent,new zs4.type.string({name:'token',required:true,}));
}
