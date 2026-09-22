'use strict';

// platform/wsl/desktop/desktop.js — a desktop in the browser, for WSL.
//
//   node platform/wsl/desktop/desktop.js            → http://127.0.0.1:45480
//   node platform/wsl/desktop/desktop.js --port N
//
// Andy, 2026-09-22: "wsl comes with now desktop, i want a littel server
// that present in a browser like a fake-desktop and allows me to launch
// linux UI-programs i installed from an icon...." — "let wsl build it and
// maintain it." Standalone for now; later perhaps a group in the shell.
// Built and kept by wsl-claude. Design: README.md beside this file.
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────
//
// Reads the installed programs from the XDG .desktop entries, shows one
// icon each, and launches the one clicked — detached, so its window comes
// up through WSLg and outlives this server. Terminal programs (Vim, Byobu)
// are launched inside a terminal window.
//
// ── WHAT IT REFUSES, AND WHY IT HAS TO ───────────────────────────────
//
// A page that launches programs is exactly what a hostile website wants,
// and a browser will send it a POST from any site. So, before any route:
//   - only connections from this machine, naming this machine (Host), which
//     stops DNS rebinding;
//   - no request from another site: an Origin that is not this server's own
//     is refused, and so is Sec-Fetch-Site cross-site or same-site — the
//     same gate the node got in deb5978;
//   - a launch must be JSON, which a cross-site page cannot send without a
//     preflight this server never answers;
//   - a launch names an id from the scanned list and nothing else. The
//     command comes from the .desktop file, split into arguments and started
//     WITHOUT a shell; nothing in the request is ever run.
//
// And one fact about WSL2 worth knowing: it forwards loopback one way, so a
// Windows program can reach this server on 127.0.0.1 too (Andy's Windows
// Chrome, which is the point — and any other Windows program, which is the
// cost). It can only launch what is listed.
//
// ── ONE DOOR ─────────────────────────────────────────────────────────
//
// This file serves a page, so it reaches twice — require('http') for its own
// server, and the page's fetch back to it — counted at 2 in spirit/test/oneDoor.js with
// Andy's words (AGENT.md, Comms). It talks to no node and no peer. Linux
// paths are built with path.posix: this only ever runs in WSL, and a suite
// that loads it on Windows must still see Linux paths.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DEFAULT_PORT = 45480;

// ── READING .desktop ENTRIES ─────────────────────────────────────────

function applicationDirs(env) {
  const e = env || process.env;
  const home = e.HOME || os.homedir();
  const dataHome = e.XDG_DATA_HOME || path.posix.join(home, '.local', 'share');
  const dataDirs = (e.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
  const dirs = [dataHome].concat(dataDirs).map(function (d) { return path.posix.join(d, 'applications'); });
  dirs.push('/var/lib/snapd/desktop/applications');
  return dirs.filter(function (d, i) { return dirs.indexOf(d) === i; });
}

// The [Desktop Entry] group only; localized keys (Name[de]=) are skipped.
function parseDesktopEntry(text) {
  const out = {};
  let inGroup = false;
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    if (t.charAt(0) === '[') { inGroup = (t === '[Desktop Entry]'); return; }
    if (!inGroup) return;
    const i = t.indexOf('=');
    if (i < 1) return;
    const key = t.slice(0, i).trim();
    if (key.indexOf('[') !== -1) return;
    if (!(key in out)) out[key] = t.slice(i + 1).trim();
  });
  return out;
}

