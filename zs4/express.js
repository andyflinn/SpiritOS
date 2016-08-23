var zs4 = require('./static/zs4');
var token = require('./token');

var xpress = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var fs = require('fs');

express = exports;

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

express.app = xpress();
express.app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
express.app.use(logger('dev'));
express.app.use(bodyParser.json());
express.app.use(bodyParser.urlencoded({ extended: false }));
express.app.use(cookieParser());
express.app.use(xpress.static(path.join(__dirname, 'static')));

express.getCookie = function(req,zs4request){
  if (express.THIS._.value.cookies){
    if (!zs4.is.string(zs4request.request.token)){
      if (req.query!=null&&req.query.token!=null&&req.query.token.length >10){
        zs4request.request.token=req.query.token;
        zs4request.payloadRefresh();
        zs4.console.log('cookie in url: ')
      }
      else if (zs4.is.string(req.cookies.zs4)){
        zs4request.request.token=req.cookies.zs4;
        zs4request.payloadRefresh();
        zs4.console.log('cookie in post: ')
      }
    }
  }
};
express.setCookie = function(res,zs4request){
  if (express.THIS._.value.cookies){
    if (zs4.is.string(zs4request.request.token)&&(zs4.is.object(zs4request.request.payload))){
      res.cookie('zs4' , zs4request.request.token, {expires :new Date(zs4request.request.payload.exp)});
      zs4.console.log('cookie set: ')
    }
    else {
      res.cookie('zs4' , '', {expires :0});
      zs4.console.log('cookie deleted: ')
    }
  }
};

express.app.get('/*', function (req, res) {
  console.log('express.app.get('+req.path+')');
  var zs4req = new zs4.request();
  var input = zs4req.resolveInputPath(req.path);
  input.getHTML = new Object();
  input.getHTML.query = req.query;
  console.log(zs4req.input);

  express.getCookie(req,zs4req);

  zs4req.process(function(ret){
    var r = zs4req.request.html;
    console.log(r);
    express.setCookie(res,zs4req);
    //res.write(express.html(req,res));
    if (r == null || r.length == 0){
      r = express.html(req,res);
    }
    res.write(r);
    res.end();
  });
});

express.app.post('/*', function (req, res) {
  var zs4req = new zs4.request(req.body);
  //zs4.console.log('POST BODY: '+JSON.stringify(req.body));
  express.getCookie(req,zs4req);
  //zs4.console.log('request received: '+JSON.stringify(zs4req));

  zs4req.process(function(ret){
    if (zs4req.html==true){
      var r = zs4req.request.html;
      console.log(r);
      express.setCookie(res,zs4req);
      //res.write(express.html(req,res));
      if (r == null || r.length == 0){
        r = express.html(req,res);
      }
      res.write(r);
      res.end();
    }
    else {
      var r = zs4req.getReply();
      console.log('callback: '+JSON.stringify(r.request));
      express.setCookie(res,zs4req);
      //zs4.console.log('request processed: '+JSON.stringify(r));
      res.send(r);
      //zs4.console.log(r.reply.zs4.email.smtp);
    }
  });

});

express.running = false;

express.schema = function(parent){
  var THIS = express.THIS = new zs4.type.object({name:'express',flags:'required api'});
  parent._.property(THIS);

  THIS._.property(new zs4.type.string({name:'host',flags:'required',default:'localhost',}));
  THIS._.property(new zs4.type.integer({name:'port',flags:'required',default:3000,}));
  THIS._.property(new zs4.type.boolean({name:'cookies',flags:'required',default:false,}));
  THIS._.property(new zs4.type.object({name:'run',flags:'required nostore noget api'}));
  THIS.run._.transform = (function(req,cb){
    this._.transformInternal(req);
    req.setScope(this);
    console.log(this._.path+'.transform()');
    if (zs4.is.object(req.input)){
      THIS.start();
    }
    this._.get(req); cb(); return;
  }).bind(THIS.run);

  THIS.start = function(){
    if (express.running)return;
    //console.log('inside start');
    var port = this._.value.port;
    zs4.boot.run(function(){
      express.app.listen(port, function (err) {
        if (err!=null){
          console.log('failed to start server: '+zs4.json.stringify(err));
        }
        else {
          express.running = true;
          console.log('zs4 listening on port '+port+'!');
        }
      });
    });
  };
  THIS.getHostURL = function(){
    return ('http://'+this._.value.host+':'+this._.value.port);
  }
}
