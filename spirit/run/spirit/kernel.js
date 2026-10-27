// the kernel
// this file 

'use strict';
{ // ******************************************************************

const isNode = () =>
  typeof process !== 'undefined' &&
  !!process.versions &&
  !!process.versions.node;

const isBrowser = function() { return !isNode(); }  

// these are the main constants for the SpiritOS kernel
const AUTHOR = 'Andy Flinn, from AndyFlinn.com';
const COPYRIGHT = 'Copyright (c) 2024 Andy Flinn, from AndyFlinn.com';
const VERSION = '0.0.1';
const SPIRIT_NAME = 'SpiritOS';
const SPIRIT_ENVIRONMENT_FILE = './relay-state/environment.json';

// constants
// DEBUG (desk/G2.5): one switch per process, off at start, never persisted. Andy: "DEBUG is
// Off by default, returned and set by owner-only api", "DEBUG is not persisted. it lives in RAM only".
let DEBUG = false;

// this here is the main spirit object, which contains all the core functionality of the SpiritOS kernel 
const spirit = {
  type: SPIRIT_NAME,
  core: {
    const: {
      AUTHOR:AUTHOR,
      COPYRIGHT:COPYRIGHT,
      VERSION:VERSION,
      IS_NODE:isNode(),
      IS_BROWSER:isBrowser(),
    },
    info: {},
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {},
    fs:{},
  },
  value:{},
};


// THE KEY'S TAIL WENT (goal/G40.1). Andy: "we don't show the fucking tail anywhere anymore." No label, caption or name
// is cut from a key; a key with no name has none.

// ── THE ONE MOUTH ONTO THE NODE, BOTH ENVIRONMENTS ─────────────────────
//
// AGENT.md, Comms: all comms go through one interface, and in the page
// that interface is this file. The shell asks here, apps ask the shell
// (api.verb), and nothing else opens a socket.
//
// Moved out of the browser-only block for fileTransfer goal/G1.3: a server
// process asks its node through the same function, naming the node with
// `base` (absolute, from spirit.peerPost); the browser passes none and the
// relative address keeps working. Andy: the node half and the browser half
// "count as 1, because they never co-exist in the same environment".
//
// Answers `{ status, text, body }` — `body` parsed when it was JSON and
// null when it was not, because the six private wrappers this replaces
// disagreed about which they wanted and a caller picking a helper by
// return shape picks wrong eventually.
spirit.core.ask = function (verb, args, base) {
  // ON A FACE (goal/G30.11) the page is not on its node: the face shell sets window.spirit.transport, and every ask goes
  // through it, over the sealed link to the home node.
  if (!base && typeof window !== 'undefined' && window.spirit && window.spirit.transport && typeof window.spirit.transport.ask === 'function') {
    return window.spirit.transport.ask(String(verb), args || {});
  }
  const payload = { verb: String(verb) };
  if (args) Object.keys(args).forEach(function (k) { payload[k] = args[k]; });
  return fetch((base || '') + '/api/spirit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.text().then(function (t) {
      let body = null;
      try { body = JSON.parse(t); } catch (e) { body = null; }
      return { status: r.status, text: t, body: body };
    });
  });
};

// use this for old fashioned console.log debugging, which can be turned on and off with DEBUG
let print = spirit.core.util.print = function(str){ if (spirit.core.util.debug()) { console.log(str); }
}
// Reads DEBUG, or sets it when given a boolean; answers the state that resulted.
spirit.core.util.debug = function (on) { if (typeof on === 'boolean') DEBUG = on; return DEBUG; };
Object.defineProperty(spirit.core.info, 'debug', { get: function () { return spirit.core.util.debug(); }, enumerable: true });

// use this for error messages, which will always be printed to the console
let error = spirit.core.util.error = function(str){
  console.error('ERROR: ' + str);
  return { error:{ string:str, } }; 
}