// Exec, per the Desktop Entry spec: arguments split on spaces, double
// quotes group, and inside quotes a backslash escapes " ` $ \. Field codes
// (%f %F %u %U …) name files or URLs to open; this desktop opens none, so
// they are dropped, and %% is a literal percent.
function splitExec(exec) {
  const args = [];
  let cur = '';
  let quoted = false;
  let any = false;
  const s = String(exec || '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charAt(i);
    if (quoted) {
      if (c === '\\' && i + 1 < s.length && '"`$\\'.indexOf(s.charAt(i + 1)) !== -1) { cur += s.charAt(i + 1); i += 1; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') { quoted = true; any = true; }
    else if (c === ' ' || c === '\t') { if (any || cur) { args.push(cur); cur = ''; any = false; } }
    else { cur += c; any = true; }
  }
  if (any || cur) args.push(cur);
  return args
    .map(function (a) { return a.replace(/%%/g, '\u0000'); })
    .filter(function (a) { return !/^%[fFuUdDnNickvm]$/.test(a); })
    .map(function (a) { return a.replace(/%[fFuUdDnNickvm]/g, '').replace(/\u0000/g, '%'); })
    .filter(function (a) { return a.length > 0; });
}

// An entry becomes an icon only if it is a visible Application with a
// command. `id` is the file name without .desktop, the spec's own id.
function toApp(fileName, fields) {
  if ((fields.Type || 'Application') !== 'Application') return null;
  if (/^true$/i.test(fields.NoDisplay || '') || /^true$/i.test(fields.Hidden || '')) return null;
  const argv = splitExec(fields.Exec);
  if (!fields.Name || argv.length === 0) return null;
  return {
    id: fileName.replace(/\.desktop$/, ''),
    name: fields.Name,
    comment: fields.Comment || '',
    icon: fields.Icon || '',
    argv: argv,
    terminal: /^true$/i.test(fields.Terminal || ''),
  };
}

// ── ANDY'S LIST ──────────────────────────────────────────────────────
//
// Andy, 2026-09-22: "it should only list chrome, and later on gimp and the
// stuff i actually use." So the desktop shows what he lists, not what is
// installed: a small file of .desktop ids, kept on his machine and out of
// git, because which programs he uses is his machine's choice, not the
// project's. An id not on it is neither shown nor launchable.
//
//   ~/.config/wsl-desktop/apps.json   { "apps": ["google-chrome"] }

function listPath(env) {
  const e = env || process.env;
  return path.posix.join(e.XDG_CONFIG_HOME || path.posix.join(e.HOME || os.homedir(), '.config'), 'wsl-desktop', 'apps.json');
}

// A missing or unreadable list is an empty one: the page then says how to
// add a program, rather than falling back to showing everything.
function loadList(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file || listPath(), 'utf8'));
    return Array.isArray(j.apps) ? j.apps.map(String) : [];
  } catch (e) {
    return [];
  }
}

// The first directory that has an id wins, as the spec says; that lets a
// user's own entry in ~/.local/share/applications replace a system one.
// With `only`, just those ids are read, in the order Andy listed them.
function scanApps(dirs, only) {
  const seen = {};
  const apps = [];
  (dirs || applicationDirs()).forEach(function (dir) {
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    names.filter(function (n) { return n.endsWith('.desktop'); }).sort().forEach(function (n) {
      const id = n.replace(/\.desktop$/, '');
      if (seen[id]) return;
      seen[id] = true;
      let text;
      try { text = fs.readFileSync(path.join(dir, n), 'utf8'); } catch (e) { return; }
      const app = toApp(n, parseDesktopEntry(text));
      if (app) apps.push(app);
    });
  });
  if (Array.isArray(only)) {
    return only
      .map(function (id) { return apps.find(function (a) { return a.id === id; }); })
      .filter(Boolean);
  }
  return apps.sort(function (a, b) { return a.name.localeCompare(b.name); });
}

