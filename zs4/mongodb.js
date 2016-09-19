var zs4 = require('./static/zs4');
var mongoose = require('mongoose');
var pager = require('mongoose-paginate');

var mongodb = exports;

mongodb.create = function(input){
  var MONGODB = this;
  zs4.type.object.call(MONGODB,input);
  this._.name = 'mongodb';
  MONGODB._.create = mongodb.create;

  var dbname = MONGODB._.name;
  if (zs4.is.string(input.dbname)&&input.dbname.length > 0)dbname = input.dbname;

  MONGODB._.property(new zs4.type.object({name:'config',flags:'',}))
  MONGODB.config._.property(new zs4.type.boolean({name:'connected',flags:'required noset nostore',default:false,}));
  MONGODB.config._.property(new zs4.type.string({name:'url',flags:'required',default:'mongodb://127.0.0.1/'+dbname}));

  MONGODB._.property(new zs4.type.object({name:'method',flags:'',}))

  MONGODB.connect = (function(input,cb){
    console.log('MONGODB CONNECT!');

    // Create the database connection
    mongoose.connect(MONGODB.config.url._.value);

    // CONNECTION EVENTS
    // When successfully connected
    mongoose.connection.on('connected', function () {
      console.log('Mongoose default connection open to ' + MONGODB.config.url._.value);
      MONGODB.config.connected._.value = true;
      cb();
    });

    // If the connection throws an error
    mongoose.connection.on('error',function (err) {
      console.log('Mongoose default connection error: ' + err);
      MONGODB.config.connected._.value = false;
      cb();
    });

    // When the connection is disconnected
    mongoose.connection.on('disconnected', function () {
      console.log('Mongoose default connection disconnected');
      MONGODB.config.connected._.value = false;
    });

    // If the Node process ends, close the Mongoose connection
    process.on('SIGINT', function() {
      mongoose.connection.close(function () {
        MONGODB.config.connected._.value = false;
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
      });
    });



  }).bind(MONGODB);

  zs4.boot.call(MONGODB,MONGODB.connect,MONGODB);
}
