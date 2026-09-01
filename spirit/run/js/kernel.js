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

// constants
const DEBUG = true;

// this here is the main spirit object, which contains all the core functionality of the SpiritOS kernel 
const spirit = {
  type: SPIRIT_NAME,
  core: {
    const: {
      AUTHOR:AUTHOR,
      COPYRIGHT:COPYRIGHT,
      VERSION:VERSION,
      KERNEL_DEBUG: DEBUG,
      IS_NODE:isNode(),
      IS_BROWSER:isBrowser(),
    },
    info: {
      debug: DEBUG,
    },
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {},
    fs:{},
  },
  value:{},
};


// use this for old fashioned console.log debugging, which can be turned on and off with the DEBUG constant
let print = spirit.core.util.print = function(str){ if (DEBUG) { console.log(str); }
}

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

 // ******************************************************************
 // functions that can only run in the node environment

if (isNode()) {
  // give the node environment a specific space in the kernel

  const fs = require('fs');
  const path = require('path');
  const http = require('http');
  // Pinned to this file's own location, not process.cwd() — kernel.js
  // always lives at spirit/run/js/kernel.js, so spirit/run/ is always
  // exactly one level up, regardless of which directory the server was
  // actually launched from. process.cwd() silently broke every path,
  // discovery rule, and writable-root check if you started the server from
  // anywhere but spirit/run/ itself, with no error pointing at why.
  const ROOT_DIR = path.join(__dirname, '..');
  const DEFAULT_SPIRIT_PORT = 65432;
  
  spirit.core.node = {
    const:{
      ROOT_DIR:ROOT_DIR,
      DEFAULT_SPIRIT_PORT:DEFAULT_SPIRIT_PORT,
    },
    util:{

    },
  };

  let fsPath = spirit.core.node.util.fsPath =
  function(baseDir, requestPath) {
    const safePath = path.normalize(requestPath).replace(/^\/+/, '');
    const joined = path.join(baseDir, safePath);
    const relative = path.relative(baseDir, joined);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    return joined;
  };

  let loadFile = spirit.core.fs.loadFile =
  function(filePath){

    filePath = fsPath(ROOT_DIR,filePath);

    try {
      return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    } catch (err) {
      return null;
    }
  };

  // Read-only, same boundary as loadFile (anywhere under ROOT_DIR, not just
  // the writable roots) — file metadata for display purposes (viewer info
  // bubbles), not a write capability.
  let statFile = spirit.core.fs.statFile = function(filePath){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved) return null;
    try {
      const stats = fs.statSync(resolved);
      return { size: stats.size, mtimeMs: stats.mtimeMs, birthtimeMs: stats.birthtimeMs };
    } catch (err) {
      return null;
    }
  };

  // saveFile/deleteFile are new write capability, so they get a tighter
  // boundary than loadFile: not just "inside ROOT_DIR" but "inside
  // ROOT_DIR/app/", since that's the only place apps are meant to persist.
  // Writable roots for saveFile/deleteFile — app/ (per-app data), media/
  // (tagged assets + their JSON sidecars, added via the OS file browser, not
  // this API), and published/ (flat writing-corpus records written by scanner
  // process scripts, e.g. the WordPress scanner). process/ is deliberately
  // excluded: scripts stay browser-read-only.
  const WRITABLE_ROOT_NAMES = ['app', 'media', 'published'];

  // A handful of single, well-known root-level files also need to be
  // writable without opening up the whole ROOT_DIR — currently just
  // preferences.json (user-configurable app preferences, e.g. default file
  // handlers; deliberately root-level rather than app-scoped since these
  // choices are meant to be part of the personal dataset this project is
  // building toward, not ordinary per-app config).
  const WRITABLE_ROOT_FILES = ['preferences.json'];

  function isWithinWritableRoot(resolvedPath) {
    if (WRITABLE_ROOT_NAMES.some(function(rootName) {
      const root = path.join(ROOT_DIR, rootName);
      const relative = path.relative(root, resolvedPath);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    })) return true;

    return WRITABLE_ROOT_FILES.some(function(fileName) {
      return resolvedPath === path.join(ROOT_DIR, fileName);
    });
  }

  // Recognizes a dynamically-loaded app's own entry script (app/<name>/<name>.js,
  // the same shape index.html's discoverDynamicApps uses to find apps to load).
  // Protected everywhere, from every tool — not just self-protection, nothing
  // can overwrite ANY app's own script, even though app/ is otherwise a
  // writable root. Its sibling .json manifest is unaffected — only this one
  // filename shape is denied.
  const APP_ENTRY_SCRIPT_PATTERN = /^app\/([^/]+)\/\1\.js$/;

  let saveFile = spirit.core.fs.saveFile = function(filePath, content){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved || !isWithinWritableRoot(resolved)) return { ok: false, reason: 'forbidden' };
    if (APP_ENTRY_SCRIPT_PATTERN.test(filePath)) return { ok: false, reason: 'app-entry-script-protected' };
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf8');
      return { ok: true };
    } catch (err) {
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  let deleteFile = spirit.core.fs.deleteFile = function(filePath){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved || !isWithinWritableRoot(resolved)) return { ok: false, reason: 'forbidden' };
    try {
      fs.unlinkSync(resolved);
      return { ok: true };
    } catch (err) {
      if (err.code === 'ENOENT') return { ok: true }; // already gone — idempotent delete
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  // Directories no tool should ever need to see: dependency trees and VCS
  // internals. Skipped entirely (not recursed into, not added to result) —
  // every consumer of scanFolder (the fs-watcher, the Files/Processes apps)
  // otherwise ends up scanning/listing thousands of irrelevant files the
  // moment any process script gets its own node_modules.
  const SCAN_EXCLUDED_DIR_NAMES = new Set(['node_modules', '.git']);

  let scanFolder = spirit.core.node.util.scanFolder = function(dirPath,result = []){
      //print('inside of scanFolder "' + dirPath + '"');

      try {
          // Returns an array of fs.Dirent objects
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });

          while (entries.length > 0){
              let entry = entries.shift();

              if (entry.isDirectory()) {
                  if (SCAN_EXCLUDED_DIR_NAMES.has(entry.name)) continue;

                  let subfolder = path.join(entry.parentPath, entry.name);
                  scanFolder(subfolder,result);
                  result.push(entry);

              } else if (entry.isFile()) {
                  result.push(entry);
              }

      }
          
      } catch (err) {
          error(err);
      }

      return result;
  } 

  let loadFolder = spirit.core.node.util.loadFolder = function(){

      let result = scanFolder('./');

      print('loadFolder is finished');
      print(JSON.stringify(result,null,2));

      for (let i = 0 ; i < result.length ; i++){
          let entry = result[i];
          if (entry.isDirectory()) {

              print(`📁 Folder: ${entry.parentPath}${entry.name}`);

          } else if (entry.isFile()) {

              print(`📄 File:   ${entry.parentPath}${entry.name}`);

          }
  }

      return result;
  }

  // spirit.core.jobs: the external caller's API for the jobs subsystem
  // (distinct from spirit.core.node.jobs, the server's own registry,
  // installed separately by jobs.js only inside the server process).
  // A spawned job process calls report()/log()/complete()/fail() to
  // talk back to the server that spawned it, using the SPIRIT_JOB_ID /
  // SPIRIT_CALLBACK_URL env vars the server provides.
  spirit.core.jobs = {
    report(patch) {
      const jobId = process.env.SPIRIT_JOB_ID;
      const url = process.env.SPIRIT_CALLBACK_URL;
      if (!jobId || !url) {
        return Promise.reject(new Error('spirit.core.jobs.report() called outside a spawned job context (SPIRIT_JOB_ID/SPIRIT_CALLBACK_URL unset)'));
      }
      return new Promise((resolve, reject) => {
        const body = JSON.stringify(patch);
        const req = http.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (err) {
              resolve(null);
            }
          });
        });
        req.on('error', reject);
        req.end(body);
      });
    },
    log(message) {
      return spirit.core.jobs.report({ logMessage: message });
    },
    complete(data) {
      return spirit.core.jobs.report({ status: 'completed', data });
    },
    fail(error) {
      return spirit.core.jobs.report({ status: 'failed', data: { error: String(error) } });
    },
  };

  module.exports = spirit;
}

 // ******************************************************************
 // functions that can only run in the browser environment

 if (isBrowser()) {
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

  // Sync, same as loadFile — file metadata (size/mtime/birthtime) for
  // display purposes, via the new /api/fs/stat proxy (the browser has no
  // direct filesystem access, unlike the Node side's fs.statSync).
  spirit.core.fs.statFile = function(filePath) {
    let result = null;
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", "/api/fs/stat?path=" + encodeURIComponent(filePath), false);
    xmlhttp.send();
    if (xmlhttp.status == 200) {
      try { result = JSON.parse(xmlhttp.responseText); } catch (e) { result = null; }
    }
    return result;
  };

  spirit.core.fs.saveFile = function(filePath, content) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/save', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to save file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ path: filePath, content: content }));
    });
  };

  spirit.core.fs.deleteFile = function(filePath) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/delete', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to delete file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ path: filePath }));
    });
  };

  // Returns a load/save/delete handle scoped to app/<appName>/ — the app's
  // own code only ever supplies a bare filename (appRoot is baked in by this
  // closure), so it has no parameter through which to name a path outside
  // its own folder. This is an accident-prevention convenience, not a
  // security boundary: anything in the same page can still reach the raw
  // spirit.core.fs.* functions directly. The real boundary is server-side
  // (saveFile/deleteFile there reject anything outside ROOT_DIR/app/).
  spirit.core.fs.createScopedFs = function(appName) {
    let appRoot = 'app/' + appName + '/';

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
    };
  };

  // spirit.core.jobs: browser-side API for the jobs subsystem — wraps
  // EventSource for live updates and XHR for the request/response calls,
  // so a page never has to hand-roll either.
  spirit.core.jobs = {
    subscribe: function(handlers) {
      handlers = handlers || {};
      let source = new EventSource('/api/events');
      source.addEventListener('snapshot', function(e) {
        if (handlers.onSnapshot) handlers.onSnapshot(JSON.parse(e.data).jobs);
      });
      source.addEventListener('job-updated', function(e) {
        if (handlers.onUpdate) handlers.onUpdate(JSON.parse(e.data));
      });
      source.addEventListener('job-deleted', function(e) {
        if (handlers.onDelete) handlers.onDelete(JSON.parse(e.data));
      });
      return function unsubscribe() { source.close(); };
    },
    start: function(options) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/jobs', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to start job: ' + xhr.status));
          }
        };
        xhr.send(JSON.stringify(options || {}));
      });
    },
    list: function() {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/jobs', true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to list jobs: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
    cancel: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/jobs/' + encodeURIComponent(id) + '/cancel', true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to cancel job: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
    delete: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/api/jobs/' + encodeURIComponent(id), true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('failed to delete job: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
  };

  // Self-starting: the moment kernel.js runs in a browser, connect and log
  // every event via the shared print() (gated by the DEBUG constant above)
  // so the live event stream is observable in the console with zero UI
  // built on top of it.
  spirit.core.jobs.subscribe({
    onSnapshot: function(jobs) { print('[jobs] snapshot: ' + JSON.stringify(jobs)); },
    onUpdate: function(job) {
      if (job.type === 'server-stats') return; // ticks every ~2s, too noisy for console auto-logging
      print('[jobs] updated: ' + JSON.stringify(job));
    },
    onDelete: function(id) { print('[jobs] deleted: ' + id); },
  });

  window.spirit = spirit;
}

 // ******************************************************************
 // functions that depend on environment specific other functions

const ICON = spirit.core.const.ICON = {
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
    UDLOAD: '⬆️',
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
    STOP: '⏹️',
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
    END: '🔚',
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
