var zs4 = require('./static/zs4');
//var token = require('./token');

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

express.app.get('/*', function (req, res) {
  res.write(express.html(req,res));
  res.end();
});

express.app.post('/*', function (req, res) {
  var zs4req = new zs4.request(req.body);
  //zs4.console.log(zs4req);

  zs4req.process(function(ret){
    res.send(zs4req);
    zs4.console.log(zs4req);
  });

});

express.running = false;

express.schema = function(parent){
  zs4.type.property(parent,new zs4.type.object({name:'express',required:true,
    onchange:function(req,cb){
      //zs4.console.log('____WWW_ONCHANGE___');
      //zs4.console.log(this);
      var port = this._.value.port;
      if (this._.value.run == true){
        this.start();
      }
      this._.value.run = false;
      cb();
    },
  }));
  zs4.type.property(parent.express,new zs4.type.string({name:'host',required:true,default:'localhost',}));
  zs4.type.property(parent.express,new zs4.type.integer({name:'port',required:true,default:3000,}));
  zs4.type.property(parent.express,new zs4.type.boolean({name:'run',nostore:true}));

  parent.express.start = function(){
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
  parent.express.getHostURL = function(){
    return ('http://'+this._.value.host+':'+this._.value.port);
  }
}
