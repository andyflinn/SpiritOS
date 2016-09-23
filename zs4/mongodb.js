'use strict';

var zs4 = require('./static/zs4');
var mongoose = require('mongoose');
var pager = require('mongoose-paginate');

var mongodb = exports;

mongodb.hex2name = function(hex){
  var h = hex.toString().trim().toLowerCase();
  var n = '';
  for (var i = 0;i<h.length;i++){
    if(h.charAt(i)=='0'){n+='a';continue;}
    if(h.charAt(i)=='1'){n+='b';continue;}
    if(h.charAt(i)=='2'){n+='c';continue;}
    if(h.charAt(i)=='3'){n+='d';continue;}
    if(h.charAt(i)=='4'){n+='e';continue;}
    if(h.charAt(i)=='5'){n+='f';continue;}
    if(h.charAt(i)=='6'){n+='g';continue;}
    if(h.charAt(i)=='7'){n+='h';continue;}
    if(h.charAt(i)=='8'){n+='i';continue;}
    if(h.charAt(i)=='9'){n+='j';continue;}
    if(h.charAt(i)=='a'){n+='k';continue;}
    if(h.charAt(i)=='b'){n+='l';continue;}
    if(h.charAt(i)=='c'){n+='m';continue;}
    if(h.charAt(i)=='d'){n+='n';continue;}
    if(h.charAt(i)=='e'){n+='o';continue;}
    if(h.charAt(i)=='f'){n+='p';continue;}
  }
  return n;
};

mongodb.name2hex = function(name){
  var n = name.trim();
  var h = ''
  for (var i = 0;i < n.length;i++){
    if(n.charAt(i)=='a'){h+='0';continue;}
    if(n.charAt(i)=='b'){h+='1';continue;}
    if(n.charAt(i)=='c'){h+='2';continue;}
    if(n.charAt(i)=='d'){h+='3';continue;}
    if(n.charAt(i)=='e'){h+='4';continue;}
    if(n.charAt(i)=='f'){h+='5';continue;}
    if(n.charAt(i)=='g'){h+='6';continue;}
    if(n.charAt(i)=='h'){h+='7';continue;}
    if(n.charAt(i)=='i'){h+='8';continue;}
    if(n.charAt(i)=='j'){h+='9';continue;}
    if(n.charAt(i)=='k'){h+='a';continue;}
    if(n.charAt(i)=='l'){h+='b';continue;}
    if(n.charAt(i)=='m'){h+='c';continue;}
    if(n.charAt(i)=='n'){h+='d';continue;}
    if(n.charAt(i)=='o'){h+='e';continue;}
    if(n.charAt(i)=='p'){h+='f';continue;}
  }
  return h;
};

mongodb.scopeToSchema = function(ARRAY,scope){

  function recurse(ARRAY,type){
    var ret = new Object();
    if (type._.type==Object){
      for (var n in type){
        if (!zs4.is.type(type[n]))continue;
        if (type[n]._.flags.get.nostore())continue;

        ret[n] = recurse(ARRAY,type[n]);
      }
    }
    else {
      //console.log('SCHEMA ENTRY: '+type._.path);
      ret.type = type._.type;
      ret.default = type._.default;
      if (type._.flags.get.index())ret.index=true;
      if (type._.flags.get.unique())ret.unique=true;

      if (ret.type==Number){
        if (zs4.is.number(type._.min))ret.min = type._.min;
        if (zs4.is.number(type._.max))ret.max = type._.max;
      }
      else if (ret.type==String){
        if (zs4.is.number(type._.minlength))ret.minlength = type._.minlength;
        if (zs4.is.number(type._.maxlength))ret.maxlength = type._.maxlength;
        if (type._.flags.get.textsearch()){
          console.log('MUST SEARCH '+type._.path);
          ARRAY._.mongoTextSearch[type._.path]='text';
        }
      }
    }
    return ret;
  };

  var ret = recurse(ARRAY,scope);
  return ret;
};

