var express = require('express');
//var passwordless = require('passwordless');
//var MongoStore = require('passwordless-mongostore');
//var email   = require("emailjs");

var zs4 = require('./zs4utils');
var zs4api = require('./zs4api');
//var zs4db = require('./zs4mongoose');

var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: zs4.env.ZS4_ADMIN_EMAIL,
};

router.use('/zs4/login/', require('./login/zs4login'));

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

module.exports = router;
