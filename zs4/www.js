var zs4 = require('./www/zs4');
var token = require('./token');

var express = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var fs = require('fs');

www = exports;

www.zs4 = zs4;

www.html = function(req,res,err){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <base href="' + req.path + '">\n';

      html += '  <link rel="stylesheet" href="/style.css">\n';

      html += '  <script src="/zs4.js"></script>\n';
      html += '  <script src="/html.js"></script>\n';
      if (zs4.is.email(req.zs4.email))html += '  <script>zs4.session.email=\''+req.zs4.email+'\';</script>\n';

    html += ' </head>\n';
    if (true){
      if (err){html+=err;}
      else {html += ' <body onload="zs4.ui.initialize(document.body)">\n';}
      //html += ' <body>\n';


      html += ' </body>\n';
    }
  html += '</html>\n';
  return(html);
}

www.app = express();
www.app.use(favicon(path.join(__dirname, 'www', 'favicon.ico')));
www.app.use(logger('dev'));
www.app.use(bodyParser.json());
www.app.use(bodyParser.urlencoded({ extended: false }));
www.app.use(cookieParser());
www.app.use(express.static(path.join(__dirname, 'www')));

www.app.use(function(req, res, next) {token.validate(req,res,function(ret){next();});});

www.app.get('/returntoken', function (req, res) {
  token.validate(req,res,function(ret){
    if (zs4.is.error(ret)){

      res.redirect('/');
    }
    else token.renew(req,res,ret,function(ret){
      res.redirect('/');
    });
  });
});

www.app.get('/destroytoken', function (req, res) {
  token.destroy(req,res,function(ret){
    res.redirect('/');
  });
});

www.app.get('/this.js',function(req,res){

});

www.app.get('/*', function (req, res) {
  //zs4.console.log(req.zs4);
  res.write(www.html(req,res));
  res.end();

});


www.app.post('/*', function (req, res) {
  if (req.email)zs4.console.log(req.email);
  if (zs4.is.object(req.body.requesttoken)){
    //zs4.console.log('requesttoken!!!!!!');
    token.requesttoken(req.body.requesttoken.email,function(ret){
      //zs4.console.log('requesttoken!!!!!! back at www');
      if (zs4.is.object(ret))res.send(ret);
      else res.send(new zs4.error());
    });
  }
  else{
    zs4.console.log(req.zs4);
    zs4.console.log(req.body);
    res.send(zs4.type.get.call(zs4.THIS,req.zs4));

  }
});

www.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'www',required:true,onchange:function(req,cb){
    //zs4.console.log('____WWW_ONCHANGE___');
    //zs4.console.log(this);
    var port = this.value.port;
    if (this.value.run == true){
      this.start();
    }
    //zs4.console.log('cb is... '+cb);
    cb();
  }}));
  zs4.type.property(parent.www,new zs4.type.string({name:'host',required:true,default:'localhost',}));
  zs4.type.property(parent.www,new zs4.type.integer({name:'port',required:true,default:3000,}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'run',nostore:true}));

  parent.www.start = function(){
    console.log('inside start');
    var port = this.value.port;
    zs4.boot.run(function(){
      www.app.listen(port, function (err) {
        if (err!=null)console.log('failed to start server: '+zs4.json.stringify(err));
        else console.log('zs4 listening on port '+port+'!');
      });
    });
  };
  parent.www.getHostURL = function(){
    return ('http://'+this.value.host+':'+this.value.port);
  }
}
