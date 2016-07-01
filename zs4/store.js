var zs4 = require('./node');

//console.log('store.js');
var store = {};

if (zs4.is.node()) {
    store = exports;
} else {
    zs4.store = store;
}

store.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'store',required:true,}))
  //parent.store.property(new zs4.type.string({name:'hashed',required:true,default:'dummy',}));
}
