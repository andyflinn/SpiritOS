var zs4 = require('./static/zs4');
var mongobase = exports;



mongobase.schema = function(parent){
  parent._.property(new zs4.type.object({name:'mongobase',required:true,}));
  mongobase.THIS = parent.mongobase;

  parent.mongobase._.property(new zs4.type.string({name:'url',required:true,default:'mongodb://127.0.0.1/'}));

  parent.mongobase.getDataBaseUrl = function(dbName){
    return (this.url._.value + dbName);
  }
};
