var zs4 = require('./static/zs4');
var NodeRSA = require('node-rsa');

var rsa = exports;
var rsa
rsa.schema = function(parent){
  parent._.property(new rsa.create());
};

rsa.create = function(){

  var THIS = this;
  var input = new Object({name:'rsa',flags:'required',});
  zs4.type.object.call(this,input);
  THIS._.create = rsa.create;

  THIS._.property(new zs4.type.text({name:'pem',flags:'required noget',}));
  THIS._.property(new zs4.type.string({name:'hash',flags:'required noget',}));

  THIS._.key = new NodeRSA();

  THIS._.load = (function(input){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (input.pem.length>10){
      this._.key = new NodeRSA(input.pem);
      this._.value.pem = input.pem;

      //zs4.console.log('isPrivate: '+this._.key.isPrivate());
      //zs4.console.log('isPublic: '+this._.key.isPublic());
      //zs4.console.log('isPublicOnly: '+this._.key.isPublic(true));
      //zs4.console.log(this._.key.exportKey('pkcs1-public'));
    }
  }).bind(THIS);

  THIS._.get = (function(req,po){
    var get = this._.getInitialize(req);
    if (get==null)return;

    get.public = new Object({_:{}});
    get.public._.name = 'public';
    get.public._.typename = 'text';
    get.public._.flags = (this._.flags.value | this._.flags.noset);
    get.public._.value = this._.getPublicKey();
  }).bind(THIS);

  THIS._.getPublicKey = (function(){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (this._.value.pem=='')return '';
    return this._.key.exportKey('pkcs1-public');
  }).bind(THIS);

  THIS._.store = (function(){
    //return null;
    //zs4.console.log(this._.path+'.store()');
    //if (this._.nostore){return null;}
    var store = new Object();
    this._.ensureKeyExists();
    store.pem = this._.value.pem;
    //store.key =   THIS._.key;
    return store;
  }).bind(THIS);

  THIS._.ensureKeyExists = (function(){

    //THIS._.key.importKey(THIS._.value.pem);
    if (this._.value.pem==''){
      zs4.console.log('....generating key pair...');

      this._.key.generateKeyPair();
      this._.value.pem = THIS._.key.exportKey();
    }
  }).bind(THIS);

  //zs4.console.log(THIS);
};
