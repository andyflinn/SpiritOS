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
  const crypto = require('crypto');
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

    if (!fileServable(filePath)) return null;

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
    if (!fileServable(filePath)) return null;
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

  // Recognizes a dynamically-loaded app's own manifest (app/<name>/<name>.json).
  // Like APP_ENTRY_SCRIPT_PATTERN, protected everywhere, from every tool — a
  // manifest is introspectable (readable) by the app it describes, but never
  // writable by it: it already carries name/icon (which a Tier-3 app could
  // otherwise silently change, bypassing checkIdentityAvailable's collision
  // check) and, as of this change, `owner` — the field recording which
  // privilege tier produced the app. See saveAppManifest, below, for the one
  // deliberate exception, which enforces the `owner` value itself rather than
  // trusting the caller's content.
  const MANIFEST_PATTERN = /^app\/([^/]+)\/\1\.json$/;

  // The one sidecar per annotated file gets a suffix, never a same-name
  // extension swap — <file>.sidecar.json can never collide with the
  // target itself, whatever the target's own extension is (a plain
  // extension-replace, like an earlier hand-rolled convention this
  // project also had, collides for any target that's already .json).
  const SIDECAR_SUFFIX = '.sidecar.json';

  // These three never reach a browser at all — jobs.js/server.js have no
  // isBrowser() half to justify it, and kernel.js's is served only via
  // the boot-asset allowlist in server.js's static route (a separate,
  // narrower exception), never through the generic fileServable-gated
  // path loadFile/scanFolder/the rest of the static route all share.
  const UNSERVABLE_FILES = ['js/kernel.js', 'js/jobs.js', 'js/server.js', 'js/relay.js', 'js/hub.js', 'js/relayAuth.js'];
  
  // Consolidates what saveFile/deleteFile each used to inline-check
  // separately. Path-only, caller-independent by design — see kernel.js's
  // own broader comments on this: nothing server-side can verify which
  // app is really asking, only whether the path itself is allowed.
  // The one shape every gate below depends on: a caller-supplied path
  // reduced to its ROOT_DIR-relative, forward-slashed canonical form, or
  // null if it escapes ROOT_DIR entirely.
  //
  // This exists because both gates used to pattern-match the raw string the
  // caller handed in, while fsPath resolved that same string separately —
  // so the two could disagree, and the filesystem always obeyed the second
  // one. 'relay-state/identity.json' was denied while
  // './relay-state/identity.json' was not, and both name the same file: on
  // a relay, the Ed25519 PRIVATE KEY. The same gap let
  // 'app/./natter/natter.js' through a guard that refused
  // 'app/natter/natter.js'. Every pattern below now runs against this
  // function's OUTPUT, never against the input, so a path gets exactly one
  // verdict no matter how it is spelled.
  //
  // Note this deliberately resolves rather than rejecting dot segments
  // outright: './index.html' and 'app/./natter/relays.json' are legitimate
  // and have to keep working (pathJail.js and pathCanonicalization.js both
  // assert it). Canonicalize, then check — don't blanket-refuse.
  function canonicalPath(filePath) {
    if (typeof filePath !== 'string') return null;
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved) return null;
    return path.relative(ROOT_DIR, resolved).replace(/\\/g, '/');
  }

  function fileWritable(filePath) {
    const canonical = canonicalPath(filePath);
    if (canonical === null) return false;
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved || !isWithinWritableRoot(resolved)) return false;
    if (APP_ENTRY_SCRIPT_PATTERN.test(canonical)) return false;
    if (MANIFEST_PATTERN.test(canonical)) return false;
    if (canonical.endsWith(SIDECAR_SUFFIX)) return false; // only annotateFile touches a sidecar's own path
    return true;
  }

  // Same idea as fileWritable, for "can this path ever be read or listed
  // at all" instead of "written". A sidecar is hidden from every generic
  // consumer the same way — the only sanctioned way to see one is through
  // getAnnotations, never loadFile/scanFolder/the static route.
  function fileServable(filePath) {
    const canonical = canonicalPath(filePath);
    // A path that escapes ROOT_DIR is now refused by the read gate itself,
    // not only by fsPath further down inside loadFile — one verdict, made
    // in one place, for every consumer (loadFile, statFile, scanFolder,
    // getAnnotations, and server.js's static route alike).
    if (canonical === null) return false;
    if (UNSERVABLE_FILES.indexOf(canonical) !== -1) return false;
    if (canonical.endsWith(SIDECAR_SUFFIX)) return false;
    if (canonical === 'relay-state' || canonical.indexOf('relay-state/') === 0) return false;
    return true;
  }
  spirit.core.fs.fileWritable = fileWritable;
  spirit.core.fs.fileServable = fileServable;

  let saveFile = spirit.core.fs.saveFile = function(filePath, content){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!fileWritable(filePath)) return { ok: false, reason: 'forbidden' };
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf8');
      return { ok: true };
    } catch (err) {
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  // The one deliberate exception to saveFile's entry-script guard above —
  // App Builder's whole purpose is writing an app's own app/<name>/<name>.js,
  // which saveFile refuses unconditionally. Kept as a separate, narrowly-
  // named function rather than a flag on saveFile so that invariant ("saveFile
  // can never touch an entry script") stays true for every other caller
  // without exception, and this one path is easy to find and audit. Only
  // ever reached via a deliberate user gesture (an Apply click) in the UI —
  // this function itself enforces no more than "the path really is shaped
  // like an entry script", the same trust boundary already accepted for
  // /api/jobs's spawn capability (this server only ever talks to your own
  // browser tab).
  let saveAppScript = spirit.core.fs.saveAppScript = function(filePath, content){
    const canonical = canonicalPath(filePath);
    const resolved = fsPath(ROOT_DIR, filePath);
    if (canonical === null || !resolved || !isWithinWritableRoot(resolved)) return { ok: false, reason: 'forbidden' };
    // Matched against the canonical form for the same reason fileWritable
    // is — here the pattern must MATCH to proceed, so a raw-string check
    // failed closed rather than open, but a path deserves one verdict
    // whichever direction the guard points.
    if (!APP_ENTRY_SCRIPT_PATTERN.test(canonical)) return { ok: false, reason: 'not-an-app-entry-script' };
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf8');
      return { ok: true };
    } catch (err) {
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  // The one deliberate exception to saveFile's manifest guard above — App
  // Builder's Apply must write app/<name>/<name>.json alongside the entry
  // script. Unlike saveAppScript (which writes raw, uninterpreted text),
  // this function parses the incoming content as JSON and forcibly
  // overwrites its "owner" key to 'user' before re-serializing — the
  // caller's claimed value for that key, whatever it is, is discarded
  // unconditionally. This is the actual security property: the kernel
  // itself decides `owner` for anything reaching disk through this route.
  // No browser-reachable path can ever produce "owner":"system" or
  // "owner":"kernel" — those values are set only by a direct hand-edit to
  // the file outside the running server (a human/git action, never
  // something this process does on a caller's behalf).
  let saveAppManifest = spirit.core.fs.saveAppManifest = function(filePath, content){
    const canonical = canonicalPath(filePath);
    const resolved = fsPath(ROOT_DIR, filePath);
    if (canonical === null || !resolved || !isWithinWritableRoot(resolved)) return { ok: false, reason: 'forbidden' };
    if (!MANIFEST_PATTERN.test(canonical)) return { ok: false, reason: 'not-an-app-manifest' };
    let manifest;
    try {
      manifest = JSON.parse(content);
    } catch (err) {
      return { ok: false, reason: 'invalid-manifest-json' };
    }
    manifest.owner = 'user';
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, JSON.stringify(manifest, null, 2), 'utf8');
      return { ok: true };
    } catch (err) {
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  let deleteFile = spirit.core.fs.deleteFile = function(filePath){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!fileWritable(filePath)) return { ok: false, reason: 'forbidden' };
    try {
      fs.unlinkSync(resolved);
      return { ok: true };
    } catch (err) {
      if (err.code === 'ENOENT') return { ok: true }; // already gone — idempotent delete
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  // Per-file annotation interface: one sidecar JSON file colocated with the
  // target (<file>.sidecar.json), exactly two top-level buckets. 'client' is
  // the only bucket any external caller — a browser app or a spawned process
  // script alike — can ever reach, because annotateFile (the only exported
  // entry point) never accepts a bucket argument. 'server' is reserved for
  // kernel.js/server.js/jobs.js's own internal use and is unused so far —
  // nothing in this pass writes it; a future kernel-internal caller would
  // reach it only via writeBucket('server', ...) directly, never through
  // annotateFile. See fileWritable/fileServable above for why buckets aren't
  // further subdivided per-caller: nothing server-side can verify which app
  // is really asking.
  function sidecarPathFor(filePath) {
    return filePath + SIDECAR_SUFFIX;
  }

  function readSidecar(filePath) {
    const resolved = fsPath(ROOT_DIR, sidecarPathFor(filePath));
    try {
      return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } catch (err) {
      return {};
    }
  }

  function writeBucket(bucket, filePath, payload) {
    if (!fileWritable(filePath)) return { ok: false, reason: 'forbidden' };
    const resolvedTarget = fsPath(ROOT_DIR, filePath);
    let stat;
    try {
      stat = fs.statSync(resolvedTarget);
    } catch (err) {
      // target doesn't exist — stat stays undefined, handled below
    }
    if (!stat || !stat.isFile()) return { ok: false, reason: 'file-not-found' };
    const sidecar = readSidecar(filePath);
    sidecar[bucket] = payload;
    const resolvedSidecar = fsPath(ROOT_DIR, sidecarPathFor(filePath));
    fs.mkdirSync(path.dirname(resolvedSidecar), { recursive: true });
    fs.writeFileSync(resolvedSidecar, JSON.stringify(sidecar, null, 2), 'utf8');
    return { ok: true };
  }

  // The only entry point anything outside kernel.js's own code can reach —
  // always writes 'client', wholesale (not a deep merge). A caller adding one
  // key without disturbing its others must read-modify-write via
  // getAnnotations(...).client first.
  let annotateFile = spirit.core.fs.annotateFile = function(filePath, payload) {
    return writeBucket('client', filePath, payload);
  };

  let getAnnotations = spirit.core.fs.getAnnotations = function(filePath) {
    if (!fileServable(filePath)) return {};
    return readSidecar(filePath); // {} if none — both buckets, whole
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
                  // fileServable expects a ROOT_DIR-relative, forward-slashed
                  // path — the same shape jobs.js's mapEntry later derives
                  // independently for the same entry. path.resolve (not a
                  // plain join) is kept deliberately: entry.parentPath
                  // inherits whichever style the initial call used, so a
                  // relative dirPath still resolves correctly even though
                  // every caller today (jobs.js's fs-watcher,
                  // servableAssets.js) passes an absolute one.
                  const fullPath = path.resolve(entry.parentPath, entry.name);
                  const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
                  if (fileServable(relativePath)) result.push(entry);
              }

      }
          
      } catch (err) {
          error(err);
      }

      return result;
  }

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

  // Sync, same as loadFile/statFile — "More Information" data any tool has
  // recorded about this file via annotateFile (kernel.js's Node side), via
  // the /api/fs/annotations proxy (no direct filesystem access from the
  // browser). Always resolves to an object — {} both when nothing's been
  // recorded and when the request itself fails — so callers never need a
  // null-check before reading .client.
  spirit.core.fs.getAnnotations = function(filePath) {
    let result = {};
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", "/api/fs/annotations?path=" + encodeURIComponent(filePath), false);
    xmlhttp.send();
    if (xmlhttp.status == 200) {
      try { result = JSON.parse(xmlhttp.responseText); } catch (e) { result = {}; }
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

  // The one deliberate way to write an app's own entry script from the
  // browser — see saveAppScript in the Node section above for what's
  // actually enforced server-side. Same shape as saveFile, different route.
  spirit.core.fs.saveAppScript = function(filePath, content) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/save-app-script', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to save app script: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ path: filePath, content: content }));
    });
  };

  // The one deliberate way to write an app's own manifest from the browser
  // — see saveAppManifest in the Node section above for what's actually
  // enforced server-side (owner is force-set there, not here). Same shape
  // as saveAppScript's wrapper, different route; this function is a dumb
  // HTTP passthrough and does no interpretation of `content` itself.
  spirit.core.fs.saveAppManifest = function(filePath, content) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/save-app-manifest', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to save app manifest: ' + xhr.status));
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
      fileStats: function(filename) { return spirit.core.fs.statFile(safeName(filename)); },
      // Lists this app's own folder — not a new server capability, just a
      // scoped view of the fs-watcher job's already-live-updated snapshot
      // (the same data /api/jobs already sends for the Files app and
      // aiChat's media browser), filtered to this app's own files and
      // re-rooted so relativePath matches the bare-filename convention
      // every other method here uses (no leading "app/<appName>/"). No new
      // route, no new jail logic — it can only ever narrow an already-safe
      // listing, never expand what's visible. Async (unlike loadFile),
      // since it goes over the same /api/jobs fetch every other scan of
      // this data already uses.
      scanDirectory: function() {
        return fetch('/api/jobs')
          .then(function (res) { return res.json(); })
          .then(function (jobs) {
            var fsWatcher = jobs.filter(function (j) { return j.type === 'fs-watcher'; })[0];
            var all = (fsWatcher && fsWatcher.data && fsWatcher.data.files) || [];
            return all
              .filter(function (f) { return f.relativePath.indexOf(appRoot) === 0; })
              .map(function (f) {
                return {
                  name: f.name,
                  kind: f.kind,
                  relativePath: f.relativePath.slice(appRoot.length),
                };
              });
          });
      },
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
