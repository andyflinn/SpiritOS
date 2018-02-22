'use strict';

var zs4 = require('./static/zs4');
var token = require('./token');

var debug = require('debug')('zs4express');

var xpress = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var passport = require('passport');
var fs = require('fs');

var express = exports;

//debug('__dirname = '+__dirname)

express.zs4 = zs4;

express.html = function(req,res){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <title>'+req.path+' ERROR</title>\n';
      html += '  <base href="' + req.path + '">\n';
    html += ' </head>\n';
    if (true){
      //html += ' <body onload="zs4.ui.initialize(document.body)">\n';
      html += ' <body>\n';
      html += '<a href=\"/\">Go to homepage</a>\n'

      html += ' </body>\n';
    }
  html += '</html>\n';
  return(html);
}

express.getCookie = function(req,zs4request){
  if (express.THIS.cookies._.value){
    if (!zs4.is.string(zs4request.request.token)){
      if (req.query!=null&&req.query.token!=null&&req.query.token.length >10){
        zs4request.request.token=req.query.token;
        zs4request.payloadRefresh();
        zs4request.request.tokenlogin = true;
        express.THIS._.print('cookie in url');
      }
      else if (zs4.is.string(req.cookies.zs4)){
        zs4request.request.token=req.cookies.zs4;
        zs4request.payloadRefresh();
        express.THIS._.print('cookie in post');
      }
    }
  }
};
express.setCookie = function(res,zs4request){
  if (express.THIS.cookies._.value){
    if (zs4.is.string(zs4request.request.token)&&(zs4.is.object(zs4request.request.payload))){
      res.cookie('zs4' , zs4request.request.token, {expires :new Date(zs4request.request.payload.exp)});
      express.THIS._.print('cookie set');
    }
    else {
      res.cookie('zs4' , '', {expires :0});
      express.THIS._.print('cookie deleted');
    }
  }
};

express.getFunction = function (req, res) {
  var starttime = Date.now();
  express.THIS._.print('express.app.get('+req.path+')')
  debug('GET REQUEST: '+req.path);

  //debug('GET REQUEST!!!!!!!!');

  var zs4req = new zs4.request();
  zs4req.request.node = null; // SECURITY !!!!! IMPORTANT
  if (req.hostname == 'localhost' || req.hostname == '127.0.0.1'){
    zs4req.request.localhost = true;
  }
  var input = zs4req.resolveInputPath(req.path);
  input.getHTML = new Object();
  input.getHTML.query = req.query;
  debug(req.path,req.query);
  express.THIS._.print('input('+JSON.stringify(zs4req.input)+')');

  express.getCookie(req,zs4req);

  zs4req.process(function(ret){
    var r = zs4req.request.html;
    express.THIS._.print('output('+r+')')
    express.setCookie(res,zs4req);
    //res.write(express.html(req,res));
    if (r == null || r.length == 0){
      r = express.html(req,res);
      debug('ZS4 FAILED TO PRODUCE HTML');
    }

    //debug('SENDING');
    //if (zs4req.request.tokenlogin==true){
    //  zs4req.stat(zs4.THIS.zs4.email.message,{emailsent:1,},0);
    //}
    zs4req.stat(express.THIS,{bytesserved:r.length,},(Date.now()-starttime));
    zs4.stat.updateUser(zs4req,function(ret){
      res.write(r);
      res.end();
    });
  });
};
express.postFunction = function (req, res) {
  var starttime = Date.now();
  //debug('POST REQUEST: '+JSON.stringify(req.body));
  var zs4req = new zs4.request(req.body);
  zs4req.request.node = null; // SECURITY !!!!! IMPORTANT
  if (req.hostname == 'localhost' || req.hostname == '127.0.0.1'){
    zs4req.request.localhost = true;
  }
  //debug(req.body);
  express.getCookie(req,zs4req);

  zs4req.process(function(ret){
    if (zs4req.html==true){
      debug('express got HTML to send back....');
      var r = zs4req.request.html;
      express.THIS._.print('request.process returned('+zs4.json.stringify(r)+')');

      express.setCookie(res,zs4req);

      if (r == null || r.length == 0){
        r = express.html(req,res);
      }

      zs4req.stat(express.THIS,{bytesserved:r.length,},(Date.now()-starttime));
      zs4.stat.updateUser(zs4req,function(ret){
        res.write(r);
        res.end();
      });

    }
    else {
      var r = zs4req.getReply();
      var j = zs4.json.stringify(r);

      zs4req.stat(express.THIS,{bytesserved:j.length,},(Date.now()-starttime));
      zs4.stat.updateUser(zs4req,function(ret){
        express.THIS._.print('callback: '+JSON.stringify(r.request));
        express.setCookie(res,zs4req);
        res.send(r);
      });
    }
  });

};

express.running = false;

express.schema = function(parent){
  var THIS = express.THIS = new zs4.type.object({name:'express',flags:'nosort'});
  parent._.property(THIS);

  THIS._.property(new zs4.type.string({name:'host',flags:'quickupdate',default:'localhost',}));
  THIS._.property(new zs4.type.integer({name:'port',flags:'quickupdate',default:3000,}));
  THIS._.property(new zs4.type.boolean({name:'cookies',flags:'quickupdate',default:true,}));
  THIS._.property(new zs4.type.object({name:'run',flags:'required nostore noget api'}));
  THIS.run._.transform = (function(req,cb){
    req.setScope(this);
    this._.transformInternal(req);
    if (!(req.flags.value & req.flags.authset)){
      var err = 'not authorized';
      req.error(THIS,err);
      this._.print(err);
      this._.get(req); cb(); return;
    }
    this._.print('.transform()');

    //if (!zs4.is.email(zs4.THIS.zs4.))
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
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(xpress.static(path.join(__dirname, 'static'),{index:'/'}));

    for (var i = 0 ; i < zs4.plugin.static.length ; i++){
      app.use(xpress.static(path.join(__dirname, zs4.plugin.static[i])));
    }

    app.get('*',function(req,res,next){
      if (req.hostname != 'localhost' && req.get('X-Forwarded-Proto') == 'http'){
        return res.redirect(THIS.getSecureUrl() + req.url);
      }

      next();
    });

    zs4.THIS.zs4.passport._.installToExpressApp(app);

    app.get('/*',express.getFunction);
    app.post('/*',express.postFunction);

    var port = parseInt(process.env.PORT) || this.port._.value;
    zs4.boot.run(function(){

      function runHttp(){
        var httpServer = http.createServer(app);
        httpServer.listen(port,function(err){
          if (err!=null){
            req.error(THIS,{text:'failed to start server',data:err,});
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
      debug('WARNING: returning localhost name')
      return ('http://localhost'+port);
    }
    return ('http://'+THIS.host._.value+port);
  };
  THIS.getSecureUrl = function(){
    return ('https://'+THIS.host._.value);
  };
}
