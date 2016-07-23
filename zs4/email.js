var zs4 = require('./www/zs4');
var emailjs = require('emailjs');

var email = exports;

email.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'email',required:true,}));
  email.THIS = parent.email;

  zs4.type.property(parent.email,new zs4.type.object({name:'smtp',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'user',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'password',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.string({name:'host',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.integer({name:'port',required:true,}));
  zs4.type.property(parent.email.smtp,new zs4.type.boolean({name:'ssl',required:true,default:false,}));

  zs4.type.property(parent.email,new zs4.type.object({name:'message',required:true,nostore:true,noget:true,
    onchange:function(req,cb){
      function clearValues(){this.value.from = this.value.to = this.value.subject = this.value.text = '';};

      if (zs4.is.email(this.value.from)
      && zs4.is.email(this.value.to)
      && this.value.subject.length > 0
      && this.value.text.length > 0
      ){
        zs4.THIS.zs4.email.send(this.value,function(){
          clearValues();
          cb();
        });
        return;
      }
      else{
        clearValues();
      }

    },

  }));
  zs4.type.property(parent.email.message,new zs4.type.email({name:'from',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.email({name:'to',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.string({name:'subject',required:true,}));
  zs4.type.property(parent.email.message,new zs4.type.string({name:'text',required:true,}));

  parent.email.send = function(message,cb){
    if (this.smtpServer == null){
      this.smtpServer = emailjs.server.connect({
         user:    this.value.smtp.user,
         password: this.value.smtp.password,
         host:    this.value.smtp.host,
         port:    this.value.smtp.port,
         ssl:     this.value.smtp.ssl,
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
