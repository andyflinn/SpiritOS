'use strict';

// appFaceApp stays faceless: no page, no stylesheet, nothing that listens (Desk: cleanup/G1.6).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const APP_DIR_REL = 'spirit/run/shell/appFaceApp';

const appThere = fs.existsSync(path.join(REPO, APP_DIR_REL));

function needs(req, what) {
  test.fail(req + ' — ' + APP_DIR_REL + ' is missing: ' + what);
}

test.startTest('appFaceApp is faceless');

test.subHeading('faceless — the exchange is the only door');
{
  if (!appThere) {
    needs('grant: faceless', 'the app must carry no HTTP surface, no page and no control panel');
  } else {
    const offenders = [];
    const stack = [path.join(REPO, APP_DIR_REL)];
    while (stack.length) {
      const p = stack.pop();
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); }); continue; }
      if (/\.(html|htm|css)$/i.test(p)) { offenders.push(path.relative(REPO, p) + ' (a face)'); continue; }
      if (!/\.js$/.test(p)) continue;
      const body = fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Match what it DOES, not what it says — the third costume of a
      // lesson this suite family has paid for twice.
      if (/createServer\(|\.listen\(|require\(['"]https?['"]\)/.test(body)) {
        offenders.push(path.relative(REPO, p) + ' (serves)');
      }
    }
    if (!offenders.length) {
      test.check('grant: the app has no face — no page, no stylesheet, nothing that listens. The exchange is the only door, ' +
        'which is what lets this suite drive it the way join\'s installer will');
    } else {
      test.fail('grant: a face appeared on the faceless app: ' + offenders.join(', ') +
        '. Andy: "faceless, no shortcut" — and a second door means the tested path and the used path can diverge');
    }
  }
}

test.reportSuccessFailureCount();
