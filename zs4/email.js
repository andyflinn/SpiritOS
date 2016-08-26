var zs4 = require('./static/zs4');
var emailjs = require('emailjs');

var email = exports;

email.schema = function(parent){
  parent._.property(new email.create({name:'email',required:true,authGet:['zs4.self'],}));
};

email.create = function(input){

  var THIS = this;
  if (!zs4.is.object(input))input = new Object({name:'email',flags:'required',authGet:['zs4.self'],});
  zs4.type.object.call(this,input);
  THIS._.create = email.create;

  THIS._.property(new zs4.type.object({name:'smtp',flags:'required api authsetself',}));
  THIS.smtp._.property(new zs4.type.boolean({name:'configured',flags:'required authsetself',default:false,}));
  THIS.smtp._.property(new zs4.type.string({name:'user',flags:'required index unique authsetself',}));
  THIS.smtp._.property(new zs4.type.string({name:'password',flags:'required authsetself',}));
  THIS.smtp._.property(new zs4.type.string({name:'host',flags:'required authsetself',}));
  THIS.smtp._.property(new zs4.type.integer({name:'port',flags:'required authsetself',}));
  THIS.smtp._.property(new zs4.type.boolean({name:'ssl',flags:'required authsetself',default:false,}));

  THIS._.property(new zs4.type.object({name:'message',flags:'required api nostore noprune authsetself',}));

  THIS.message._.property(new zs4.type.email({name:'to',flags:'required noprune authsetself',}));
  THIS.message._.property(new zs4.type.string({name:'subject',flags:'required noprune authsetself',}));
  THIS.message._.property(new zs4.type.text({name:'text',flags:'required noprune authsetself',}));

  THIS.message._.transform = (function(req,cb){
    var MESSAGE = this;

    req.setScope(this);
    this._.transformInternal(req);
    this._.value.from = this._.value.to = this._.value.subject = this._.value.text = '';

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

    if (!zs4.is.email(THIS.smtp._.value.user)
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
        from:THIS.smtp._.value.user,
        to:req.input.to,
        subject:req.input.subject,
        text:req.input.text,
      };
      if (!THIS._.value.smtp.configured){
        req.error(this,'smtp not configured');
        return get();
      }
      if (THIS.smtpServer == null){
        THIS.smtpServer = emailjs.server.connect({
           user:    THIS._.value.smtp.user,
           password: THIS._.value.smtp.password,
           host:    THIS._.value.smtp.host,
           port:    THIS._.value.smtp.port,
           ssl:     THIS._.value.smtp.ssl,
        });
      }
      console.log(message);
      var msg = this;
      THIS.smtpServer.send(message, function(err,abc) {
          if(err){
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
