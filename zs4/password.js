var zs4 = require('./object');
var passhash = require('password-hash');

console.log('password.js');
var password = {};

if (typeof window === 'undefined') {
    password = exports;
    node = true;
} else {
    window.zs4.password = password;
}

password.event = function(input,output){
  const PASSWORD_ALGORITHM = 'sha1';
  const PASSWORD_SALTLENGTH = 32;
  const PASSWORD_ITERATIONS = 8;

  console.log('password.event()');
  if (input == null){
    if (isFunction(output))output({text:'no input'},null);
    return null;
  };

  if (isObject(input.initialized)){
    console.log(THIS);
    if (password.isHashed(THIS.password.hashed)){
      if (isFunction(output)) output(null,true);
      return true;
    }else{
      if (isFunction(output)) output(null,false);
      return false;
    }
  }

  if (isObject(input.set)){
    if (!isPassword(input.set.new)){
      if (isFunction(output)) output({text:'bad new password'},null);
      return null;
    }
    if (!password.isHashed(THIS.password.hashed)){
      THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
      if (isFunction(output)) output(null,true);
      return true;
    }
    else {
      if (!isPassword(input.set.old)||!password.verify(input.set.old,THIS.password.hashed)){
        if (isFunction(output)) output({text:'old password incorrect'},null);
        return null;
      }
      THIS.password.hashed = password.generate(input.set,{algorithm:PASSWORD_ALGORITHM,saltLength:PASSWORD_SALTLENGTH,iterations:PASSWORD_ITERATIONS,});
      if (isFunction(output)) output(null,true);
      return true;
    }
  }
};
