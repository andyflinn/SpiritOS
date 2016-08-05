var zs4 = require('./static/zs4');
var emailjs = require('emailjs');

var email = exports;

email.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'email',required:true,}));
  email.THIS = parent.email;

  zs4.type.property(parent.email,new zs4.type.object({name:'smtp',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'user',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'password',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'host',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.integer({name:'port',required:true,default:587}));
  zs4.type.property(parent.email.smtp,new zs4.type.boolean({name:'ssl',required:true,default:false,}));

  zs4.type.property(parent.email,new zs4.type.object({name:'message',required:true,nostore:true,}));
  zs4.type.property(parent.email.message,new zs4.type.email({name:'from',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.email({name:'to',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.string({name:'subject',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.text({name:'text',required:true,}));

  parent.email.message._.transform = (function(args,cb){
    zs4.console.log('message.transform('+JSON.stringify(args.input)+')');
    this._.value.from = this._.value.to = this._.value.subject = this._.value.text = '';

    if (!zs4.is.email(args.input.from)
    ||  !zs4.is.email(args.input.to)
    ||  !zs4.is.string(args.input.subject)
    ||  !zs4.is.string(args.input.text)
    ||  args.input.subject.length == 0
    ||  args.input.text.length == 0
    ){
      cb();
    }
    else{
      zs4.THIS.zs4.email.send(args.input,function(){
        cb();
      });
    }

  }).bind(parent.email.message);

  parent.email.send = function(message,cb){
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

};