let formatBytes = spirit.core.util.formatBytes = function(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  // Determines which unit to use (0 = Bytes, 1 = KB, 2 = MB, etc.)
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Escapes a value for insertion into HTML — both element text AND
// attribute values. Lives here, in the isomorphic half, rather than in
// shell.js where it started, for two reasons: it has no per-app scoping
// concern (unlike fs, nothing about it differs app to app), and down here
// it can actually be tested. The old implementation was
// `div.textContent = str; return div.innerHTML`, which needs a DOM, so it
// could only ever run in a browser and no test could reach it.
//
// That DOM round-trip also escaped exactly three characters — & < > — and
// left both quote marks alone, while roughly thirty call sites across
// shell.js and index.html interpolate its output straight into an
// attribute: value="…", data-path="…", data-app-id="…". A filename or a
// custom app name containing a double quote closed the attribute early
// and everything after it was parsed as markup. Escaping the quotes is
// the whole point of this function existing separately.
//
// Ampersand first: escaping it after the others would double-escape the
// entities they just introduced.
let escapeHtml = spirit.core.util.escapeHtml = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

 // ******************************************************************
 // functions that can only run in the node environment

if (isNode()) {
  // give the node environment a specific space in the kernel

  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const http = require('http');
  // A process the node started holds an IPC channel to it (jobs.js, launch).
  // The channel closes when the node dies however it dies: the process goes too.
  if (typeof process.send === 'function') process.on('disconnect', function () { process.exit(0); });
  // Pinned to this file's own location, not process.cwd() — kernel.js
  // always lives at spirit/run/spirit/kernel.js, so spirit/run/ is always
  // exactly one level up, regardless of which directory the server was
  // actually launched from. process.cwd() silently broke every path,
  // discovery rule, and writable-root check if you started the server from
  // anywhere but spirit/run/ itself, with no error pointing at why.
  const ROOT_DIR = path.join(__dirname, '..');
  const DEFAULT_SPIRIT_PORT = 65432;
  const SPIRIT_PORT = DEFAULT_SPIRIT_PORT;

  // THE ONE BODY READER is serveCommon.readBody (goal/G40.6). Andy, 2026-10-25: "put the body reader in serveCommon.js
  // and have all other modules call it there." The kernel's name points there until kernel.js is deleted.
  spirit.core.readBody = function (stream, opts) { return require('./serveCommon').readBody(stream, opts); };

  spirit.core.node = {
    const:{
      ROOT_DIR:ROOT_DIR,
      DEFAULT_SPIRIT_PORT:DEFAULT_SPIRIT_PORT,
      SPIRIT_PORT:SPIRIT_PORT,
      SPIRIT_ENVIRONMENT_FILE:SPIRIT_ENVIRONMENT_FILE,
    },
    util:{

    },
  };

  // THE NODE'S FILE SYSTEM is spirit/fileSystem.js (goal/G40.6). Andy, 2026-10-25: "lift the node version of those
  // function from kernel.js and put them in spirit/fileSystem.js, then have both the node and relay use those." The
  // kernel's names point there, one copy of the rules of what may be served or written, until kernel.js is deleted.
  const fileSystem = require('./fileSystem');
  // ONE DEBUG SWITCH PER PROCESS: in node, spirit.js's (goal/G40.6), so the kernel's print obeys what the node's and
  // the relay's debug verbs set.
  spirit.core.util.debug = require('../spirit.js').debug;
  spirit.core.node.util.fsPath = fileSystem.fsPath;
  spirit.core.node.util.scanFolder = fileSystem.scanFolder;
  ['loadFile', 'statFile', 'fileWritable', 'fileServable', 'saveFile', 'loadJsonValue', 'saveJsonValue', 'deleteFile',
    'annotateFace', 'getAnnotations'].forEach(function (n) { spirit.core.fs[n] = fileSystem[n]; });

  function hashFileContents(fullPath) {
    return crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
  }

  // Two-tier staleness check for process scripts that do expensive per-file
  // work (image stats, captioning) and want to skip files already processed
  // since they last changed. mtime alone is checked first, cheaply — if
  // unchanged, definitely not stale, no file read needed. Only when mtime
  // has moved does this read and hash the file to confirm a REAL content
  // change happened, rather than reprocessing on every mtime bump (a copy,
  // a backup/restore, or some editors touching mtime on save without
  // changing a single byte) — worth the extra care specifically because
  // reprocessing can mean a paid API call (imageCaptionClaude), not just
  // CPU time.
  //
  // record: {mtimeMs, contentHash} from the caller's own last successful
  // run (read back from wherever it stored its own result), or null/
  // undefined if this file has never been processed. Returns one of:
  //   {stale: false}                     — mtime unchanged, definitely current, nothing to do
  //   {stale: false, refreshRecord}      — mtime moved but content is identical (false alarm);
  //                                         caller should skip the real work but update its
  //                                         stored record to refreshRecord, so the next run
  //                                         goes back to the cheap mtime-only path instead of
  //                                         re-hashing forever because the timestamp still
  //                                         looks "off"
  //   {stale: true, newRecord}           — genuinely changed, or never processed; caller
  //                                         should do the real work, then store newRecord
  spirit.core.node.util.checkStaleness = function(fullPath, record) {
    const currentMtimeMs = fs.statSync(fullPath).mtimeMs;

    if (!record) {
      return { stale: true, newRecord: { mtimeMs: currentMtimeMs, contentHash: hashFileContents(fullPath) } };
    }

    if (currentMtimeMs === record.mtimeMs) {
      return { stale: false };
    }

    const currentHash = hashFileContents(fullPath);
    if (currentHash === record.contentHash) {
      return { stale: false, refreshRecord: { mtimeMs: currentMtimeMs, contentHash: currentHash } };
    }

    return { stale: true, newRecord: { mtimeMs: currentMtimeMs, contentHash: currentHash } };
  };

  // spirit.core.jobs (report, log, complete, fail, publish, cycle, start, progress, end), the node's stream read as a
  // server and spirit.peerPost STOOD HERE: they are spirit.js's (spirit.jobs, spirit.events, spirit.peerPost), on the
  // events family (goal/G40.6), and nothing in node loads this file any more.

  module.exports = spirit;
}

 // ******************************************************************
 // functions that can only run in the browser environment

 if (isBrowser()) {
  // loadFile/statFile below are synchronous XHR (async: false), blocking
  // the UI thread for the round trip. Deliberately left as-is (review #9,
  // 2026-09) rather than converted to async: doing it properly means every
  // call site becoming promise-aware, not just these two functions. Known
  // synchronous call sites as of this writing, if this is ever revisited:
  //   - shell.js: renderFileInfoBubble, discoverDynamicApps, declareDynamicApp
  //   - index.html: Text File Launcher's mount (loadFile for file content),
  //     maybeRenderJobForm (loadFile for manifest JSON)
  // Current read: low real-world pain (Media Launcher never goes through
  // loadFile — media loads via a plain <img>/<video src>, already async/
  // streamed by the browser; what's left is small text/JSON reads), so
  // deferred until it's actually felt, not fixed on foresight alone.
  spirit.core.fs.loadFile = function(filePath){
    let result = null;
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.send();
    if (xmlhttp.status==200) {
      result = xmlhttp.responseText;
    }
    return result;
  };

  // spirit.core.ask LIVES IN SHARED SPACE NOW (fileTransfer goal/G1.3):
  // the browser calls it exactly as before, with no base; spirit.peerPost
  // hands it the node's address. One mouth, both environments.

  // THE SAME READ, FOR BYTES. loadFile is sync XHR returning responseText,
  // which mangles anything that is not text — so an app wanting an image's
  // bytes had nothing to call and AI Chat reached for `fetch` directly
  // (AGENT.md, Comms: nothing but kernel.js may, in the browser).
  //
  // Async, unlike its siblings here, and deliberately: the sync reads above
  // are small text and JSON, and blocking the page on a megabyte of JPEG is
  // the one case where the comment above them stops being true.
  //
  // Same boundary as loadFile — whatever the static route will serve, which
  // fileServable already decides on the node. A refusal answers null rather
  // than throwing, because every caller here is decorating a screen.
  spirit.core.fs.loadDataUrl = function(filePath){
    return fetch(filePath)
      .then(function (r) { return r.status === 200 ? r.blob() : null; })
      .then(function (blob) {
        if (!blob) return null;
        return new Promise(function (resolve) {
          const reader = new FileReader();
          reader.onloadend = function () { resolve(reader.result); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  };

  // Sync, same as loadFile — file metadata (size/mtime/birthtime) for
  // display purposes, via the fs.stat verb (the browser has no
  // direct filesystem access, unlike the Node side's fs.statSync).
  spirit.core.fs.statFile = function(filePath) {
    let result = null;
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", "/api/spirit", false);
    xmlhttp.setRequestHeader("Content-Type", "application/json");
    xmlhttp.send(JSON.stringify({ verb: "fs.stat", path: filePath }));
    if (xmlhttp.status == 200) {
      try { result = JSON.parse(xmlhttp.responseText); } catch (e) { result = null; }
    }
    return result;
  };

  // Sync, same as loadFile/statFile — "More Information" data any tool has
  // recorded about this file via annotateFace (kernel.js's Node side; the face part, the one part since goal/G41.1), via
  // the fs.annotations verb (no direct filesystem access from the
  // browser). Always resolves to an object — {} both when nothing's been
  // recorded and when the request itself fails — so callers never need a
  // null-check before reading .face.
  spirit.core.fs.getAnnotations = function(filePath) {
    let result = {};
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", "/api/spirit", false);
    xmlhttp.setRequestHeader("Content-Type", "application/json");
    xmlhttp.send(JSON.stringify({ verb: "fs.annotations", path: filePath }));
    if (xmlhttp.status == 200) {
      try { result = JSON.parse(xmlhttp.responseText); } catch (e) { result = {}; }
    }
    return result;
  };

  spirit.core.fs.saveFile = function(filePath, content) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/spirit', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to save file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ verb: 'fs.save', path: filePath, content: content }));
    });
  };

  // The browser wrappers for saveAppScript / saveAppManifest stood here
  // until 2026-09-13 (decision 0008). Their routes are gone, so a page
  // has no way to write an app's own code at all — which is the point,
  // not a side effect.

  spirit.core.fs.deleteFile = function(filePath) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/spirit', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to delete file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ verb: 'fs.delete', path: filePath }));
    });
  };

  // Returns a load/save/delete handle scoped to app/<appName>/ — the app's
  // own code only ever supplies a bare filename (appRoot is baked in by this
  // closure), so it has no parameter through which to name a path outside
  // its own folder. This is an accident-prevention convenience, not a
  // security boundary: anything in the same page can still reach the raw
  // spirit.core.fs.* functions directly. The real boundary is server-side
  // (saveFile/deleteFile there reject anything outside ROOT_DIR/shell/).
  spirit.core.fs.createScopedFs = function(appName) {
    let appRoot = 'shell/' + appName + '/';

    function safeName(filename) {
      if (typeof filename !== 'string' || filename.indexOf('..') !== -1 || filename.charAt(0) === '/') {
        throw new Error('invalid filename for app "' + appName + '": ' + filename);
      }
      return appRoot + filename;
    }

    return {
      loadFile: function(filename) { return spirit.core.fs.loadFile(safeName(filename)); },
      saveFile: function(filename, content) { return spirit.core.fs.saveFile(safeName(filename), content); },
      deleteFile: function(filename) { return spirit.core.fs.deleteFile(safeName(filename)); },
      fileStats: function(filename) { return spirit.core.fs.statFile(safeName(filename)); },
      // Lists this app's own folder, re-rooted so relativePath matches the bare-filename convention every other method
      // here uses (no leading "shell/<appName>/"). FROM THE SHELL'S ONE TREE (goal/G29.8). The item's box: "an app's
      // own folder (kernel's scanDirectory) keeps the rows under its folder", and "the one shared helper is the shell's
      // tree read with no words": the node is asked nothing. Async as before; empty until the tree is whole.
      scanDirectory: function() {
        var all = (spirit.shell && typeof spirit.shell.currentFiles === 'function' && spirit.shell.currentFiles()) || [];
        return Promise.resolve(all
          .filter(function (f) { return f.relativePath.indexOf(appRoot) === 0 && f.relativePath.length > appRoot.length; })
          .map(function (f) {
            var rel = f.relativePath.slice(appRoot.length);
            return { name: f.name, kind: f.kind, relativePath: rel };
          }));
      },
    };
  };

  // spirit.core.jobs: browser-side API for the jobs subsystem — wraps
  // EventSource for live updates and XHR for the request/response calls,
  // so a page never has to hand-roll either.
  // spirit.core.relays STOOD HERE (puppets/G2): relay.status rebuilt over relay.search. relay.search went with
  // goal/G40.11, and the one spirit object's spirit.relay.status (the relay family's api.js) is what the screens ask.

  // THE PAGE'S ONE STREAM STOOD HERE: it is spirit.js's spirit.events.subscribe, on the events family (goal/G40.6).

  spirit.core.jobs = {
    start: function(options) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/spirit', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to start job: ' + xhr.status));
          }
        };
        xhr.send(JSON.stringify(Object.assign({ verb: 'jobs.create' }, options || {})));
      });
    },
    // jobs.list is gone (puppets/G2): search(q) answers key/label pairs,
    // get(key) one job.
    search: function(q) {
      return spirit.core.ask('jobs.search', { q: q == null ? '*' : q }).then(function (res) { return res.body; });
    },
    get: function(key) {
      return spirit.core.ask('jobs.get', { key: key }).then(function (res) { return res.body; });
    },
    cancel: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/spirit', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to cancel job: ' + xhr.status));
          }
        };
        xhr.send(JSON.stringify({ verb: 'jobs.cancel', id: id }));
      });
    },
    delete: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/spirit', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('failed to delete job: ' + xhr.status));
          }
        };
        xhr.send(JSON.stringify({ verb: 'jobs.delete', id: id }));
      });
    },
  };

  // ITS CONSOLE LOGGER OF EVERY EVENT (print, gated by DEBUG) STOOD HERE: the page's stream is spirit.js's
  // spirit.events.subscribe now (goal/G40.6), which this file runs before.

  // THE SPIRIT OBJECT KEEPS ITS MEMBERS (goal/G32.1): on the face spirit.js runs first, inline, and its members
  // (the families, start, ready) stay on the one object this file now names window.spirit.
  if (window.spirit && typeof window.spirit === 'object' && window.spirit !== spirit) {
    Object.keys(window.spirit).forEach(function (k) { if (!(k in spirit)) spirit[k] = window.spirit[k]; });
  }
  window.spirit = spirit;
}

 // ******************************************************************
 // functions that depend on environment specific other functions

