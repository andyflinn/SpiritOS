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
  PASSPORT._.loginHandler = function(accessToken, refreshToken, profile, cb) {
    console.log('PASSPORT PROFILE FUNCTION returned');
    console.log(zs4.json.stringify(profile));
    // In this example, the user's Facebook profile is supplied as the user
    // record.  In a production-quality application, the Facebook profile should
    // be associated with a user record in the application's database, which
    // allows for account linking and authentication with other identity
    // providers.
    return cb(null, profile);
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
          clientSecret: PASSPORT[strat].secret._.value,
          //callbackURL: zs4.THIS.zs4.express.getHostURL(),
          callbackURL: 'http://'+zs4.THIS.zs4.express.host._.value+'/zs4.passport.'+strat+'.return',
          profileFields: ['id', 'displayName', 'email', 'birthday', 'friends', 'first_name', 'last_name', 'middle_name', 'gender', 'link'],
        },
        PASSPORT._.loginHandler
      ));


      console.log('PASSPORT.'+strat+'._.Options = ',PASSPORT[strat]._.Options);
      app.get('/'+PASSPORT[strat]._.path + '.login',
              PP.authenticate(strat,PASSPORT[strat]._.Options,PASSPORT[strat]._.Options),
              function(req, res) {
                res.redirect('/');
              }
      );

      app.get('/'+PASSPORT[strat]._.path + '.return',
              PP.authenticate(strat,{failureRedirect: '/error'}),
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
  }

  createStrategy(
    'facebook',
    require('passport-facebook').Strategy,
    {
      authType: 'rerequest',
      scope: ['user_friends', 'email', 'public_profile'],
    }
  );
}
