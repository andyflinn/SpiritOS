var zs4 = require('./static/zs4');
var emailjs = require('emailjs');

var email = exports;

email.lastaddr = Date.now();

email.schema = function(parent){
  parent._.property(new email.create({name:'email',flags:'authsetself',}));
};

email.create = function(input){

  var THIS = this;
  if (!zs4.is.object(input))input = new Object({name:'email',flags:'authsetself',});
  zs4.type.object.call(this,input);
  THIS._.create = email.create;

  var nuaddr = (zs4.integer.to.name(email.lastaddr++)+'@zs4.zs4');

  THIS._.property(new zs4.type.object({name:'smtp',flags:'authsetself',}));
  THIS.smtp._.sortDefault = THIS.smtp._.sortNot;
  THIS.smtp._.property(new zs4.type.boolean({name:'configured',flags:'authsetself quickupdate',default:false,}));
  THIS.smtp._.property(new zs4.type.string({name:'user',flags:'index unique authsetself quickupdate',default:nuaddr}));
  THIS.smtp._.property(new zs4.type.string({name:'password',flags:'authsetself quickupdate',}));
  THIS.smtp._.property(new zs4.type.string({name:'host',flags:'authsetself quickupdate',}));
  THIS.smtp._.property(new zs4.type.integer({name:'port',flags:'authsetself quickupdate',}));
  THIS.smtp._.property(new zs4.type.boolean({name:'ssl',flags:'authsetself quickupdate',default:false,}));

  THIS._.property(new zs4.type.object({name:'message',flags:'api nostore noprune authsetself',}));
  THIS.message._.sortDefault = THIS.message._.sortNot;
  THIS.message._.property(new zs4.type.email({name:'to',flags:'required noprune apiarg',}));
  THIS.message._.property(new zs4.type.string({name:'subject',flags:'required noprune apiarg',minlength:1,}));
  THIS.message._.property(new zs4.type.text({name:'text',flags:'required noprune apiarg',minlength:1,}));

  THIS.message._.transform = (function(req,cb){
    var MESSAGE = this;

    req.setScope(this);
    this._.transformInternal(req);
    this.to._.value = this.subject._.value = this.text._.value = '';

    function get(){
      MESSAGE._.get(req);

      req.setScope(MESSAGE.to);
      MESSAGE.to._.get(req,MESSAGE);

      req.setScope(MESSAGE.subject);
      MESSAGE.subject._.get(req,MESSAGE);

      req.setScope(MESSAGE.text);
      MESSAGE.text._.get(req,MESSAGE);

      cb();
      return;
    }

    if (!(req.flags.value & req.flags.authset)) return get();

    if (req.input==null) return get();

    if (!zs4.is.email(THIS.smtp.user._.value)
    ||  !zs4.is.email(req.input.to)
    ||  !zs4.is.string(req.input.subject)
    ||  !zs4.is.string(req.input.text)
    ||  req.input.subject.length == 0
    ||  req.input.text.length == 0
    ){
      req.error(this,'invalid message');
      return get();
    }
    else{
      console.log(this._.path+'.transform()');
      var message = {
        from:THIS.smtp.user._.value,
        to:req.input.to,
        subject:req.input.subject,
        text:req.input.text,
      };
      if (!THIS.smtp.configured._.value){
        req.error(this,'smtp not configured');
        return get();
      }
      if (THIS.smtpServer == null){
        THIS.smtpServer = emailjs.server.connect({
           user:    THIS.smtp.user._.value,
           password: THIS.smtp.password._.value,
           host:    THIS.smtp.host._.value,
           port:    THIS.smtp.port._.value,
           ssl:     THIS.smtp.ssl._.value,
        });
      }
      console.log(message);
      var msg = this;
      THIS.smtpServer.send(message, function(err,abc) {
          if(err){
              console.log('SENDMAIL ERROR: '+err);
              req.error(msg,{text:'smtp send failed',data:err});
              return get();
          }
          else{
            console.log('message sent to '+req.input.to+', subject: \''+req.input.subject+'\'');
            req.result(msg,'message sent to '+req.input.to+', subject: \''+req.input.subject+'\'');
            return get();
          }
      });
    }

  }).bind(THIS.message);


};
