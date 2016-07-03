var zs4 = require('./www/zs4');
var token = require('./token');

var express = require('express');
var logger = require('morgan');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var sessionStore = require('connect-mongo')(session);

var fs = require('fs');

www = exports;

www.zs4 = zs4;

www.html = function(path){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <base href="' + path + '">\n';

      html += '  <link rel="stylesheet" href="/style.css">\n';

      html += '  <script src="/zs4.js"></script>\n';
      html += '  <script src="/html.js"></script>\n';
      //html += '  <script src="/js/zs4-shared.js"></script>\n';
      //html += '  <script src="/js/zs4-browser.js"></script>\n';
    html += ' </head>\n';
    if (true){
      html += ' <body onload="zs4.ui.initialize(document.body)">\n';
      //html += ' <body>\n';

      //html += ' Here\'s some nonsense\n';

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
// use session not implemented...
www.app.use(express.static(path.join(__dirname, 'www')));



www.app.get('/', function (req, res) {
  zs4.console.log(req.query);
  res.write(www.html(req.path));
  res.end();

});

www.app.post('/*', function (req, res) {
  if (zs4.is.object(req.body.requesttoken)){
    zs4.console.log('requesttoken!!!!!!');
    token.requesttoken(req.body.requesttoken.email,function(ret){
      zs4.console.log('requesttoken!!!!!! back at www');
      if (zs4.is.object(ret))res.send(ret);
      else res.send(new zs4.error());
    });
  }
  else{
    zs4.console.log(zs4.THIS.value);
    zs4.console.log(req.body);
    res.send(zs4.type.get.call(zs4.THIS));

  }
});

www.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'www',required:true,onchange:function(){
    console.log('____WWW_ONCHANGE___');
    var port = this.value.port;
    if (this.value.run == true){

      www.app.listen(port, function () {
        console.log('zs4 listening on port '+port+'!');
      });
    }
  }}));
  zs4.type.property(parent.www,new zs4.type.string({name:'host',required:true,default:'localhost',}));
  zs4.type.property(parent.www,new zs4.type.integer({name:'port',required:true,default:3000,}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'autostart',required:true}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'run',nostore:true}));
  zs4.type.property(parent.www,new zs4.type.boolean({name:'running',nostore:true}));


}