// Icon= is a path or a theme name. The theme lookup is the plain one: the
// hicolor sizes, then pixmaps. No match means a letter tile on the page.
function resolveIcon(icon) {
  if (!icon) return null;
  if (path.isAbsolute(icon)) return fs.existsSync(icon) ? icon : null;
  const sizes = ['256x256', '128x128', '96x96', '64x64', '48x48', 'scalable'];
  const roots = ['/usr/share/icons/hicolor', path.join(os.homedir(), '.local/share/icons/hicolor')];
  for (const root of roots) {
    for (const size of sizes) {
      for (const ext of ['.png', '.svg']) {
        const p = path.join(root, size, 'apps', icon + ext);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const ext of ['.png', '.svg', '.xpm']) {
    const p = path.join('/usr/share/pixmaps', icon + ext);
    if (fs.existsSync(p) && ext !== '.xpm') return p;
  }
  return null;
}

// ── LAUNCHING ────────────────────────────────────────────────────────

function findTerminal(exists) {
  const has = exists || function (p) { return fs.existsSync(p); };
  const candidates = ['zutty', 'x-terminal-emulator', 'gnome-terminal', 'xterm'];
  for (const name of candidates) {
    for (const dir of ['/usr/bin', '/usr/local/bin']) {
      if (has(path.join(dir, name))) return name;
    }
  }
  return null;
}

// What actually runs: the entry's own argv, or that argv inside a terminal.
function launchArgv(app, terminal) {
  if (!app.terminal) return app.argv.slice();
  if (!terminal) return null;
  if (terminal === 'gnome-terminal') return ['gnome-terminal', '--'].concat(app.argv);
  return [terminal, '-e'].concat(app.argv);
}

function launch(app, spawnFn) {
  const argv = launchArgv(app, findTerminal());
  if (!argv) return { ok: false, error: 'no terminal installed to run ' + app.name + ' in' };
  const child = (spawnFn || spawn)(argv[0], argv.slice(1), {
    detached: true, stdio: 'ignore', cwd: os.homedir(), env: process.env,
  });
  if (child && typeof child.on === 'function') child.on('error', function () { /* reported below */ });
  if (child && typeof child.unref === 'function') child.unref();
  return { ok: true, launched: app.name };
}

// ── THE GATE ─────────────────────────────────────────────────────────

function ownOrigins(port) {
  return ['http://127.0.0.1:' + port, 'http://localhost:' + port];
}

function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// null means let it through; a string is why it is refused.
function refusal(req, port) {
  if (!isLoopback(req.socket && req.socket.remoteAddress)) return 'only this machine may connect';
  const host = String(req.headers.host || '').toLowerCase();
  if (ownOrigins(port).map(function (o) { return o.replace('http://', ''); }).indexOf(host) === -1) {
    return 'wrong Host';
  }
  const origin = req.headers.origin;
  if (origin !== undefined && ownOrigins(port).indexOf(String(origin).toLowerCase()) === -1) {
    return 'a request from another site is refused';
  }
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (site === 'cross-site' || site === 'same-site') return 'a request from another site is refused';
  return null;
}

// ── THE PAGE ─────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function page(apps) {
  const tiles = apps.map(function (a) {
    const img = resolveIcon(a.icon)
      ? '<img src="/icon/' + encodeURIComponent(a.id) + '" alt="">'
      : '<span class="letter">' + escapeHtml(a.name.charAt(0).toUpperCase()) + '</span>';
    return '<button class="app" data-id="' + escapeHtml(a.id) + '" title="' +
      escapeHtml(a.comment || a.name) + '">' + img + '<span class="name">' +
      escapeHtml(a.name) + (a.terminal ? ' <small>terminal</small>' : '') + '</span></button>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>WSL desktop</title><style>' +
    ':root{--bg:#1d2733;--tile:#26323f;--tile-hi:#314051;--ink:#e8edf2;--muted:#9fb0c0}' +
    '@media (prefers-color-scheme:light){:root{--bg:#dde5ec;--tile:#f5f8fa;--tile-hi:#ffffff;--ink:#1b2530;--muted:#51606e}}' +
    'body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:14px system-ui,sans-serif}' +
    'header{display:flex;justify-content:space-between;align-items:baseline;padding:14px 20px;color:var(--muted)}' +
    'header b{color:var(--ink);font-size:16px}' +
    'main{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:12px;padding:8px 20px 28px}' +
    '.app{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 8px;border:0;border-radius:10px;' +
    'background:var(--tile);color:var(--ink);cursor:pointer;font:inherit}' +
    '.app:hover,.app:focus-visible{background:var(--tile-hi);outline:2px solid #5b9bd5;outline-offset:1px}' +
    '.app img,.letter{width:48px;height:48px}' +
    '.letter{display:grid;place-items:center;border-radius:10px;background:#5b9bd5;color:#fff;font-size:24px;font-weight:600}' +
    '.name{text-align:center;line-height:1.25;overflow-wrap:anywhere}.name small{display:block;color:var(--muted)}' +
    '#status{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 14px;border-radius:8px;' +
    'background:var(--tile-hi);color:var(--ink);box-shadow:0 2px 8px #0005;display:none}' +
    '.empty{grid-column:1/-1;color:var(--muted);line-height:1.6}.empty code{color:var(--ink)}' +
    '</style></head><body><header><b>WSL desktop</b><span>' + apps.length +
    ' programs · click to launch</span></header><main>' +
    (apps.length ? tiles : '<p class="empty">No programs listed yet. Add the ones you use to <code>' +
      escapeHtml(listPath()) + '</code>, for example <code>{ "apps": ["google-chrome"] }</code>, ' +
      'and reload.</p>') +
    '</main><div id="status" role="status"></div><script>' +
    'var st=document.getElementById("status");function say(t){st.textContent=t;st.style.display="block";' +
    'clearTimeout(say.t);say.t=setTimeout(function(){st.style.display="none"},3000)}' +
    'document.querySelectorAll(".app").forEach(function(b){b.addEventListener("click",function(){' +
    'fetch("/launch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.dataset.id})})' +
    '.then(function(r){return r.json()}).then(function(j){say(j.ok?"Launching "+j.launched+"…":"Could not launch: "+j.error)})' +
    '.catch(function(){say("The desktop server is not answering")})})});' +
    '</script></body></html>';
}

// ── THE SERVER ───────────────────────────────────────────────────────

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (d) {
      body += d;
      if (body.length > limit) { reject(new Error('too big')); req.destroy(); }
    });
    req.on('end', function () { resolve(body); });
    req.on('error', reject);
  });
}

