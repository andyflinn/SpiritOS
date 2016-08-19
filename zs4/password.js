var zs4 = require('./static/zs4');
var token = require('./token');
var passhash = require('password-hash');

var password = exports;


password.schema = function(parent){
  parent._.property(new password.create());
};

password.create = function(){
  var THIS = this;
  var input = new Object({name:'password',flags:'required api',authGet:['zs4.public',],authSet:['zs4.public',]});
  zs4.type.object.call(this,input);
  THIS._.create = password.create;

  THIS._.transform = (function(req,cb){
    if (zs4.is.object(req.input)){
      if (zs4.is.password(req.input.vfy)||zs4.is.password(req.input.set)){
        console.log(this._.path+'.transform('+JSON.stringify(req.input)+')');
        console.log(req.input);
      }

      if (passhash.isHashed(this._.value.hashed)){
        var oldPassVerified = this.verify(req.input.vfy);

        if (oldPassVerified){
          console.log('...old password verified...');
          req.tokenCreate({iss:THIS._.path,scope:req.scope._.path,});
          req.request.reget = THIS._.path;

          if (zs4.is.password(req.input.set)){
            console.log('...pass change...');
            var nu = this.generate(req.input.set);
            if (nu!=null) {
              this._.value.hashed = nu;
              this._.shouldBeSaved(req);
              req.result(THIS,'password changed');
            }
          }
          else {
            req.result(THIS,'goscope');
          }

        }
        else {
          req.error(THIS);
          //zs4.console.log('...password '+req.input.vfy+' incorrect...');
        }
        //zs4.console.log('...have password already');
      }
      else{
        if (zs4.is.password(req.input.set)){

        var nu = this.generate(req.input.set);
          if (nu) {
            this._.value.hashed = nu;
            //console.log('...password set...');
            this._.shouldBeSaved(req);
            req.result(THIS,'password set');
          }
        }
        else {
          req.error(THIS);
        }
      }
    }

    this._.value.set='';
    this._.value.vfy='';

    this._.get(req); cb(); return;
  }).bind(THIS);

  THIS._.get = (function(req,po){
    //console.log('password.get'+ JSON.stringify(this._.authGet));
    var get = this._.getInitialize(req);
    if (get==null){
      console.log(this._.path+'.get() NOT AUTHORIZED!?!?!?');
      //console.log(this._.authGet);
      return null;
    }

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
      if (req.am(THIS)||req.own(THIS)){
        set(get);
      }
    }
    else {
      set(get);
    }

  }).bind(THIS);

  THIS._.property(new zs4.type.string({name:'hashed',flags:'required noget',index:{unique:true},}));
  THIS._.property(new zs4.type.string({name:'algorithm',flags:'required noget',default:'sha1',}));
  THIS._.property(new zs4.type.integer({name:'saltlength',flags:'required noget',min:32,max:256,default:32,}));
  THIS._.property(new zs4.type.integer({name:'iterations',flags:'required noget',min:1,max:128,default:1,}));

  THIS._.property(new zs4.type.password({name:'set',flags:'required nostore',}));
  THIS._.property(new zs4.type.password({name:'vfy',flags:'required nostore',authGet:['zs4.public'],authSet:['zs4.public'],}));

  THIS.verify = function(pw){
    //zs4.console.log('verifying');
    if (!zs4.is.password(pw)||!passhash.isHashed(this._.value.hashed)){
      //zs4.console.log('BAD!');
      return false;
    }
    return passhash.verify(pw,this._.value.hashed);
  };
  THIS.generate = function(pw){
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
