var express = require('express');
var passport = require('passport');
var zs4db = require('./zs4mongoose');
var router = express.Router();

var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_CALLBACK_URL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback'
};

/* GET home page. */
router.get('/', function(req, res, next) {
  //zs4db.dumpAllUsers();
  if (req.path=='/')res.render('layout', { title: 'zs4', env: env });
  else next();
});

router.get('/login', function(req, res){
  console.log('try to render login page');
  res.render('login_auth0', { title: 'zs4 login', env: env });
});

router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

router.get('/callback',
passport.authenticate('auth0', {
  failureRedirect: '/'
}),
function(req, res) {
  zs4db.login(req,res);
  res.redirect('/');
});

module.exports = router;
