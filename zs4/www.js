var zs4 = require('./node');
var http = require('http');

//console.log('www.js');
var www = {};

if (zs4.is.node()) {
    www = exports;
} else {
    zs4.www = www;
}

www.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'www',required:true,}))
  zs4.type.property(parent.www,new zs4.type.integer({name:'port',required:true,default:3000,}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'autostart',required:true}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'start',nostore:true}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'stop',nostore:true}));

  /*
  parent.www.api = function(input,output){
    console.log('www.api()');
    console.log(www.value);
    console.log(zs4.copy.noncircular(input));
    if (www.value.start == true){
      console.log('www.value.server.start == true');
      www.value.start=false;
      www.value.server = http.createServer(function(req,res){
        response.end('It Works!! Path Hit: ' + request.url);
      });
      www.value.server.listen(www.value.port);
    }
  }
  */

}
