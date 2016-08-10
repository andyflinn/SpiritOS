var zs4 = require('./static/zs4');
var emailjs = require('emailjs');

var email = exports;

email.schema = function(parent){
  var THIS = new zs4.type.object({name:'email',required:true,api:true,});
  zs4.type.property(parent,THIS);

  //zs4.console.log('____INSIDE EMAIL SCHEMA____');
//  email.THIS = THIS;
  zs4.type.property(THIS,new zs4.type.email({name:'address',required:true,}));

  zs4.type.property(THIS,new zs4.type.object({name:'smtp',required:true,api:true,}));
  zs4.type.property(THIS.smtp,new zs4.type.boolean({name:'configured',required:true,default:false,}));
  zs4.type.property(THIS.smtp,new zs4.type.string({name:'user',required:true,}));
  zs4.type.property(THIS.smtp,new zs4.type.string({name:'password',required:true,}));
  zs4.type.property(THIS.smtp,new zs4.type.string({name:'host',required:true,}));
  zs4.type.property(THIS.smtp,new zs4.type.integer({name:'port',required:true,default:587}));
  zs4.type.property(THIS.smtp,new zs4.type.boolean({name:'ssl',required:true,default:false,}));

  zs4.type.property(THIS.smtp,new zs4.type.object({name:'message',required:true,nostore:true,api:true,}));
  //zs4.type.property(THIS.message,new zs4.type.email({name:'from',required:true,}));
  zs4.type.property(THIS.smtp.message,new zs4.type.email({name:'to',required:true,}));
  zs4.type.property(THIS.smtp.message,new zs4.type.string({name:'subject',required:true,}));
  zs4.type.property(THIS.smtp.message,new zs4.type.text({name:'text',required:true,}));

  THIS.smtp.message._.transform = (function(req,cb){
    zs4.console.log('message.transform('+JSON.stringify(req.input)+')');
    this._.value.from = this._.value.to = this._.value.subject = this._.value.text = '';

    if (!zs4.is.email(THIS.smtp._.value.user)
    ||  !zs4.is.email(req.input.to)
    ||  !zs4.is.string(req.input.subject)
    ||  !zs4.is.string(req.input.text)
    ||  req.input.subject.length == 0
    ||  req.input.text.length == 0
    ){
      this._.reply(req);
      cb();
    }
    else{
      var message = {
        from:THIS.smtp._.value.user,
        to:req.input.to,
        subject:req.input.subject,
        text:req.input.text,
      };
      zs4.THIS.zs4.email.send(message,function(){
        this._.reply(req);
        cb();
      });
    }

  }).bind(THIS.smtp.message);

  THIS.send = function(message,cb){
    if (!this._.value.smtp.configured){

    }
    if (this.smtpServer == null){
      this.smtpServer = emailjs.server.connect({
         user:    this._.value.smtp.user,
         password: this._.value.smtp.password,
         host:    this._.value.smtp.host,
         port:    this._.value.smtp.port,
         ssl:     this._.value.smtp.ssl,
      });
    }
    zs4.console.log('inside email.send()');
    zs4.console.log(message);
    this.smtpServer.send(message, function(err,abc) {
        if(err){
            console.log(err);
            if (cb)cb(new zs4.error({text:'smtp send failed',data:err}));
        }
        else{
          if (cb)cb(new zs4.done({text:'email sent.'}));
        }
    });
  };

  //zs4.console.log(THIS.smtp.message._.zs4Parent());
};