mongodb.create = function(input){
  var MONGODB = this;
  zs4.type.object.call(MONGODB,input);
  this._.name = 'mongodb';
  MONGODB._.create = mongodb.create;
  //zs4.array.mongodb = new zs4.node.require.mongodb.create({name:'mongodb'});

  //MONGODB._.mongodb = new Object({schema:{},util:{}});
  //MONGODB._.mongodb
  var dbname = MONGODB._.name;
  if (zs4.is.string(input.dbname)&&input.dbname.length > 0)dbname = input.dbname;

  MONGODB._.property(new zs4.type.object({name:'config',flags:'',}))
  MONGODB.config._.property(new zs4.type.boolean({name:'connected',flags:'required noset nostore',default:false,}));
  MONGODB.config._.property(new zs4.type.string({name:'url',flags:'required',default:'mongodb://127.0.0.1/zs4'}));

  MONGODB.initializeArray = function(ARRAY){

    if (ARRAY._.mongoSchema == null){

      ARRAY._.mongoTextSearch = new Object();
      ARRAY._.mongoSchemeRaw = mongodb.scopeToSchema(ARRAY,ARRAY.template._.new());
      ARRAY._.mongoSchema = new mongoose.Schema(ARRAY._.mongoSchemeRaw);

      console.log(ARRAY._.mongoTextSearch);
      ARRAY._.mongoSchema.index(ARRAY._.mongoTextSearch);

      //console.log(JSON.stringify(ARRAY._.mongoSchema));

      ARRAY._.mongoModel = function(){
        return mongoose.model(ARRAY.template.zs4.head.typename._.value, ARRAY._.mongoSchema);
      };

      ARRAY._.model = ARRAY._.mongoModel();
    }
  }

  MONGODB.query = function(arg,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.query('+this._.path+'.array)');

    var find = new Object();

    var query = ARRAY._.model.find({});
    if (zs4.is.string(arg.search)){
      var a = zs4.string.split.spaces(arg.search);
      if (a.length > 0){
        var or = new Array();
        for (var i = 0 ; i < a.length;i++){
          for (var n in ARRAY._.mongoTextSearch){
            var name = (' '+n+' ').trim();
            var nu = new Object();
            nu[name] = { "$regex": a[i], "$options": "i" };
            or.push(nu);
          }
        }
        console.log('$or:',or);
        query.find({$or:or});
      }
    }

    for (var n in arg.select){
      //console.log('for (var '+n+' in arg.select)');
      if (!zs4.is.type(arg.select[n]))continue;
      if (arg.select[n]._.typename!='selectitem')continue;
      //console.log('for (var '+n+' in arg.select) ITEM ENTRY FOUND!!!');

      var item = arg.select[n].item._.value;
      var ityp = ARRAY.template._.resolvePath(item)
      if (ityp==null)continue;
      var opcode = arg.select[n].opcode._.value;
      if (opcode=='exists')continue;
      var type = arg.select[n].type._.value;
      if (type!='const')continue;
      var value = arg.select[n].const._.value;
      if (ityp._.type == String || ityp._.type == Number || ityp._.type == Boolean){
        value = ityp._.opcode.convert(value);
      }
      if (opcode=='eq'){query.where(item).equals(value);}

      console.log('FOUND A SELECT CONDITION');
    }

    if (arg.sort!=null&&zs4.is.string(arg.sort.item)&&arg.sort.item.length>0){
        var so = new Object();

        if (arg.sort.item.descend==true)so[arg.sort.item]=-1;
        else so[arg.sort.item]=1;

        query.sort(so);
    }
    else {
      query.sort('-zs4.head.updated');
    }

    //console.log('   QUERY: ',query);
    //console.log('FIND: ',find);
    //var item = new ARRAY._.model();

    ARRAY._.model.find(query, function (err, data){
      if (err!=null||data==null||!zs4.is.array(data)){cb(null); return;}
      console.log('QUERY RETURNED ARRAY!!!: length='+data.length);

      var type = ARRAY.template._.new();

      for (var i = 0 ; i < data.length ; i++){
        console.log(data[i].zs4.head.title);

        type._.name = mongodb.hex2name(data[i]._id);
        ARRAY._.array.elementConnect(ARRAY.array,type);
        type._.load(data[i]);
        type._.getTree(arg.request);
      }

      cb(data);
    });

  };

  MONGODB.getOne = function(req,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.getOne('+this._.path+'.array.)');

    var q = new Object();
    q[req.input.item]=req.input.eq;

    ARRAY._.model.findOne(q, function (err, data){
      if (err!=null||data==null){cb(null); return;}
      console.log('FOUND!!!: '+req.input.eq);

      var type = ARRAY.template._.new();
      type._.name = mongodb.hex2name(data._id);
      type._.load(data);
      ARRAY._.array.elementConnect(ARRAY.array,type);
      type._.getTree(req);

      cb(type);
    });
  };

  MONGODB.getID = function(id,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.getID('+this._.path+'.array.'+id+')');

    ARRAY._.model.findById(mongodb.name2hex(id), function (err, data){
      if (err!=null||data==null){cb(null); return;}
      console.log('FOUND!!!: '+id);
      cb(data);
    });

  };

  MONGODB.updateID = function(id,data,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.updateID('+this._.path+'.array.'+id+')');

    var item = new ARRAY._.model();

    ARRAY._.model.findOneAndUpdate({_id:mongodb.name2hex(id)},data,{new:true,},function(err, item){
      if (err!=null||item==null){cb(null); return;}
      console.log('FOUND for UPDATE!!!: '+id);

      item.save()
      cb(data);
    });
  };

  MONGODB.deleteID = function(id,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.deleteID('+this._.path+'.array.'+id+')');

    var item = new ARRAY._.model();

    ARRAY._.model.findOneAndRemove({_id:mongodb.name2hex(id)},function(err, item){
      if (err!=null||item==null){cb(null); return;}
      console.log('FOUND for DELETE!!!: '+id);
      cb(item);
    });
  };

  MONGODB.new = function(nu,cb){
    var ARRAY = this;
    MONGODB.initializeArray(ARRAY);
    console.log('MONGODB.new('+this._.path+')');

    var item = new ARRAY._.model(nu._.store());

    item.save(function (err,data){
      if(err||data==null){cb(null);return;}

      console.log(data);
      nu._.load(data);

      nu._.name = mongodb.hex2name(data._id.toString());
      console.log(nu._.name,mongodb.name2hex(nu._.name));

      cb(nu); return;
    });
  }

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
