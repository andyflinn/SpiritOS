var zs4 = require('./node');
var passhash = require('password-hash');

//console.log('password.js');
var password = {};

if (zs4.is.node()) {
    password = exports;
} else {
    zs4.password = password;
}

password.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'password',required:true,}))
  zs4.type.property(parent.password,new zs4.type.string({name:'hashed',required:true,default:'dummy',}));
}

password.event = function(THIS,object,input){
  const PASSWORD_ALGORITHM = 'sha1';
  const PASSWORD_SALTLENGTH = 32;
  const PASSWORD_ITERATIONS = 8;

  console.log('password.event()');
  if (input == null){
    if (zs4.is.function(output))output({text:'no input'},null);
    return null;
  };

  if (zs4.is.object(input.initialized)){
    console.log(THIS);
    if (password.isHashed(THIS.password.hashed)){
      if (zs4.is.function) output(null,true);
      return true;
    }else{
      if (zs4.is.function) output(null,false);
      return false;
    }
  }

  if (zs4.is.object(input.set)){
    if (!zs4.is.password(input.set.new)){
      if (zs4.is.function(output)) output({text:'bad new password'},null);
      return null;
    }
    if (!password.isHashed(THIS.password.hashed)){
      THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
      if (zs4.is.function(output)) output(null,true);
      return true;
    }
    else {
      if (!zs4.is.password(input.set.old)||!password.verify(input.set.old,THIS.password.hashed)){
        if (zs4.is.function(output)) output({text:'old password incorrect'},null);
        return null;
      }
      THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
      if (zs4.is.function(output)) output(null,true);
      return true;
    }
  }
};