let fileExists = spirit.core.fs.fileExists = function(filePath){
  if (spirit.core.fs.statFile === null ) 
    return false;
  else return true;
};


// THE ICON TABLE, THE OLD SHELL's ALONE (goal/G41.1; Andy: "for the old fucking shell you could have left that shit in
// kernel.js"): spirit/client/iconIndex.js is deleted and the face holds no icon table; the home shell's
// spirit.core.const.ICON is this, until kernel.js goes.
spirit.core.const.ICON = {
    ANGRY: '😠',
    ARROWDOWN: '⬇️',
    ARROWLEFT: '⬅️',
    ARROWRIGHT: '➡️',
    ARROWUP: '⬆️',
    OK: '✅',
    DELETE: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    CHECKED: '☑️',
    UNCHECKED: '⬜',
    // A chat line's marks, the popular style (goal/G4.11): kept by the peer,
    // and refused. Andy, 2026-10-03: "you have permission to expand the ICON
    // object in kernel.js." ⏳ while it travels is LOADING.
    DELIVERED: '✓',
    REFUSED: '❗',
    LOADING: '⏳',
    ERROR: '❌',
    POINTRIGHT: '▶️',
    POINTDOWN: '🔽',
    POINTLEFT: '◀️',
    POINTUP: '🔼',
    BACK: '⬅️',
    FORWARD: '➡️',
    REFRESH: '🔄',
    ADD: '➕',
    REMOVE: '➖',
    EDIT: '✏️',
    VIEW: '👁️',
    HIDDEN: '🙈',
    VISIBLE: '🙉',
    LOCKED: '🔒',
    UNLOCKED: '🔓',
    STAR: '⭐',
    HEART: '❤️',
    BROKENHEART: '💔',
    PURPLEHEART: '💜',
    THUMBSUP: '👍',
    THUMBSDOWN: '👎',
    FIRE: '🔥',
    WATER: '💧',
    EARTH: '🌍',
    AIR: '💨',
    SUN: '☀️',
    MOON: '🌙',
    CLOUD: '☁️',
    RAIN: '🌧️',
    SNOW: '❄️',
    LIGHTNING: '⚡',
    TREE: '🌳',
    FLOWER: '🌸',
    ANIMAL: '🐾',
    PERSON: '👤',
    GROUP: '👥',
    // A card index: the address book, and distinct from GROUP, which is
    // the app that manages app groups. Two apps may not resolve to the
    // same glyph — see the check in spirit/test/natterIntrinsic.js.
    // Emoji 1.0 (2010), so it renders everywhere without a fallback.
    ROLODEX: '📇',
    // Waiting for a person to decide, not refused by anybody. The one
    // mark in the shell that used to be a hand-typed × — a cross, which
    // reads as NO one column away from ❌, which is one.
    // ⏳ is LOADING already; ⌛ is the same hourglass, spent, and free.
    WAITING: '⌛',
    MUSIC: '🎵',
    VIDEO: '🎬',
    DOCUMENT: '📄',
    FILE: '📄',
    FOLDER: '📁',
    OPENFOLDER: '📂',
    LINK: '🔗',
    LOCATION: '📍',
    TIME: '⏰',
    CALENDAR: '📅',
    EMAIL: '✉️',
    PHONE: '📞',
    CHAT: '💬',
    CODE: '💻',
    BUG: '🐛',
    IDEA: '💡',
    UPLOAD: '⬆️',
    DOWNLOAD: '⬇️',
    EGGPLANT: '🍆',
    VICTORY: '✌️',
    COFFEE: '☕',
    SMOKE: '💨',
    NEEDLE: '🪡',
    THREAD: '🧵',
    NOTE: '📝',
    HOME: '🏠',
    WORK: '🏢',
    SCHOOL: '🏫',
    CAR: '🚗',
    BIKE: '🚲',
    BUS: '🚌',
    TRAIN: '🚆',
    PLANE: '✈️',
    SHIP: '🚢',
    ROCKET: '🚀',
    SATELLITE: '🛰️',
    GLOBE: '🌐',
    OBJECT: '🔲',
    BOX: '📦',
    PACKAGE: '📦',
    SPIRIT: '👻',
    GHOST: '👻',
    WIZARD: '🧙',
    WITCH: '🧙‍♀️',
    TABLE: '📊',
    CHART: '📈',
    GRAPH: '📉',
    BOOK: '📖',
    BATTERY: '🔋',
    KEY: '🔑',
    LOCK: '🔒',
    UNLOCK: '🔓',
    PAUSED: '⏸️',
    PLAY: '▶️',
    // Not STOP. That name is taken further down by the orange circle, and
    // this line lost silently to it — an object literal keeps the LAST
    // value, so every caller writing ICON.STOP has been getting 🟠 while
    // this glyph sat here unreachable. Named for what it is, which is
    // also what the emoji is called.
    STOP_BUTTON: '⏹️',
    RECORD: '⏺️',
    REWIND: '⏪',
    FASTFORWARD: '⏩',
    PAUSE: '⏸️',
    VOLUMEUP: '🔊',
    VOLUMEDOWN: '🔉',
    MUTED: '🔇',
    UNMUTED: '🔈',
    PROTECT: '🛡️',
    SHIELD: '🛡️',
    SWORD: '⚔️',
    GUN: '🔫',
    BOMB: '💣',
    EXPLODE: '💥',
    PRAY: '🙏',
    THANKS: '🙏',
    SLEEP: '😴',
    PARTY: '🥳',
    CELEBRATE: '🎉',
    THINK: '🤔',
    CONFUSED: '😕',
    SAD: '😢',
    HAPPY: '😄',
    LOVE: '❤️',
    GROOVY: '😎',
    DEAD: '💀',
    BIRD: '🐦',
    CAT: '🐱',
    DOG: '🐶',
    MONKEY: '🐒',
    FISH: '🐟',
    MENU: '📋',
    LIST: '📋',
    // The circles, named for what they look like.
    //
    // A meaning-name earns its keep when the picture behind it can change
    // centrally — a theme, a redrawn set. These are emoji: there is
    // nothing to re-theme, so the indirection buys nothing and costs the
    // drift it already caused (see STOP_BUTTON above). Declared FIRST so
    // the colour is the canonical name in the icon chooser, which reads
    // declaration order.
    RED_CIRCLE: '🔴',
    ORANGE_CIRCLE: '🟠',
    YELLOW_CIRCLE: '🟡',
    GREEN_CIRCLE: '🟢',
    BLUE_CIRCLE: '🔵',
    PURPLE_CIRCLE: '🟣',
    BROWN_CIRCLE: '🟤',
    BLACK_CIRCLE: '⚫',
    WHITE_CIRCLE: '⚪',
    // Kept, and now aliases of the four above rather than the only names
    // for them. Every existing caller keeps the glyph it has always had.
    // Whether these survive a repo-wide tightening is a later question —
    // design/cleanup/2026-09-11-icon-convention.md.
    OFF: '🔴',
    ON: '🟢',
    YES: '✅',
    NO: '❌',
    START: '🔵',
    STOP: '🟠',
    RUN:'🏃‍♂️',
    NUMBER: '🔢',
    STRING: '🔤',
    BOOLEAN: '🔘',
    TEXT: '🔤',
    TOGGLE: '🔘',
    SUCCESS: '✅',
    SEARCH: '🔍',
    GLASSES: '👓',
    END: '🔚',
    // The item details' strip (goal/G30.8): the box and the blocks.
    PAGE: '📃',
    PLUNGER: '🪠',
};

const MIME_TYPES = spirit.core.const.MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.py': 'text/x-python'
};

} // ******************************************************************
