'use strict';
// goal/G50.1; Andy: "the only URL that should work is: 127.0.0.1:11111/spirit/   or 127.0.0.1:11111/spirit/index.html",
// and "we won't start off polluting the gobal namespace (repo://run/)". Other spellings answer nothing with 200; /spirit/
// does, so a live server was judged.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var fs = require('fs');
  var http = require('http');
  var net = require('net');
  var spawn = require('child_process').spawn;
  function get(port, url) {
    return new Promise(function (ok) {
      http.get('http://127.0.0.1:' + port + url, function (res) {
        var body = '';
        res.on('data', function (c) { body += c; });
        res.on('end', function () { ok({ status: res.statusCode, body: body }); });
      }).on('error', function () { ok({ status: 0, body: '' }); });
    });
  }
  function freePort() {
    return new Promise(function (ok) { var s = net.createServer().listen(0, '127.0.0.1', function () { var p = s.address().port; s.close(function () { ok(p); }); }); });
  }
  // Starts the subject on a port of its own, so a server already running on 11111 is never the one judged.
  function serve(port, then) {
    var child = spawn(process.execPath, port ? [file, '--port', String(port)] : [file], { stdio: 'ignore' });
    var tries = 0;
    return new Promise(function (ok) {
      (function ask() {
        get(port || 11111, '/').then(function (r) {
          if (r.status > 0) return ok(true);
          if (++tries < 40) setTimeout(ask, 100); else ok(false);
        });
      })();
    }).then(function (up) { return up ? then(port || 11111, child) : false; })
      .then(function (v) { child.kill(); return v; }, function (e) { child.kill(); throw e; });
  }
  var others = ['/', '/index.html', '/spirit', '/spirit/spirit/', '/spirit//index.html/'];
  return freePort().then(function (p) { return serve(p, function (port) {
    return get(port, '/spirit/').then(function (r) {
      if (r.status !== 200) return false;
      return Promise.all(others.map(function (u) { return get(port, u); })).then(function (rs) {
        return rs.every(function (x) { return x.status !== 200 && x.status !== 0; });
      });
    });
  }); });
};
