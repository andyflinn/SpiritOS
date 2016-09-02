var zs4 = require('./static/zs4');
var NodeRSA = require('node-rsa');
const crypto = require('crypto');

var rsa = exports;
var rsa
rsa.schema = function(parent){
  parent._.property(new rsa.create());
};

rsa.create = function(){

  var THIS = this;
  var input = new Object({name:'rsa',flags:'authgetpublic',});
  zs4.type.object.call(this,input);
  THIS._.create = rsa.create;

  THIS._.property(new zs4.type.text({name:'pem',flags:'noget',}));
  THIS._.property(new zs4.type.text({name:'public',flags:'nostore authgetpublic authsetself',}));
  THIS._.property(new zs4.type.string({name:'hash',flags:'noset nostore index unique',}));

  THIS._.key = new NodeRSA();

  THIS._.load = (function(input){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (zs4.is.string(input.pem)&&input.pem.length>10){
      this._.key = new NodeRSA(input.pem);
      this.pem._.value = input.pem;

      this.public._.value = THIS._.getPublicKey();
      const hash = crypto.createHash('sha1');
      hash.update(this._.key.exportKey('pkcs1-public-der'));
      this.hash._.value = hash.digest('base64');

      THIS._.print('RSA KEY HASH: '+this.hash._.value);
    }
  }).bind(THIS);
  THIS._.store = (function(){
    //return null;
    //zs4.console.log(this._.path+'.store()');
    //if (this._.nostore){return null;}
    var store = new Object();
    //if (this._.path == 'zs4.rsa') {
    //  this._.ensureKeyExists();
    //}
    store.pem = this.pem._.value;
    //store.key =   THIS._.key;
    return store;
  }).bind(THIS);


  THIS._.get = (function(req,po){
    req.setScope(THIS);
    this._.print(this._.path+'.get()');
    console.log('GETTING RSA PUBLIC KEY');
    var get = this._.getInitialize(req);
    if (get==null)return;

    req.setScope(THIS.public);
    this.public._.get(req,THIS);

    req.setScope(THIS.hash);
    this.hash._.get(req,THIS);

    return get;
  }).bind(THIS);

  THIS._.getPublicKey = (function(){
    //zs4.console.log('loading rsa object \n'+input.pem);
    if (this.pem._.value=='')return '';
    //console.log(zs4.base64.encode(JSON.stringify(this._.key.exportKey('pkcs1-public-der'))));
    return this._.key.exportKey('pkcs1-public');

  }).bind(THIS);

  THIS._.ensureKeyExists = (function(){

    if (this.pem._.value==''){
      zs4.console.log('....generating key pair...');

      this._.key.generateKeyPair();
      this.pem._.value = THIS._.key.exportKey();
    }
  }).bind(THIS);

  //zs4.console.log(THIS);
};
