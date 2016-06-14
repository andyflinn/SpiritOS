var express = require('express');
var passwordless = require('passwordless');
var MongoStore = require('passwordless-mongostore');
var email   = require("emailjs");

var zs4 = require('./zs4utils');
var zs4api = require('./zs4api');
var zs4db = require('./zs4mongoose');

var smtpServer  = email.server.connect({
   user:    process.env.ZS4_SMTP_USER,
   password: process.env.ZS4_SMTP_PASS,
   host:    process.env.ZS4_SMTP_SERVER,
   port:    process.env.ZS4_SMTP_PORT,
   ssl:     false
});
var loginDb = process.env.ZS4_TOKEN_DB;
passwordless.init(new MongoStore(loginDb));
passwordless.addDelivery(
    function(token, uid, recipient, callback) {
        console.log('inside email delivert!!!!!!!!!!!');
        var host = process.env.ZS4_HOST;
        var port = parseInt(process.env.ZS4_PORT);
        if (port != 443) host += (':' + port);
        smtpServer.send({
            text:    'Hello!\nAccess your account here: https://'
            + host + '/zs4/token?token=' + token + '&uid='
            + encodeURIComponent(uid),
            from:    process.env.ZS4_SMTP_USER,
            to:      recipient,
            subject: 'Token for ' + process.env.ZS4_HOST
        }, function(err, message) {
            if(err) {
                console.log(err);
            }
            callback(err);
        });
});

var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: process.env.ZS4_ADMIN_EMAIL,
};


router.get('/zs4/token', passwordless.acceptToken(),
    function(req, res) {
        res.redirect('/');
});

router.get('/', function(req, res) {
  zs4.console.log('req.path = '+req.path);

  function html(path){
    var html = '<html>\n';
      html += '<head>\n';
        html += '<base href="' + path + '">';
        html += '<link rel="stylesheet" href="/css/style.css">\n';
        html += '<script src="/js/zs4-browser.js"></script>\n';
        html += '<script src="/js/zs4-shared.js"></script>\n';
        html += '<script>shared.install(shared,zs4);</script>'
      html += '</head>\n';
      if (req.path==='/'){
        html += '<body onload="zs4.ui.initialize(document.body)">';

        html += '</body>';
      }
    html += '</html>';
    zs4.console.log(html);
    return(html);
  };

  res.write(html('/'));
  res.end();
});


////////////////////////////////////////////
// POST responders

router.post('/zs4/post', function(req, res){
  zs4api.respond(req, res);
});

router.post('/zs4/token',
    passwordless.requestToken(
        // Turn the email address into an user ID
        function(email, delivery, callback, req) {

          zs4db.model.User.findOne({ 'email': email }, function (err, user) {
            if (err || user == null || user.email != email ){
              callback(null, null);
            }else{
              callback(null, email);
            }
          });
        },{failureRedirect:'/zs4/failure'}),
    function(req, res) {
      //res.setHeader('Content-Type', 'application/json');
      //res.send(JSON.stringify({msg:'Token sent to '+ zs4.getRequestUser().email}));
      res.send({msg:'Token sent to '+req.body.user+'.'});
});

router.get('/zs4/logout', passwordless.logout(),
    function(req, res) {
        res.redirect('/');
});

router.get('/zs4/failure',
    function(req, res) {
        res.send({type:'error'});
});

module.exports = router;