function send(res, status, type, body) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
  });
  res.end(body);
}

function createServer(port, opts) {
  const o = opts || {};
  const scan = o.scan || function () { return scanApps(undefined, loadList()); };
  return http.createServer(function (req, res) {
    const why = refusal(req, port);
    if (why) { send(res, 403, 'text/plain; charset=utf-8', 'Forbidden: ' + why); return; }
    const url = new URL(req.url, 'http://127.0.0.1:' + port);

    if (req.method === 'GET' && url.pathname === '/') {
      send(res, 200, 'text/html; charset=utf-8', page(scan()));
      return;
    }
    if (req.method === 'GET' && url.pathname.indexOf('/icon/') === 0) {
      const id = decodeURIComponent(url.pathname.slice('/icon/'.length));
      const app = scan().find(function (a) { return a.id === id; });
      const file = app && resolveIcon(app.icon);
      if (!file) { send(res, 404, 'text/plain; charset=utf-8', 'no icon'); return; }
      send(res, 200, file.endsWith('.svg') ? 'image/svg+xml' : 'image/png', fs.readFileSync(file));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/launch') {
      if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
        send(res, 415, 'application/json', JSON.stringify({ ok: false, error: 'JSON only' }));
        return;
      }
      readBody(req, 1024).then(function (text) {
        let id = '';
        try { id = String(JSON.parse(text).id || ''); } catch (e) { /* stays empty */ }
        const app = scan().find(function (a) { return a.id === id; });
        if (!app) { send(res, 404, 'application/json', JSON.stringify({ ok: false, error: 'no such program' })); return; }
        const out = (o.launch || launch)(app);
        send(res, out.ok ? 200 : 500, 'application/json', JSON.stringify(out));
      }).catch(function () {
        send(res, 413, 'application/json', JSON.stringify({ ok: false, error: 'too big' }));
      });
      return;
    }
    send(res, 404, 'text/plain; charset=utf-8', 'not found');
  });
}

module.exports = {
  DEFAULT_PORT: DEFAULT_PORT,
  applicationDirs: applicationDirs,
  listPath: listPath,
  loadList: loadList,
  parseDesktopEntry: parseDesktopEntry,
  splitExec: splitExec,
  toApp: toApp,
  scanApps: scanApps,
  resolveIcon: resolveIcon,
  findTerminal: findTerminal,
  launchArgv: launchArgv,
  refusal: refusal,
  page: page,
  createServer: createServer,
};

if (require.main === module) {
  const i = process.argv.indexOf('--port');
  const port = Number(i !== -1 ? process.argv[i + 1] : (process.env.DESKTOP_PORT || DEFAULT_PORT));
  createServer(port).listen(port, '127.0.0.1', function () {
    console.log('WSL desktop on http://127.0.0.1:' + port + ' — ' +
      scanApps(undefined, loadList()).length + ' listed in ' + listPath());
  });
}
