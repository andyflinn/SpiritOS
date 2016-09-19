var zs4 = require('./static/zs4');
var mongoose = require('mongoose');
var pager = require('mongoose-paginate');

var mongodb = exports;

mongodb.create = function(input){
  var MONGODB = this;
  zs4.type.object.call(MONGODB,input);
  this._.name = 'mongodb';
  MONGODB._.create = mongodb.create;

  MONGODB._.property(new zs4.type.object({name:'config',flags:'',}))
  MONGODB.config._.property(new zs4.type.string({name:'url',flags:'required',default:'mongodb://127.0.0.1/'}));

  MONGODB._.property(new zs4.type.object({name:'method',flags:'',}))
}
