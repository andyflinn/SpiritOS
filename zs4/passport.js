'use strict';

var zs4 = require('./js');
var PP = require('passport');
var debug = require('debug')('zs4passport');

var passport = exports;

passport.schema = function(parent){
  parent._.property(new passport.create());
};

passport.create = function(){
  var PASSPORT = this;

  zs4.type.object.call(PASSPORT,new Object({name:'passport',flags:'authgetpublic authsetself',}));

  PASSPORT._.create = passport.create;
  PASSPORT._.extractUserObject = function(profile){

    var log = 'PASSPORT._.extractUserObject: ';

    if (!zs4.is.object(profile)) {
      debug(log+'ERROR: profile is not an object');
      return null;
    }
    if (!zs4.is.array(profile.emails)) {
      debug(log+'ERROR: profile.emails is not an array');
      return null;
    }
    if (!zs4.is.object(profile.emails[0])) {
      debug(log+'ERROR: profile.emails[0] is not an object');
      return null;
    }
    if (!zs4.is.email(profile.emails[0].value)) {
      debug(log+'ERROR: profile.emails[0].value is not an email address');
      return null;
    }

    debug(log+profile.emails[0].value);
    var ret = new Object({
      email:profile.emails[0].value,
      display:profile.displayName,
      provider:profile.provider,
      id:profile.id,
    });

    return ret;
  };
  PASSPORT._.installToExpressApp = function(app){
    app.use(PP.initialize());

    PASSPORT._.installStrategy(app,'facebook');
    PASSPORT._.installStrategy(app,'google');
  };
  PASSPORT._.installStrategy = function(app,strategy){
    //var strategy = new String(strat);
    if (PASSPORT[strategy].configured._.value != true)return;

    PASSPORT[strategy]._.loginQueue = new Array();

    PASSPORT[strategy]._.loginHandler = function(accessToken, refreshToken, profile, cb) {
      //debug('STRATEGY is still '+strategy);
      //debug('PASSPORT PROFILE FUNCTION returned',accessToken,refreshToken);
      //debug(zs4.json.stringify(profile));
      var po = PASSPORT._.extractUserObject(profile);
      if (po == null) return cb(null, profile);
      //debug(po);

      var input = new Object({zs4:{type:{user:{method:{getone:{item:'zs4.email',eq:po.email}}}}}});
      //debug('PASSPORT search user req',zs4.json.stringify(input));
      var req = new zs4.request();
      req.call({
        path:'zs4.type.user.method.getone',
        input:{item:'zs4.email',eq:po.email},
        root:true,
      },
      function(callback){
        if (callback.error != null){
          //debug('zs4.type.user.method.getone() failed: ',callback);
          var USER = require('./user');
          var nu = new USER.create();
          nu.zs4.email._.value = po.email;
          nu.zs4.head.title._.value = po.display;

          nu.social[strategy].display._.value = po.display;
          nu.social[strategy].id._.value = po.id;
          nu.social[strategy].email._.value = po.email;
          nu.social[strategy].date._.value = Date.now();

          var data = nu._.store();
          //debug('NEW USER REQUEST:',zs4.json.stringify(data));
          req.call({
            path:'zs4.type.user.method.new',
            input:data,
            root:true,
          },
          function(callback){
            if (callback.error != null){
              var err = 'zs4.type.user.method.new() failed: ' + callback.error;
              debug(err);
              return cb(err, null);
            }
            else {
              //debug('zs4.type.user.method.new() SUCCESS: ',callback);
              req.tokenCreate({iss:PASSPORT._.path,scope:callback.result,});
              var ret = new Object({token:req.request.token,id:callback.result,time:Date.now(),});
              PASSPORT[strategy]._.loginQueue.push(ret);
              return cb(null,ret);
            }
          });
        }
        else {
          //debug('zs4.type.user.method.getone() SUCCESS: ',callback);
          req.tokenCreate({iss:PASSPORT._.path,scope:callback.result,});

          var input = new Object({social:{}});
          input.social[strategy] = new Object({
            display:po.display,
            id:po.id,
            email:po.email,
            date:Date.now(),
          })
          req.call({
            path:callback.result,
            input:input,
            root:true,
          },
          function(){
            var ret = new Object({token:req.request.token,id:callback.result,time:Date.now(),});
            //debug(strategy);
            PASSPORT[strategy]._.loginQueue.push(ret);
            return cb(null, ret);
          });

        }

      });
    };

    PP.use(new PASSPORT[strategy]._.Strategy({
        clientID: PASSPORT[strategy].id._.value,
        clientId: PASSPORT[strategy].id._.value,
        clientSecret: PASSPORT[strategy].secret._.value,
        //callbackURL: zs4.THIS.zs4.express.getHostURL(),
        callbackURL: 'http://'+zs4.THIS.zs4.express.host._.value+'/zs4.passport.'+strategy+'.return',
        returnURL: 'http://'+zs4.THIS.zs4.express.host._.value+'/zs4.passport.'+strategy+'.return',
        profileFields: ['id', 'displayName', 'email', 'birthday', 'friends', 'first_name', 'last_name', 'middle_name', 'gender', 'link'],
      },
      PASSPORT[strategy]._.loginHandler
    )) ;


    debug('PASSPORT.'+strategy+'._.Options = ',PASSPORT[strategy]._.Options);
    app.get('/'+PASSPORT[strategy]._.path + '.login',
            PP.authenticate(strategy,PASSPORT[strategy]._.Options,PASSPORT[strategy]._.Options),
            function(req, res) {
              res.redirect('/');
            }
    );

    var redir = '/zs4.passport.'+strategy+'.success';
    debug('REDIRECT = '+redir);
    app.get('/'+PASSPORT[strategy]._.path + '.return',
            PP.authenticate(strategy,PASSPORT[strategy]._.Options),
            function(req, res) {
              // Successful authentication, redirect home.
              var shift = PASSPORT[strategy]._.loginQueue.shift();
              debug('time elapsed: '+(Date.now()-shift.time));
              debug('SESSION-esque data: ',zs4.json.textify(shift));
              res.redirect(redir+'?token='+shift.token+'&id='+shift.id);
            }
    );

    debug('EXPRESS/PASSPORT route for '+strategy+' configured:'+PASSPORT[strategy]._.path + '.login');

  };

  function createStrategy(name,strat,opt){

    PASSPORT._.property(new zs4.type.object({name:name,flags:'authgetpublic authsetself',}));
    PASSPORT[name]._.property(new zs4.type.boolean({name:'configured',flags:'authsetself quickupdate',default:false,}));
    PASSPORT[name]._.property(new zs4.type.string({name:'id',flags:'authsetself quickupdate',}));
    PASSPORT[name]._.property(new zs4.type.string({name:'secret',flags:'authsetself quickupdate',}));
    PASSPORT[name]._.property(new zs4.type.object({name:'success',flags:'api authpublic authsetself quickupdate',}));

    PASSPORT[name]._.Strategy = strat;
    PASSPORT[name]._.Options = opt;
    PASSPORT[name]._.Options.failureRedirect = '/error';
    PASSPORT[name]._.Options.session = false;

  }

  createStrategy(
    'facebook',
    require('passport-facebook').Strategy,
    {
      authType: 'rerequest',
      scope: ['user_friends', 'email', 'public_profile'],
    }
  );
  createStrategy(
    'google',
    require('passport-google-auth').Strategy,
    {
    }
  );


}
