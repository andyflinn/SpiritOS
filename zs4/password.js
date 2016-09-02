var zs4 = require('./static/zs4');
var token = require('./token');
var passhash = require('password-hash');

var password = exports;


password.schema = function(parent){
  parent._.property(new password.create());
};

password.create = function(){
  var THIS = this;
  var input = new Object({name:'password',flags:'api authgetpublic authsetpublic',});
  zs4.type.object.call(this,input);
  //console.log('password flags: '+this._.flags.getString());
  THIS._.create = password.create;

  THIS._.transform = (function(req,cb){
    this._.transformInternal(req);
    req.setScope(this);
    this._.print('transform()',req);
    if (zs4.is.object(req.input)){
      if (zs4.is.password(req.input.vfy)||zs4.is.password(req.input.set)){
        this._.print(this._.path+'.transform('+JSON.stringify(req.input)+')',req);
      }

      if (passhash.isHashed(this.hashed._.value)){
        var oldPassVerified = this.verify(req.input.vfy);

        if (oldPassVerified){
          console.log('...old password verified...');
          req.tokenCreate({iss:THIS._.path,scope:req.scope._.path,});
          req.request.reget = THIS._.path;

          if (zs4.is.password(req.input.set)){
            console.log('...pass change...');
            var nu = this.generate(req.input.set);
            if (nu!=null) {
              this.hashed._.value = nu;
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
            this.hashed._.value = nu;
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

    this.set._.value='';
    this.vfy._.value='';

    this._.get(req); cb(); return;
  }).bind(THIS);

  THIS._.get = (function(req,po){
    req.setScope(this);
    this._.print(this._.path+'.get()');
    //console.log('password.get'+ JSON.stringify(this._.authGet));
    var get = this._.getInitialize(req);
    if (get==null){
      this._.print(this._.path+'.get() NOT AUTHORIZED!?!?!?',req);
      return null;
    }

    function vfy(get){
      get.vfy = new Object({_:{}});
      get.vfy._.name = 'vfy';
      get.vfy._.typename = 'password';
      get.vfy._.value = '';
      get.vfy._.flags = THIS._.flags.apiarg|THIS._.flags.required;
    };
    function set(get){
      get.set = new Object({_:{}});
      get.set._.name = 'set';
      get.set._.typename = 'password';
      get.set._.value = '';
      get.set._.flags = THIS._.flags.apiarg;
    };

    if (this._.flags.value & this._.flags.notrans){
      vfy(get);
      set(get);
    }
    else {
      if (passhash.isHashed(this.hashed._.value)){
        vfy(get);
        if (req.am(THIS)||req.own(THIS)){
          set(get);
        }
      }
      else {
        set(get);get.set._.flags |= THIS._.flags.required;
      }
    }

  }).bind(THIS);

  THIS._.property(new zs4.type.string({name:'hashed',flags:'noget',index:{unique:true},}));
  THIS._.property(new zs4.type.string({name:'algorithm',flags:'noget',default:'sha1',}));
  THIS._.property(new zs4.type.integer({name:'saltlength',flags:'noget',min:32,max:256,default:32,}));
  THIS._.property(new zs4.type.integer({name:'iterations',flags:'noget',min:1,max:128,default:1,}));

  THIS._.property(new zs4.type.password({name:'set',flags:'nostore',}));
  THIS._.property(new zs4.type.password({name:'vfy',flags:'required nostore',}));

  THIS.verify = function(pw){
    //zs4.console.log('verifying');
    if (!zs4.is.password(pw)||!passhash.isHashed(this.hashed._.value)){
      //zs4.console.log('BAD!');
      return false;
    }
    return passhash.verify(pw,this.hashed._.value);
  };
  THIS.generate = function(pw){
    //zs4.console.log('generating password');
    if (!zs4.is.password(pw)) return null;
    var nu = null;
    try{
      nu = passhash.generate(pw,{algorithm:this.algorithm._.value,saltLength:this.saltlength._.value,iterations:this.iterations._.value,});
    }
    catch(err){
      //zs4.console.log(err);
      return null;
    }
    //zs4.console.log('success!');
    return nu;
  };

}
