var zs4 = require('./static/zs4');
var NodeRSA = require('node-rsa');

var rsa = exports;

rsa.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'rsa',required:true,authGet:[zs4.const.EMAIL.PUBLIC,],}));
  zs4.type.property(parent.rsa,new zs4.type.text({name:'pem',required:true,noget:true,}));
  zs4.type.property(parent.rsa,new zs4.type.string({name:'hash',required:true,noget:true,}));

  parent.rsa._.key = new NodeRSA();

  parent.rsa._.load = (function(input){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (input.pem.length>10){
      this._.key = new NodeRSA(input.pem);
      this._.value.pem = input.pem;

      //zs4.console.log('isPrivate: '+this._.key.isPrivate());
      //zs4.console.log('isPublic: '+this._.key.isPublic());
      //zs4.console.log('isPublicOnly: '+this._.key.isPublic(true));
      //zs4.console.log(this._.key.exportKey('pkcs1-public'));
    }
  }).bind(parent.rsa);

  parent.rsa._.get = (function(args,parent){
    //zs4.console.log(this.path+'.get()');
    var get = this._.getInitialize(args,parent);
    if (get==null)return null;

    get.public = new Object({_:{}});
    get.public._.name = 'public';
    get.public._.typename = 'text';
    get.public._.noset = true;
    get.public._.value = this._.getPublicKey();

    return get;
  }).bind(parent.rsa);

  parent.rsa._.getPublicKey = (function(){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (this._.value.pem=='')return '';
    return this._.key.exportKey('pkcs1-public');
  }).bind(parent.rsa);

  parent.rsa._.store = (function(){
    //return null;
    zs4.console.log(this._.path+'.store()');
    //if (this._.nostore){return null;}
    var store = new Object();
    this._.ensureKeyExists();
    store.pem = this._.value.pem;
    //store.key =   parent.rsa._.key;
    return store;
  }).bind(parent.rsa);

  parent.rsa._.ensureKeyExists = (function(){

    //parent.rsa._.key.importKey(parent.rsa._.value.pem);
    if (this._.value.pem==''){
      zs4.console.log('....generating key pair...');

      this._.key.generateKeyPair();
      this._.value.pem = parent.rsa._.key.exportKey();
    }
  }).bind(parent.rsa);

  //zs4.console.log(parent.rsa);
};
