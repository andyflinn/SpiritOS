var express = require('express');
var passport = require('passport');
var zs4 = require('./zs4utils');
var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: process.env.ZS4_ADMIN_EMAIL,
};

router.post('/', function(req, res){
  console.log("router.post('/zs4request', function(req, res)");

  var response = zs4.createResponseFrame(req,res);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(response));
});


module.exports = router;
