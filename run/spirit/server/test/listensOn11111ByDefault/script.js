'use strict';
// goal/G50.1, the box: "default port 11111". Started with no argument, the subject answers on 127.0.0.1:11111 and is still
// running after the answer, so a server already holding 11111 (the subject then dies on EADDRINUSE) is red, never judged.
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
  return serve(0, function (port, child) {
    return new Promise(function (ok) { setTimeout(function () { ok(child.exitCode === null && child.signalCode === null); }, 300); });
  });
};
