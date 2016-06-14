var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var sessionStore = require('connect-mongo')(session);
var dotenv = require('dotenv');
var passwordless = require('passwordless');
dotenv.load();

var zs4 = require('./routes/zs4utils');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: zs4.env.ZS4_SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  store: new sessionStore({ url: zs4.env.ZS4_SESSION_DB })
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use(passwordless.sessionSupport());
app.use('/', require('./routes/zs4'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (zs4.env.debug) {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}


// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


//module.exports = app;

var   fs = require('fs'),
      https = require('https');

var key = fs.readFileSync(zs4.env.ZS4_KEY_FILE).toString();
var cert = fs.readFileSync(zs4.env.ZS4_CERT_FILE).toString();

var creds = {key: key, cert: cert};

https.createServer(creds,app).listen(parseInt(zs4.env.ZS4_PORT));
