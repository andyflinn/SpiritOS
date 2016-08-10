var zs4 = require('./static/zs4');
var token = require('./token');
var passhash = require('password-hash');

var password = exports;

password.schema = function(parent){
  var THIS = new zs4.type.object({name:'password',required:true,authGet:[zs4.const.EMAIL.PUBLIC,],api:true,});
  zs4.type.property(parent,THIS);

  THIS._.transform = (function(req,cb){
    //zs4.console.log('password.transform('+JSON.stringify(req.input)+')');
    if (zs4.is.object(req.input)){
      if (passhash.isHashed(this._.value.hashed)){
        var oldPassVerified = this.verify(req.input.vfy);

        if (oldPassVerified){
          zs4.console.log('...old password verified...');
          req.tokenCreate({rpw:true});

          if (zs4.is.password(req.input.set)){
            zs4.console.log('...pass change...');
            var nu = this.generate(req.input.set);
            if (nu!=null) {
              this._.value.hashed = nu;
              this._.shouldBeSaved(req);
            }
          }

        }
        else {
          req.error(THIS);
          zs4.console.log('...password '+req.input.vfy+' incorrect...');
        }
        //zs4.console.log('...have password already');
      }
      else{
        if (zs4.is.password(req.input.set)){

        var nu = this.generate(req.input.set);
          if (nu) {
            this._.value.hashed = nu;
            this._.shouldBeSaved(req);
          }
        }
      }
    }

    this._.value.set='';
    this._.value.vfy='';

    this._.reply(req);
    cb();
  }).bind(THIS);

  THIS._.reply = (function(req,po){
    var get = this._.replyInitialize(req);
    if (get==null)return;

    function vfy(get){
      get.vfy = new Object({_:{}});
      get.vfy._.name = 'vfy';
      get.vfy._.typename = 'password';
      get.vfy._.value = '';
    };
    function set(get){
      get.set = new Object({_:{}});
      get.set._.name = 'set';
      get.set._.typename = 'password';
      get.set._.value = '';
    };

    if (passhash.isHashed(this._.value.hashed)){
      vfy(get);
      if (req.userIsRoot()){
        set(get);
      }
    }
    else {
      set(get);
    }

  }).bind(THIS);

  THIS._.get = (function(req,parent){
    //zs4.console.log(this.path+'.get()');
    var get = this._.getInitialize(req,parent);
    if (get==null)return null;

    function vfy(get){
      get.vfy = new Object({_:{}});
      get.vfy._.name = 'vfy';
      get.vfy._.typename = 'password';
      get.vfy._.value = '';
    };
    function set(get){
      get.set = new Object({_:{}});
      get.set._.name = 'set';
      get.set._.typename = 'password';
      get.set._.value = '';
    };

    if (passhash.isHashed(this._.value.hashed)){
      vfy(get);
      if (req.userIsRoot()){
        set(get);
      }
    }
    else {
      set(get);
    }

    return get;
  }).bind(THIS);


  zs4.type.property(parent.password,new zs4.type.string({name:'hashed',required:true,noget:true,index:{unique:true},}));
  zs4.type.property(parent.password,new zs4.type.string({name:'algorithm',required:true,noget:true,default:'sha1',}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'saltlength',required:true,noget:true,min:32,max:256,default:32,}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'iterations',required:true,noget:true,min:1,max:128,default:1,}));

  zs4.type.property(parent.password,new zs4.type.password({name:'set',required:true,nostore:true,}));
  zs4.type.property(parent.password,new zs4.type.password({name:'vfy',required:true,nostore:true,authGet:[zs4.const.EMAIL.PUBLIC,],authSet:[zs4.const.EMAIL.PUBLIC,],}));

  parent.password.verify = function(pw){
    //zs4.console.log('verifying');
    if (!zs4.is.password(pw)||!passhash.isHashed(this._.value.hashed)){
      //zs4.console.log('BAD!');
      return false;
    }
    return passhash.verify(pw,this._.value.hashed);
  };
  parent.password.generate = function(pw){
    //zs4.console.log('generating password');
    if (!zs4.is.password(pw)) return null;
    var nu = null;
    try{
      nu = passhash.generate(pw,{algorithm:this._.value.algorithm,saltLength:this._.value.saltlength,iterations:this._.value.iterations,});
    }
    catch(err){
      //zs4.console.log(err);
      return null;
    }
    //zs4.console.log('success!');
    return nu;
  };

}
