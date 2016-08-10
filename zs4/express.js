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

express.html = function(req,res,err){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <base href="' + req.path + '">\n';

      //html += '  <link rel="stylesheet" href="/style.css">\n';

      html += '  <script src="/zs4.js"></script>\n';
      //html += '  <script src="/html.js"></script>\n';
      //if (zs4.is.email(req.zs4.email))html += '  <script>zs4.session.email=\''+req.zs4.email+'\';</script>\n';

    html += ' </head>\n';
    if (true){
      //html += ' <body onload="zs4.ui.initialize(document.body)">\n';
      html += ' <body>\n';


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
  var zs4req = new zs4.request();
  express.getCookie(req,zs4req);
  express.setCookie(res,zs4req);
  res.write(express.html(req,res));
  res.end();
});

express.app.post('/*', function (req, res) {
  var zs4req = new zs4.request(req.body);
  express.getCookie(req,zs4req);
  //zs4.console.log('request received: '+JSON.stringify(zs4req));

  zs4req.process(function(ret){
    var r = zs4req.getReply();
    express.setCookie(res,zs4req);
    //zs4.console.log('request processed: '+JSON.stringify(r));
    res.send(r);
    //zs4.console.log(r.reply.zs4.email.smtp);
  });

});

express.running = false;

express.schema = function(parent){
  var THIS = express.THIS = new zs4.type.object({name:'express',required:true,api:true,});
  zs4.type.property(parent,THIS);

  zs4.type.property(THIS,new zs4.type.string({name:'host',required:true,default:'localhost',}));
  zs4.type.property(THIS,new zs4.type.integer({name:'port',required:true,default:3000,}));
  zs4.type.property(THIS,new zs4.type.boolean({name:'cookies',required:true,default:false,}));
  zs4.type.property(THIS,new zs4.type.object({name:'run',nostore:true,noget:true,api:true,}));
  THIS.run._.transform = (function(req,cb){
    THIS.start();
    this._.reply(req);
    cb();
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
