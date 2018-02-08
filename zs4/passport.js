'use strict';

var zs4 = require('./static/zs4');
var PP = require('passport');

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
      console.log(log+'ERROR: profile is not an object');
      return null;
    }
    if (!zs4.is.array(profile.emails)) {
      console.log(log+'ERROR: profile.emails is not an array');
      return null;
    }
    if (!zs4.is.object(profile.emails[0])) {
      console.log(log+'ERROR: profile.emails[0] is not an object');
      return null;
    }
    if (!zs4.is.email(profile.emails[0].value)) {
      console.log(log+'ERROR: profile.emails[0].value is not an email address');
      return null;
    }

    console.log(log+profile.emails[0].value);
    var ret = new Object({
      email:profile.emails[0].value,
      display:profile.displayName,
      provider:profile.provider,
      id:profile.id,
    });

    return ret;
  };
  PASSPORT._.loginHandler = function(accessToken, refreshToken, profile, cb) {
    console.log('PASSPORT PROFILE FUNCTION returned');
    console.log(zs4.json.stringify(profile));
    var po = PASSPORT._.extractUserObject(profile);
    if (po == null) return cb(null, profile);
    console.log(po);

    var input = new Object({zs4:{type:{user:{method:{getone:{item:'zs4.email',eq:po.email}}}}}});
    console.log('PASSPORT search user req',zs4.json.stringify(input));
    var req = new zs4.request();
    req.call({
      path:'zs4.type.user.method.getone',
      input:{item:'zs4.email',eq:po.email},
      root:true,
    },
    function(callback){
      if (callback.error != null){
        console.log('zs4.type.user.method.getone() failed: ',callback);
        var USER = require('./user');
        var nu = new USER.create();
        nu.zs4.email._.value = po.email;
        nu.zs4.head.title._.value = po.display;
        var validProvider = false;
        if (zs4.is.string(po.provider)&&po.provided != ''&&zs4.is.type(nu.social[po.provider]))
          validProvider = true;

        if (validProvider){
          nu.social[po.provider].display._.value = po.display;
          nu.social[po.provider].id._.value = po.id;
          nu.social[po.provider].email._.value = po.email;
          nu.social[po.provider].date._.value = Date.now();
        }
        var data = nu._.store();
        console.log('NEW USER REQUEST:',zs4.json.stringify(data));
        req.call({
          path:'zs4.type.user.method.new',
          input:data,
          root:true,
        },
        function(callback){
          if (callback.error != null){
            var err = 'zs4.type.user.method.new() failed: ' + callback.error;
            console.log(err);
            return cb(err, null);
          }
          else {
            console.log('zs4.type.user.method.new() SUCCESS: ',callback);
            req.tokenCreate({iss:PASSPORT._.path,scope:callback.result,});
            return cb(null, req.request.token);
          }
        });
      }
      else {
        console.log('zs4.type.user.method.getone() SUCCESS: ',callback);
        req.tokenCreate({iss:PASSPORT._.path,scope:callback.result,});

        if (validProvider){
          var input = new Object({social:{}});
          input.social[po.provider] = new Object({
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
            return cb(null, req.request.token);
          });
        }
        else {
          return cb(null, req.request.token);
        }
      }

    });
  };
  PASSPORT._.installToExpressApp = function(app){
    app.use(PP.initialize());
    PP.serializeUser(function(user, done) {
      done(null, user);
    });

    PP.deserializeUser(function(user, done) {
      done(null, user);
    });

    for (var strat in PASSPORT){
      if (!zs4.is.type(PASSPORT[strat]))continue;
      if (PASSPORT[strat].configured._.value != true)continue;

      PP.use(new PASSPORT[strat]._.Strategy({
          clientID: PASSPORT[strat].id._.value,
          clientId: PASSPORT[strat].id._.value,
          clientSecret: PASSPORT[strat].secret._.value,
          //callbackURL: zs4.THIS.zs4.express.getHostURL(),
          callbackURL: 'http://'+zs4.THIS.zs4.express.host._.value+'/zs4.passport.'+strat+'.return',
          returnURL: 'http://'+zs4.THIS.zs4.express.host._.value+'/zs4.passport.'+strat+'.return',
          profileFields: ['id', 'displayName', 'email', 'birthday', 'friends', 'first_name', 'last_name', 'middle_name', 'gender', 'link'],
        },
        PASSPORT._.loginHandler
      )) ;


      console.log('PASSPORT.'+strat+'._.Options = ',PASSPORT[strat]._.Options);
      app.get('/'+PASSPORT[strat]._.path + '.login',
              PP.authenticate(strat,PASSPORT[strat]._.Options,PASSPORT[strat]._.Options),
              function(req, res) {
                res.redirect('/');
              }
      );

      app.get('/'+PASSPORT[strat]._.path + '.return',
              PP.authenticate(strat,PASSPORT[strat]._.Options),
              function(req, res) {
                // Successful authentication, redirect home.
                res.redirect('/');
              }
      );

      //app.post(pp[strat]._.path + '.login',passport.authenticate('facebook'));
      console.log('EXPRESS/PASSPORT route for '+strat+' configured:'+PASSPORT[strat]._.path + '.login');

      //app.get(pp[strat]._.path + '.return',
      //  passport.authenticate(strat, { failureRedirect: '/login' }),
    }

  };

  function createStrategy(name,strat,opt){


    PASSPORT._.property(new zs4.type.object({name:name,flags:'authgetpublic authsetself',}));
    PASSPORT[name]._.property(new zs4.type.boolean({name:'configured',flags:'authsetself quickupdate',default:false,}));
    PASSPORT[name]._.property(new zs4.type.string({name:'id',flags:'authsetself quickupdate',}));
    PASSPORT[name]._.property(new zs4.type.string({name:'secret',flags:'authsetself quickupdate',}));
    PASSPORT[name]._.property(new zs4.type.object({name:'login',flags:'api authpublic authsetself quickupdate',}));
    PASSPORT[name]._.property(new zs4.type.object({name:'return',flags:'api authpublic authsetself quickupdate',}));

    PASSPORT[name]._.Strategy = strat;
    PASSPORT[name]._.Options = opt;
    PASSPORT[name]._.Options.failureRedirect = '/error';
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
