var zs4 = require('./www/zs4');
var passhash = require('password-hash');

var password = exports;

password.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'password',required:true,
    onchange:function(){
      //zs4.console.log('password.onchange()');
      //zs4.console.log(this.value);
      if (passhash.isHashed(this.value.hashed)){
        if (zs4.is.password(this.value.set)&&this.verify(this.value.old)){
          //zs4.console.log('...pass change');
          var nu = this.generate(this.value.set);
          if (nu!=null) this.value.hashed = nu;
        }
      }
      else{
        if (zs4.is.password(this.value.set)){
        //zs4.console.log('...pass initialize');
        var nu = this.generate(this.value.set);
          if (nu) this.value.hashed = nu;
        }
      }
      this.value.set='';
      this.value.old='';
    },

  }));

  zs4.type.property(parent.password,new zs4.type.string({name:'hashed',required:true,noget:true,index:{unique:true},}));
  zs4.type.property(parent.password,new zs4.type.string({name:'algorithm',required:true,default:'sha1',}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'saltlength',required:true,min:32,max:256,default:32,}));
  zs4.type.property(parent.password,new zs4.type.integer({name:'iterations',required:true,min:1,max:128,default:1,}));

  zs4.type.property(parent.password,new zs4.type.string({name:'set',required:true,nostore:true,noget:true,}));
  zs4.type.property(parent.password,new zs4.type.string({name:'old',required:true,nostore:true,noget:true,}));

  parent.password.verify = function(pw){
    //zs4.console.log('verifying');
    if (!zs4.is.password(pw)||!passhash.isHashed(this.value.hashed)){
      //zs4.console.log('BAD!');
      return false;
    }
    return passhash.verify(pw,this.value.hashed);
  };
  parent.password.generate = function(pw){
    //zs4.console.log('generating password');
    if (!zs4.is.password(pw)) return null;
    var nu = null;
    try{
      nu = passhash.generate(pw,{algorithm:this.value.algorithm,saltLength:this.value.saltlength,iterations:this.value.iterations,});
    }
    catch(err){
      //zs4.console.log(err);
      return null;
    }
    //zs4.console.log('success!');
    return nu;
  };

}
