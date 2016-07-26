var zs4 = require('./static/zs4');
var passhash = require('password-hash');

var password = exports;

password.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'password',required:true,
    onchange:function(req,cb){
      //zs4.console.log('password.onchange()');
      //zs4.console.log(this.value);
      if (passhash.isHashed(this._.value.hashed)){
        var oldPassVerified = this.verify(this._.value.vfy);

        if (oldPassVerified){
          zs4.console.log('...old password verified...');

          if (zs4.is.password(this._.value.set)){
            zs4.console.log('...pass change...');
            var nu = this.generate(this._.value.set);
            if (nu!=null) this._.value.hashed = nu;
          }

        }
        else {
          zs4.console.log('...password '+this._.value.vfy+' incorrect...');
        }
        //zs4.console.log('...have password already');
      }
      else{
        if (zs4.is.password(this._.value.set)){
        //zs4.console.log('...pass initialize');
        var nu = this.generate(this._.value.set);
          if (nu) this._.value.hashed = nu;
        }
      }
      this._.value.set='';
      this._.value.vfy='';
      cb();
    },
    authGet:[zs4.const.EMAIL.PUBLIC,],
  }));

  zs4.type.property(parent.password,new zs4.type.string({name:'hashed',required:true,noget:true,index:{unique:true},}));
  zs4.type.property(parent.password,new zs4.type.string({name:'algorithm',required:true,noget:true,default:'sha1',}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'saltlength',required:true,noget:true,min:32,max:256,default:32,}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'iterations',required:true,noget:true,min:1,max:128,default:1,}));

  zs4.type.property(parent.password,new zs4.type.string({name:'set',required:true,nostore:true,}));
  zs4.type.property(parent.password,new zs4.type.string({name:'vfy',required:true,nostore:true,authGet:[zs4.const.EMAIL.PUBLIC,],authSet:[zs4.const.EMAIL.PUBLIC,],}));

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
