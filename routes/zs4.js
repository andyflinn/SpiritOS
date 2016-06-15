var express = require('express');
var passwordless = require('passwordless');
var MongoStore = require('passwordless-mongostore');
var email   = require("emailjs");

var zs4 = require('./zs4utils');
var zs4api = require('./zs4api');
var zs4db = require('./zs4mongoose');

var smtpServer  = email.server.connect({
   user:    zs4.env.ZS4_SMTP_USER,
   password: zs4.env.ZS4_SMTP_PASS,
   host:    zs4.env.ZS4_SMTP_SERVER,
   port:    zs4.env.ZS4_SMTP_PORT,
   ssl:     false
});
var loginDb = zs4.env.ZS4_TOKEN_DB;
passwordless.init(new MongoStore(loginDb));
passwordless.addDelivery(
    function(token, uid, recipient, callback) {
        zs4.console.log('inside email delivery!');
        var host = zs4.env.ZS4_HOST;
        var port = parseInt(zs4.env.ZS4_PORT);
        if (port != 443) host += (':' + port);
        smtpServer.send({
            text:    'Hello!\nAccess your account here: https://'
            + host + '/zs4/token?token=' + token + '&uid='
            + encodeURIComponent(uid),
            from:    zs4.env.ZS4_SMTP_USER,
            to:      recipient,
            subject: 'Token for ' + zs4.env.ZS4_HOST
        }, function(err, message) {
            if(err) {
                console.log(err);
            }
            callback(err);
        });
});

var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: zs4.env.ZS4_ADMIN_EMAIL,
};


router.get('/zs4/token', passwordless.acceptToken(),
    function(req, res) {

      zs4db.model.User.findOne({ email:req.user }, function(err, user) {
        if (!err && user){
          user.stats.tokens_used++;
          user.save();
        }
      });

      res.redirect('/');
});

router.get('/zs4/logout', passwordless.logout(),
    function(req, res) {
        res.redirect('/');
});

router.get('/zs4/failure',
    function(req, res) {
        if (req.zs4 != null && zs4.is.error(req.zs4)) res.send(req.zs4);
        else res.send(zs4.create.error('failure occurred on server side'));
});


router.get('*', function(req, res) {
  zs4.console.log('req.path = '+req.path);

  function html(path){
    var html = '<html>\n';
      html += ' <head>\n';
        html += '  <base href="' + path + '">\n';
        html += '  <link rel="stylesheet" href="/css/style.css">\n';
        html += '  <script>var exports = {};</script>\n'
        html += '  <script src="/js/zs4-shared.js"></script>\n';
        html += '  <script src="/js/zs4-browser.js"></script>\n';
      html += ' </head>\n';
      if (req.path==='/'){
        html += ' <body onload="zs4.ui.initialize(document.body)">\n';

        html += ' </body>\n';
      }
    html += '</html>\n';
    return(html);
  };

  res.write(html('/'));
  res.end();
});


////////////////////////////////////////////
// POST responders

router.post('/zs4/api', function(req, res){
  req.zs4 = {};
  zs4api.respond(req, res);
});

router.post('/zs4/token',
    passwordless.requestToken(
        // Turn the email address into an user ID
        function(email, delivery, callback, req) {

          zs4db.model.User.findOne({ 'email': email }, function (err, user) {
            if (err || user == null || user.email != email ){
              req.zs4 = zs4.create.error('user '+email+' not found.');

              callback(null, null);

            }else{
              user.stats.tokens_requested++; user.save();
              req.zs4 = zs4.create.done('token sent to '+email+'.');
              callback(null, email);
            }
          });
        },{failureRedirect:'/zs4/failure'}),
    function(req, res) {
      if (req.zs4 != null && zs4.is.done(req.zs4)) res.send(req.zs4);
      else res.send(zs4.create.done('token sent to your inbox'));
});

module.exports = router;
