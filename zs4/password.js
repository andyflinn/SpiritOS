var zs4 = require('./js/js');
var token = require('./token');
var passhash = require('password-hash');
var debug = require('debug')('zs4password');

var password = exports;

function R(x){zs4.meaning.register(x);}
R('password');
R('setpwderrinvalid');
R('setpwderrset');
R('zenotapwd');
R('zepwdmissmatch');

password.schema = function(parent){
  parent._.property(new password.create());
};

password.create = function(){
  var THIS = this;
  var input = new Object({name:'password',flags:'api authsetself',});
  zs4.type.object.call(this,input);
  //debug('password flags: '+this._.flags.getString());
  THIS._.create = password.create;

  THIS._.transform = (function(req,cb){
    //this._.transformInternal(req);
    req.setScope(this);
    if (zs4.is.object(req.input)){
      if (req.input.reset==true){
        debug(this._.path+' PASSWORD WAS RESET');
        this._.reset();
        this._.shouldBeSaved(req);
        this._.get(req); cb(); return;
      }
      if (zs4.is.password(req.input.vfy)||zs4.is.password(req.input.set)){
      }

      if (passhash.isHashed(this.hashed._.value)){
        var oldPassVerified = this.verify(req.input.vfy);

        if (oldPassVerified){
          debug('...old password verified...');
          req.tokenCreate({iss:THIS._.path,scope:req.scope._.path,});
          //req.request.reget = THIS._.path;

          if (zs4.is.password(req.input.set)){
            debug('...pass change...');
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
          req.error(THIS,'setpwderrinvalid');
        }
      }
      else{
        if (zs4.is.password(req.input.set)){
          if (!req.flags.get.am()&&!req.flags.get.own()){
              req.error(THIS,'zenotauthorized');
          }
          else {
            var nu = this.generate(req.input.set);
            if (nu) {
              this.hashed._.value = nu;
              this._.shouldBeSaved(req);
              req.result(THIS,'goscope');
              req.tokenCreate({iss:THIS._.path,scope:req.scope._.path,});
            }
          }
        }
        else {
          req.error(THIS,'setpwderrset');
        }
      }
    }

    this.set._.value='';
    this.vfy._.value='';

    this._.get(req); cb(); return;
  }).bind(THIS);

  THIS._.get = (function(req,po){

    req.setScope(this);
    var get = this._.getInitialize(req);
    if (get==null){
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
      get.set._.flags = THIS._.flags.authsetself;
    };

    if (this._.flags.value & this._.flags.notrans){
      vfy(get);
      set(get);
    }
    else if (passhash.isHashed(this.hashed._.value)){
      vfy(get);
      if (req.flags.get.am()||req.flags.get.own()){
        set(get);
      }
      else {
        get.vfy._.flags |= THIS._.flags.quickupdate;
      }
    }
    else if (req.flags.get.am()||req.flags.get.own()){
      set(get);
      get.set._.flags |= THIS._.flags.required;
    }

    return get;
  }).bind(THIS);

  THIS._.reset = (function(){THIS.hashed._.value=''}).bind(THIS);

  THIS._.property(new zs4.type.string({name:'hashed',flags:'noget',}));
  THIS._.property(new zs4.type.string({name:'algorithm',flags:'noget',default:'sha1',}));
  THIS._.property(new zs4.type.integer({name:'saltlength',flags:'noget',min:32,max:256,default:32,}));
  THIS._.property(new zs4.type.integer({name:'iterations',flags:'noget',min:1,max:128,default:1,}));
  THIS._.property(new zs4.type.boolean({name:'reset',flags:'noget nostore',}));

  THIS._.property(new zs4.type.password({name:'set',flags:'nostore',}));
  THIS._.property(new zs4.type.password({name:'vfy',flags:'required nostore',}));

  THIS.isinitialized = function(){
    return passhash.isHashed(this.hashed._.value)
  };
  THIS.verify = function(pw){
    //zs4.debug('verifying');
    if (!zs4.is.password(pw)||!passhash.isHashed(this.hashed._.value)){
      //zs4.debug('BAD!');
      return false;
    }
    return passhash.verify(pw,this.hashed._.value);
  };
  THIS.generate = function(pw){
    //zs4.debug('generating password');
    if (!zs4.is.password(pw)) return null;
    var nu = null;
    try{
      nu = passhash.generate(pw,{algorithm:this.algorithm._.value,saltLength:this.saltlength._.value,iterations:this.iterations._.value,});
    }
    catch(err){
      //zs4.debug(err);
      return null;
    }
    //zs4.debug('success!');
    return nu;
  };

}
