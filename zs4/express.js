'use strict';

var zs4 = require('./static/zs4');
var token = require('./token');

var xpress = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');

var fs = require('fs');

var express = exports;

console.log('__dirname = '+__dirname)

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
  express.THIS._.print('express.app.get('+req.path+')')
  //console.log('GET REQUEST: '+req.path);

  //console.log('GET REQUEST!!!!!!!!');

  var zs4req = new zs4.request();
  var input = zs4req.resolveInputPath(req.path);
  input.getHTML = new Object();
  input.getHTML.query = req.query;
  console.log(req.path,req.query);
  express.THIS._.print('input('+JSON.stringify(zs4req.input)+')');

  express.getCookie(req,zs4req);

  zs4req.process(function(ret){
    var r = zs4req.request.html;
    express.THIS._.print('output('+r+')')
    express.setCookie(res,zs4req);
    //res.write(express.html(req,res));
    if (r == null || r.length == 0){
      r = express.html(req,res);
      console.log('ZS4 FAILED TO PRODUCE HTML');
    }
    res.write(r);
    res.end();
  });
};
express.postFunction = function (req, res) {
  //console.log('POST REQUEST: '+JSON.stringify(req.body));
  var zs4req = new zs4.request(req.body);
  zs4req.request.node = null; // SECURITY !!!!! IMPORTANT
  //console.log(req.body);
  express.getCookie(req,zs4req);

  zs4req.process(function(ret){
    if (zs4req.html==true){
      console.log('express got HTML to send back....');
      var r = zs4req.request.html;
      express.THIS._.print('request.process returned('+zs4.json.stringify(r)+')');

      express.setCookie(res,zs4req);

      if (r == null || r.length == 0){
        r = express.html(req,res);
      }
      res.write(r);
      res.end();
    }
    else {
      var r = zs4req.getReply();
      express.THIS._.print('callback: '+JSON.stringify(r.request));
      express.setCookie(res,zs4req);
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
  THIS._.property(new zs4.type.boolean({name:'cookies',flags:'quickupdate',default:true,}));
  THIS._.property(new zs4.type.boolean({name:'https',flags:'quickupdate',default:false,}));
  THIS._.property(new zs4.type.integer({name:'sslport',flags:'quickupdate',default:3443,}));
  THIS._.property(new zs4.type.string({name:'key',flags:'quickupdate',default:'./zs4/https/localhost.key',}));
  THIS._.property(new zs4.type.string({name:'cert',flags:'quickupdate',default:'./zs4/https/localhost.cert',}));
  THIS._.property(new zs4.type.string({name:'ca',flags:'quickupdate',}));
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

  THIS.getcredentials = (function(){
    console.log('getcredentials()');
    if (!THIS.https._.value
      || THIS.key._.value == ''
      || THIS.cert._.value == ''){
        console.log('getcredentials() not configured.');
        return null;
      }

    var ret = new Object();

    try{
      ret.key = fs.readFileSync(THIS.key._.value);
      ret.cert = fs.readFileSync(THIS.cert._.value);
    }
    catch(err){
      console.log('getcredentials() load failure');
      return null;
    }

    try{
      ret.ca = fs.readFileSync(THIS.ca._.value);
    }
    catch(err){}


    console.log('getcredentials() SUCCESS!');
    return ret;
  }).bind(THIS);

  THIS.start = function(){
    console.log('EXPRESS-START()');
    if (express.running)return;
    console.log('EXPRESS-not running yet');

    var app = xpress();

    app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(xpress.static(path.join(__dirname, 'static')));

    for (var i = 0 ; i < zs4.plugin.static.length ; i++){
      app.use(xpress.static(path.join(__dirname, zs4.plugin.static[i])));
    }

    app.get('*',function(req,res,next){
      if (!req.secure){
        if (express.HTTPS_RUNNING){
          return res.redirect(THIS.getHostURL() + req.url);
        }
        else if (req.host != 'localhost' && req.get('X-Forwarded-Proto') == 'http'){
          return res.redirect(THIS.getHostURL() + req.url);
        }
      }

      next();
    });

    app.get('/*',express.getFunction);
    app.post('/*',express.postFunction);

    var port = this.port._.value;
    zs4.boot.run(function(){

      function runHttp(){
        var httpServer = http.createServer(app);
        httpServer.listen(port,function(err){
          if (err!=null){
            req.error(THIS,{text:'failed to start server',data:err,});
          }
          else {
            express.running = true;
            console.log('zs4 listening on port '+port+'!');
          }
        });
      };

      var cred = THIS.getcredentials();

      if (cred != null){
        var httpsServer = https.createServer(cred, app);
        httpsServer.listen(THIS.sslport._.value,function(){
          console.log('zs4 HTTPS on port '+THIS.sslport._.value+'!');
          express.HTTPS_RUNNING = true;

          return runHttp();
        });
      }
      else return runHttp();
    });

  };
  THIS.getHostURL = function(){
    if (express.HTTPS_RUNNING)return ('https://'+THIS.host._.value+':'+THIS.sslport._.value);
    return ('http://'+THIS.host._.value+':'+THIS.port._.value);
  }
}
