var zs4 = require('./static/zs4');

var html = exports;

html.document = function(){
  var THIS = this;
  var input = new Object({name:'document',flags:'required api',authGet:['zs4.public',],});
  zs4.type.object.call(this,input);
  THIS._.create = password.create;

}

html.element = function(name){
  var THIS = this;
  var input = new Object({name:'document',flags:'required api',authGet:['zs4.public',],});
  zs4.type.object.call(this,input);
  THIS._.create = password.create;

}
