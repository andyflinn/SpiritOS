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

  // ── ONE BODY READER: BYTES COPIED, BYTES COUNTED (goal/G16.6) ────────
  //
  //   Andy, 2026-10-10: "in a max_BYTE environment, BYTES must be copied.
  //   BYTES must be counted. that's a rule." And on where it belongs:
  //   "one single piece of shared code must ensure that raw bytes are
  //   copied. precisely", "ideally through a shared kernel.js utility or
  //   similar."
  //
  // WHAT WAS WRONG. Every reader did `body += chunk`, which decodes each
  // TCP chunk on its own. A character wider than one byte — any emoji,
  // any accent, any kanji — split across two chunks became two U+FFFD,
  // and the body was no longer the body that was sent. On a REQUEST that
  // is a spurious 403, because the signature is over the real bytes; on a
  // REPLY it is silent corruption, since nothing signs a reply until
  // goal/G16.1. The cap was already counted in bytes correctly
  // (`Buffer.byteLength`); it was the JOIN that lied, not the count.
  //
  // So the chunks are kept as Buffers and decoded ONCE over the whole
  // body, which cannot split a character because there is nothing left to
  // split it against. It is in kernel.js because kernel.js is the file
  // the node, a process and the relay all load already.
  //
  // `max` refuses by name at the first chunk that passes it and STOPS
  // READING — a body refused for its size must not go on arriving, or the
  // refusal costs what it was refusing (serveCommon's own reasoning, kept).
  // `code` and `message` let a caller name its own refusal: the relay hop
  // says `relay-answer-too-large`, the proxy says its reply is too large,
  // and a caller that names neither gets `413 body-too-large`.
  // `onBytes` is called with the running total as each chunk lands, for
  // the one caller that must answer how much it has read even when it
  // refused (serveCommon.bodyBytes, read by the node's door).
  spirit.core.readBody = function (stream, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const max = Number(o.max) > 0 ? Number(o.max) : Infinity;
    return new Promise(function (resolve, reject) {
      let chunks = [];
      let seen = 0;
      let done = false;
      function refuse(err) {
        if (done) return;
        done = true;
        chunks = null;
        if (typeof stream.destroy === 'function') stream.destroy();
        reject(err);
      }
      stream.on('data', function (c) {
        if (done) return;
        const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
        seen += buf.length;
        if (typeof o.onBytes === 'function') o.onBytes(seen);
        if (seen > max) {
          const err = new Error(String(o.message || 'body too large'));
          err.statusCode = 413;
          err.code = String(o.code || 'body-too-large');
          err.bytes = seen;
          err.max = max;
          refuse(err);
          return;
        }
        chunks.push(buf);
      });
      stream.on('end', function () {
        if (done) return;
        done = true;
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      stream.on('error', function (e) { refuse(e); });
    });
  };

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
    'annotateFile', 'annotateFace', 'getAnnotations'].forEach(function (n) { spirit.core.fs[n] = fileSystem[n]; });

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
    // ── A SPAWNED PROCESS IS A LOOPBACK CLIENT ──────────────────────
    //
    // It holds no key and cannot sign; it asks the node that spawned it
    // to act. The same position a browser is in (decision 0011), which
    // is why it speaks through the same door.
    //
    // SPIRIT_CALLBACK_URL used to carry the job id in its path —
    // `/api/jobs/<id>` — so the id was baked into a URL and matched by a
    // regexp at the other end. It names the one door now, and the id
    // travels as a field beside the verb. SPIRIT_JOB_ID already existed
    // and was already set; it simply had nothing to do until now.
    //
    // THIS IS THE ONLY PLACE A PROCESS TOUCHES THE CONTRACT. No script
    // under process/ reads either variable — they all call report(),
    // log(), complete() or fail() — so folding the route changed one
    // function rather than every job ever written.
    report(patch) {
      const jobId = process.env.SPIRIT_JOB_ID;
      const url = process.env.SPIRIT_CALLBACK_URL;
      if (!jobId || !url) {
        return Promise.reject(new Error('spirit.core.jobs.report() called outside a spawned job context (SPIRIT_JOB_ID/SPIRIT_CALLBACK_URL unset)'));
      }
      return new Promise((resolve, reject) => {
        const body = JSON.stringify(
          Object.assign({ verb: 'jobs.update', id: jobId }, patch)
        );
        const req = http.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, res => {
          // The node's answer read through the one reader (goal/G16.6):
          // a job reporting an emoji got it back as U+FFFD whenever the
          // answer's chunks fell mid-character.
          spirit.core.readBody(res).then(data => {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (err) {
              resolve(null);
            }
          }, () => resolve(null));
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

    // ── PUBLISHING (desk/G2.3), MOVED HERE FROM appServer.js (goal/G29.15) ──
    //
    // What every spawned process shares lives here; appServer.js keeps only
    // what serving needs. The object becomes the job's `app`, and every open
    // page gets it as job-updated. EVERY OBJECT GOES OUT AS IT IS HANDED IN
    // (fileTransfer goal/G1.4): no coalescing, no pacing; an app that needs
    // pacing does it itself. SAID, NOT DROPPED: an object over MAX_PAYLOAD is
    // not sent, and every page hears that one was lost, with its size and the
    // limit, so it can ask again.
    publish(obj) {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
      const max = require('./limits').PAYLOAD_MAX;
      let size = 0;
      try { size = Buffer.byteLength(JSON.stringify(obj), 'utf8'); } catch (e) { return false; }
      const send = function (o) {
        Promise.resolve(spirit.core.jobs.report({ app: o })).catch(function () { /* not started by a node */ });
      };
      if (size > max) {
        process.stderr.write('publish-too-large: ' + size + ' bytes, the limit is ' + max + '\n');
        send({ dropped: { bytes: size, max: max } });
        return false;
      }
      send(obj);
      return true;
    },

    // ── THE JOB CYCLE, ONE PROGRESS PROTOCOL (goal/G29.15) ───────────────
    //
    // A job is start, then progress and app-specific messages, then end, each
    // published as {job: {state, name, ...}} so every page draws the same bar.
    // NO PROCESS RUNS MORE THAN ONE JOB AT A TIME (Andy's ruling, the item's
    // box): a start while a job is open is refused as job-open, and a server
    // that gets more work while busy queues it itself. A transient process IS
    // its job: the node marks its start at spawn and its end at exit, so it
    // only calls progress, which is published under no name. total 0 means
    // unknown, an indeterminate bar.
    start(name) {
      if (openJob !== null) {
        const err = new Error('a job is open: ' + openJob + '; end it before starting ' + String(name || ''));
        err.code = 'job-open';
        return Promise.reject(err);
      }
      openJob = String(name || '');
      return spirit.core.jobs.cycle({ state: 'start', name: openJob });
    },
    progress(done, total, text) {
      return spirit.core.jobs.cycle({ state: 'progress', name: openJob === null ? '' : openJob,
        done: Number(done) || 0, total: Number(total) || 0, text: String(text || '') });
    },
    end(result) {
      const name = openJob === null ? '' : openJob;
      openJob = null;
      const one = { state: 'end', name: name };
      if (result instanceof Error) one.error = String(result.message || result);
      else if (result !== undefined) one.result = result;
      return spirit.core.jobs.cycle(one);
    },
    // One cycle message. IN ORDER (found by jobCycle.js flaking under goal/G29.16): publish sends and forgets, so a
    // start and its end could reach the node the wrong way round; a cycle message resolves once the node has it, so a
    // caller that awaits each call delivers them in order. Its size is the publish cap; one over it is said, not sent.
    cycle(job) {
      const one = { job: job };
      let size = 0;
      try { size = Buffer.byteLength(JSON.stringify(one), 'utf8'); } catch (e) { return Promise.resolve(false); }
      if (size > require('./limits').PAYLOAD_MAX) return Promise.resolve(spirit.core.jobs.publish(one));
      return spirit.core.jobs.report({ app: one }).then(function () { return true; }, function () { return false; });
    },
  };
  // The job this process has open, by name; null between jobs (goal/G29.15).
  let openJob = null;

  // ── THE NODE'S STREAM, READ AS A SERVER (goal/G16.9) ────────────────
  //
  // The event stream marks every waiting arrival taken when a PAGE opens
  // it, because a page catching up must see what it missed exactly once.
  // A loopback server awaiting one reply is not a page: when peerPost
  // opened the stream like one, every post by the desk, chatClerver or
  // the fileServer took the owner's whole backlog and threw it away, and
  // his next page open replayed nothing. So a server says what it is, and
  // the node reads arrivals to it as a witness (server.js, the events
  // route): it sees each new packet, is handed no backlog and marks
  // nothing taken.
  function openServerStream(base) {
    return fetch(base + '/api/events', { headers: { 'X-Spirit-Reader': 'server' } });
  }

  // ── ASK A PEER AND AWAIT THE ANSWER (fileTransfer goal/G1.3) ─────────
  //
  //   Andy: "should be done via the spirit object, no?" — and the
  //   transport cycle's R12 is NOT the way ("don't like it: ... your
  //   implying changes to the relay as well"): the answer keeps travelling
  //   as its own post carrying re, the request's hash, exactly as the door
  //   sends it (apiDoor.js).
  //
  // THE ONE COPY of the post-then-wait knot. agents.js moved onto it and
  // the fileServer asks through it — a second hand-rolled copy is how
  // answers get missed. One post through the node's peer.post, then the
  // answer-post whose `re` matches that post's hash, read off the node's
  // event stream as a server, never as a page (openServerStream above).
  // The stream is opened BEFORE the post, so an answer
  // quicker than the post's own reply is not missed.
  //
  // Resolves with the answer's body. A refused post resolves {ok: false,
  // code: 'not-posted'} at once; silence past how.waitMs (default 30 s)
  // resolves {ok: false, code: 'no-answer'} — resolved, not thrown: an
  // unanswered peer is an outcome, not a fault in the asking process.
  // how.node names the node; else the origin of SPIRIT_CALLBACK_URL, the
  // node that spawned this process. how.kind rides to peer.post
  // (demote-only, 'background' the only word, as hub.js enforces).
  spirit.peerPost = function (peer, app, body, how) {
    const o = how && typeof how === 'object' ? how : {};
    const waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : 30000;
    let base = o.node;
    if (!base && process.env.SPIRIT_CALLBACK_URL) {
      try { base = new URL(process.env.SPIRIT_CALLBACK_URL).origin; } catch (e) { base = ''; }
    }
    if (!base) return Promise.resolve({ ok: false, code: 'not-posted', error: 'no node: how.node and SPIRIT_CALLBACK_URL are both unset' });
    const packet = require('./client/packet.js');
    const made = packet.encode(app, body);
    if (!made || !made.ok) return Promise.resolve({ ok: false, code: 'not-posted', error: (made && made.error) || 'the ask could not be encoded' });
    return openServerStream(base).then(function (r) {
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let want = '';
      const early = [];
      return new Promise(function (resolve) {
        const timer = setTimeout(function () { finish({ ok: false, code: 'no-answer', error: 'no answer within ' + waitMs + ' ms' }); }, waitMs);
        function finish(v) {
          clearTimeout(timer);
          reader.cancel().catch(function () { /* stream gone */ });
          resolve(v);
        }
        function take(msg) {
          if (msg.from !== peer) return;
          let got = null;
          try { got = packet.decode(msg.text); } catch (e) { return; }
          if (!got || !got.re) return;
          // Before the post's own reply names the hash, a candidate is kept
          // rather than judged, so the quick answer is not lost.
          if (!want) { early.push(got); return; }
          if (got.re === want) finish(got.body);
        }
        function pump() {
          reader.read().then(function (chunk) {
            if (chunk.done) { finish({ ok: false, code: 'no-answer', error: 'the node closed its stream before the answer came' }); return; }
            buf += dec.decode(chunk.value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) !== -1) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2);
              const ev = /event: (.*)/.exec(block); const da = /data: (.*)/.exec(block);
              if (!ev || ev[1] !== 'packet' || !da) continue;
              let msg; try { msg = JSON.parse(da[1]); } catch (e) { continue; }
              take(msg);
            }
            pump();
          }, function (e) { finish({ ok: false, code: 'no-answer', error: 'the node stream: ' + ((e && e.message) || e) }); });
        }
        pump();
        // The post leg is the shared mouth, spirit.core.ask, handed the
        // node's address; only the stream above is this function's own.
        const args = { to: peer, text: made.text };
        if (o.kind) args.kind = o.kind;
        // PATIENCE RIDES TOO (goal/G2.6): the node holds a busy post and retries it with backoff for this long
        // (peer.post's patienceMs, puppets/G2), so no caller loops by hand around "target is busy".
        if (Number(o.patienceMs) > 0) args.patienceMs = Number(o.patienceMs);
        spirit.core.ask('peer.post', args, base).then(function (res) {
          const b = res.body;
          if (res.status !== 200 || !b || b.ok !== true || !b.hash) { finish({ ok: false, code: 'not-posted', error: (b && b.error) || ('the node answered ' + res.status) }); return; }
          want = b.hash;
          const hit = early.filter(function (g) { return g.re === want; })[0];
          if (hit) finish(hit.body);
        }, function (e) { finish({ ok: false, code: 'not-posted', error: (e && e.message) || String(e) }); });
      });
    }, function (e) {
      return { ok: false, code: 'not-posted', error: 'the node stream could not open: ' + ((e && e.message) || e) };
    });
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
  // recorded about this file via annotateFile (kernel.js's Node side), via
  // the fs.annotations verb (no direct filesystem access from the
  // browser). Always resolves to an object — {} both when nothing's been
  // recorded and when the request itself fails — so callers never need a
  // null-check before reading .client.
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
  // ── HIS RELAYS AS A SCREEN WANTS THEM (puppets/G2) ──────────────────
  //
  // relay.status, which answered every relay whole, is gone: the node
  // answers relay.search (key/label pairs) and relay.get (one relay). A
  // screen that shows every relay he has, which is a handful, asks the
  // search with '*' and then gets each one, and this puts the answers back
  // into the shape those screens were written against, so each changes one
  // call and not its drawing. The node probes once for the search and the
  // gets together. `more` rides along: past one answer's cap the screen is
  // told there are relays it is not showing.
  spirit.core.relays = {
    status: function (name) {
      return spirit.core.ask('relay.search', { q: '*', name: name || '' }).then(function (found) {
        var s = found && found.body;
        if (!s || !s.ok) return found;
        return Promise.all((s.items || []).map(function (i) {
          return spirit.core.ask('relay.get', { key: i.key }).then(function (g) { return g && g.body; });
        })).then(function (gets) {
          var rows = [];
          var relayStatus = {};
          gets.forEach(function (g) {
            if (!g || !g.ok) return;
            rows.push(g.relay);
            if (g.report) relayStatus[g.key] = g.report;
          });
          var body = {
              name: s.name,
              rows: rows,
              ownedUrls: rows.filter(function (r) { return r.owned; }).map(function (r) { return r.url; }),
              claimedUrls: rows.filter(function (r) { return r.owned || r.claimed; }).map(function (r) { return r.url; }),
              mustPick: !!s.mustPick,
              relayStatus: relayStatus,
              more: !!s.more,
          };
          // The shape spirit.core.ask answers with, text included, since
          // some screens parse the text themselves.
          return { status: 200, text: JSON.stringify(body), body: body };
        });
      });
    },
  };

  // THE PAGE'S ONE STREAM (goal/G30.16; Andy: "the home page should need one stream only."). Every subscriber of
  // spirit.core.jobs shares it: a browser holds six connections to a host, and with a stream per subscriber two tabs
  // left nothing for a Desk send or an app's script, which then waited for good. The snapshot and every job as it
  // stands are kept here, so a subscriber that comes later is handed them at once.
  //
  // IT COMES BACK BY ITSELF, AND SAYS WHEN IT IS DOWN. Andy, 2026-09-30, cut off from both agents after his node
  // restarted: "this should work without a hickup." A browser retries an EventSource on its own until the server answers
  // it wrongly (as a restarting node can); then it is CLOSED for good. So an error is reported, a closed stream is
  // reopened, and the first open after being down is announced, so an app can ask again for what it missed.
  //
  // A wire, not a reader: packets (decoded server side, packet.decorate), what a relay this node owns did
  // (relay-event, to the owner alone) and contact renames (goal/G4.13) are handed on as they come; what they mean is
  // the subscriber's business.
  var streamSubs = [];
  var streamSource = null;
  var streamUp = false;
  var streamDown = false;
  var streamStopped = false;
  var streamWaiting = false;
  var streamJobs = new Map();
  function tellStream(name, arg) {
    streamSubs.slice().forEach(function (h) {
      if (typeof h[name] === 'function') { try { h[name](arg); } catch (e) { /* one subscriber's fault */ } }
    });
  }
  function openStream() {
    streamStopped = false;
    var source = streamSource = new EventSource('/api/events');
    source.onopen = function() {
      streamUp = true;
      tellStream('onConnection', true);
      if (streamDown) tellStream('onReconnect');
      streamDown = false;
    };
    source.onerror = function() {
      if (!streamDown) tellStream('onConnection', false);
      streamUp = false;
      streamDown = true;
      if (source.readyState === 2 && !streamStopped) setTimeout(function() { if (!streamStopped && streamSource === source) openStream(); }, 2000);
    };
    source.addEventListener('snapshot', function(e) {
      var jobs = JSON.parse(e.data).jobs || [];
      streamJobs.clear();
      jobs.forEach(function (j) { if (j && j.id) streamJobs.set(j.id, j); });
      tellStream('onSnapshot', jobs);
    });
    source.addEventListener('job-updated', function(e) {
      var job = JSON.parse(e.data);
      if (job && job.id) streamJobs.set(job.id, job);
      tellStream('onUpdate', job);
    });
    source.addEventListener('job-deleted', function(e) {
      var id = JSON.parse(e.data);
      streamJobs.delete(id);
      tellStream('onDelete', id);
    });
    source.addEventListener('packet', function(e) { tellStream('onPacket', JSON.parse(e.data)); });
    source.addEventListener('relay-event', function(e) { tellStream('onRelayEvent', JSON.parse(e.data)); });
    source.addEventListener('contact.rename', function(e) { tellStream('onContactRename', JSON.parse(e.data)); });
  }

  spirit.core.jobs = {
    // ONE STREAM PER PAGE (goal/G30.16; Andy: "the home page should need one stream only."). Every subscriber shares
    // the page's one EventSource: a browser holds six connections to a host, and three streams a tab left two tabs with
    // nothing for a Desk send or an app's script, which waited for good. A subscriber that comes after the snapshot is
    // handed the jobs as they stand now, and told the stream is up if it is; what it missed before that (the file tree's
    // create commands) is the page's mirror's to give (shell/js/spiritData.js), not the stream's to send again.
    subscribe: function(handlers) {
      handlers = handlers || {};
      // ON A FACE (goal/G30.11) the events come down the face's own stream, which the face shell holds.
      if (window.spirit && window.spirit.transport && typeof window.spirit.transport.events === 'function') return window.spirit.transport.events(handlers);
      streamSubs.push(handlers);
      // OPENED ONCE THE PAGE HAS PARSED: every subscriber its scripts make (the shell, the page's mirror) is then in
      // place before the first event, so none of them misses the file tree a connecting page is handed.
      if (!streamSource && !streamWaiting) {
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
          streamWaiting = true;
          document.addEventListener('DOMContentLoaded', function () { streamWaiting = false; if (streamSubs.length && !streamSource) openStream(); });
        } else openStream();
      }
      else if (streamSource) {
        if (handlers.onSnapshot) { try { handlers.onSnapshot(Array.from(streamJobs.values())); } catch (e) { /* one subscriber's fault */ } }
        if (streamUp && handlers.onConnection) { try { handlers.onConnection(true); } catch (e) { /* one subscriber's fault */ } }
      }
      return function unsubscribe() {
        streamSubs = streamSubs.filter(function (h) { return h !== handlers; });
        if (!streamSubs.length && streamSource) { streamStopped = true; streamSource.close(); streamSource = null; }
      };
    },
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
