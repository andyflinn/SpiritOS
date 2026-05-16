'use strict';

var zs4 = require('./js/js');

var debug = require('debug')('zs4express');

var xpress = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var fs = require('fs');

var express = exports;

express.zs4 = zs4;

express.html = function(req,res){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <title>'+req.path+' ERROR</title>\n';
      html += '  <base href="' + req.path + '">\n';
    html += ' </head>\n';
    if (true){
      html += ' <body>\n';
      html += '<a href=\"/\">Go to homepage</a>\n'
      html += ' </body>\n';
    }
  html += '</html>\n';
  return(html);
}

function setLocalhost(req, zs4req){
  if (req.hostname == 'localhost' || req.hostname == '127.0.0.1'){
    zs4req.request.localhost = true;
    // localhost is always root — set scope and a token marker for the client
    if (!zs4.is.object(zs4req.request.payload)){
      zs4req.request.token = 'localhost-root-token';
      zs4req.request.payload = {iss:'local', scope:'', iat:Date.now(), exp:Date.now()+86400000};
    }
  }
}

express.getFunction = function (req, res) {
  debug('GET REQUEST: '+req.path);

  var zs4req = new zs4.request();
  zs4req.request.node = null;
  setLocalhost(req, zs4req);

  var input = zs4req.resolveInputPath(req.path);
  input.getHTML = new Object();
  input.getHTML.query = req.query;

  zs4req.process(function(ret){
    var r = zs4req.request.html;
    if (r == null || r.length == 0){
      r = express.html(req,res);
      debug('ZS4 FAILED TO PRODUCE HTML');
    }
    res.write(r);
    res.end();
  });
};

express.postFunction = function (req, res) {
  var zs4req = new zs4.request(req.body);
  zs4req.request.node = null;
  setLocalhost(req, zs4req);

  zs4req.process(function(ret){
    if (zs4req.html==true){
      var r = zs4req.request.html;
      if (r == null || r.length == 0) r = express.html(req,res);
      res.write(r);
      res.end();
    }
    else {
      var r = zs4req.getReply();
      res.send(r);
    }
  });
};

express.running = false;

express.schema = function(parent){
  var THIS = express.THIS = new zs4.type.object({name:'express',flags:'nosort'});
  parent._.property(THIS);

  THIS._.property(new zs4.type.string({name:'host',flags:'quickupdate',default:'localhost',}));
  THIS._.property(new zs4.type.integer({name:'port',flags:'quickupdate',default:3000,}));
  THIS._.property(new zs4.type.object({name:'run',flags:'required nostore noget api'}));
  THIS.run._.transform = (function(req,cb){
    req.setScope(this);
    if (!(req.flags.value & req.flags.authset)){
      req.error(THIS,'not authorized');
      this._.get(req); cb(); return;
    }
    if (zs4.is.object(req.input)){
      THIS.start();
    }
    this._.get(req); cb(); return;
  }).bind(THIS.run);

  THIS.start = function(){
    debug('EXPRESS-START()');
    if (express.running)return;
    debug('EXPRESS-not running yet');

    var app = xpress();

    app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
    app.use(logger('dev'));
    app.use(bodyParser.json({limit:'50mb'}));
    app.use(bodyParser.urlencoded({ extended: false, limit:'50mb' }));
    app.use(xpress.static(path.join(__dirname, 'static'),{index:'/'}));
    app.use('/media', xpress.static(path.join(process.cwd(), 'media')));
    app.use('/apps', xpress.static(path.join(process.cwd(), 'apps')));

    for (var i = 0 ; i < zs4.plugin.static.length ; i++){
      app.use(xpress.static(path.join(__dirname, zs4.plugin.static[i])));
    }

    app.get('*',function(req,res,next){
      if (req.hostname != 'localhost' && req.get('X-Forwarded-Proto') == 'http'){
        return res.redirect(THIS.getSecureUrl() + req.url);
      }
      next();
    });

    app.get('/*',express.getFunction);
    app.post('/*',express.postFunction);

    var port = parseInt(process.env.PORT) || this.port._.value;
    zs4.boot.run(function(){
      function runHttp(){
        var httpServer = http.createServer(app);
        httpServer.listen(port,function(err){
          if (err!=null){
            debug('failed to start server: '+err);
          }
          else {
            express.running = true;
            debug('zs4 listening on port '+port+'!');
          }
        });
      };
      return runHttp();
    });
  };

  THIS.getHostURL = function(req){
    var port = '';
    if (THIS.port._.value != 80) port = ':'+THIS.port._.value;
    if (req != null && req.request.localhost == true){
      return ('http://localhost'+port);
    }
    return ('http://'+THIS.host._.value+port);
  };
  THIS.getSecureUrl = function(){
    return ('https://'+THIS.host._.value);
  };
}
