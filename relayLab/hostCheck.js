#!/usr/bin/env node
'use strict';

// ── IS THIS BOX STILL TWO RELAYS? ────────────────────────────────────
//
//   node relayLab/hostCheck.js
//
// Portable, per relayLab/README.md: on spirit-3 it checks everything, on
// the Windows box it checks what can be seen from outside and says so.
// Reads only. Never writes relay-state, never starts a server, never
// needs root for anything it does (systemctl show and crontab -l are
// reads; crontab -l reads the crontab of whoever runs it, which on
// spirit-3 is root, which is spirit).
//
// WHY THIS EXISTS. Between 2026-09-14 and 2026-09-16, six faults of one
// shape surfaced, and they only became possible when a second relay
// appeared on the box:
//
//   install-units read systemd/${UNIT_NAME}.service   (the template)
//   tls wrote /etc/caddy/Caddyfile with >             (the site config)
//   cron-install swept every line with its marker     (the cron)
//   update's `| grep -q` never matched under pipefail (the restart)
//   an exported SPIRIT_UNIT_NAME outlived the cd      (the identity)
//   update read the lib.sh it had just replaced       (the timing)
//
// Every one was silent, every one was fine with a single clone, and
// every one failed TOWARD the live relay. Four were found by reading and
// two by watching a command do the wrong thing in front of us. That
// ratio is the argument for this file: the arrangement has more ways to
// collapse into one relay than anybody is going to hold in their head.
//
// So this asks the question directly, from the outside in. Two clones,
// two units, two ports, two domains, two crons, two Ed25519 identities —
// and it is the LAST of those that actually matters. The rest are how a
// box accidentally ends up with one.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = 8000;

let failures = 0;
let skipped = 0;

function line(tag, ok, detail) {
  const mark = ok === true ? 'ok ' : ok === false ? '!! ' : '   ';
  if (ok === false) failures++;
  if (ok === null) skipped++;
  console.log('  ' + mark + tag + (detail ? '  ' + detail : ''));
}

function say(s) { console.log('\n==> ' + s); }

// ── THE DEFAULTS LIVE IN lib.sh, SO READ THEM FROM lib.sh ────────────
//
// Restating `spirit-relay` / `65430` / `spirit.andyflinn.com` here would
// make this checker agree with a stale copy of the truth and report
// green while the box drifted. lib.sh writes them in one shape —
//
//   UNIT_NAME="${SPIRIT_UNIT_NAME:-spirit-relay}"
//
// — so take them from there and fail loudly if that shape ever changes,
// rather than quietly falling back to a guess. lab-install writes its
// four knobs the same way, so one reader covers both files.
function shellDefaults(relPath) {
  const src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  const out = {};
  const re = /^([A-Z_]+)="\$\{([A-Z_]+):-([^}]*)\}"/gm;
  let m;
  while ((m = re.exec(src)) !== null) out[m[2]] = m[3];
  return out;
}

// A clone's .env is its own word about what it is — the same file lib.sh
// now reads for itself. A clone without one takes the defaults, which is
// exactly what lib.sh does after unsetting the environment.
function readClone(dir, defaults) {
  if (!fs.existsSync(path.join(dir, 'bash', 'lib.sh'))) return null;
  const env = {};
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (raw) {
      const m = /^\s*(?:export\s+)?([A-Z_]+)=(.*)$/.exec(raw.trim());
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
  const pick = function (name) { return env[name] || defaults[name]; };
  return {
    dir: dir,
    hasEnv: fs.existsSync(envPath),
    unit: pick('SPIRIT_UNIT_NAME'),
    port: pick('SPIRIT_RELAY_PORT'),
    domain: pick('SPIRIT_RELAY_DOMAIN'),
    runDir: path.join(dir, 'spirit', 'run'),
  };
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error || r.status === null) return null;
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function getJson(urlStr) {
  return new Promise(function (resolve) {
    let target;
    try { target = new URL(urlStr); } catch (e) {
      resolve({ error: String(e.message || e) });
      return;
    }
    const req = https.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, error: 'not JSON: ' + body.slice(0, 80) }); }
      });
    });
    req.setTimeout(TIMEOUT_MS, function () { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', function (err) { resolve({ error: String(err.message || err) }); });
    req.end();
  });
}

(async function main() {
  const defaults = shellDefaults(path.join('bash', 'lib.sh'));
  const labKnobs = shellDefaults(path.join('bash', 'lab-install'));
  const onLinux = process.platform === 'linux';
  const haveSystemd = onLinux && !!sh('systemctl', ['--version']);

  console.log('hostCheck  node ' + process.version + '  ' + process.platform);
  console.log('           clone ' + REPO_ROOT);

  const wanted = ['SPIRIT_UNIT_NAME', 'SPIRIT_RELAY_PORT', 'SPIRIT_RELAY_DOMAIN'];
  const missing = wanted.filter(function (k) { return !defaults[k]; });
  if (missing.length) {
    console.log('\n  !! cannot read defaults out of bash/lib.sh: ' + missing.join(', '));
    console.log('     the `VAR="${SPIRIT_VAR:-default}"` shape changed. Fix this file before trusting it.');
    process.exit(2);
  }

  // ── WHICH CLONES ARE ON THIS BOX ───────────────────────────────────
  say('clones');
  const labDir = process.env.SPIRIT_LAB_DIR || labKnobs.SPIRIT_LAB_DIR;
  const candidates = [REPO_ROOT];
  if (path.resolve(labDir) !== REPO_ROOT) candidates.push(labDir);
  // Run from the lab clone and the MAIN one is the other half.
  const mainDir = process.env.SPIRIT_CLONE_DIR || '/root/SpiritOS';
  if (candidates.indexOf(mainDir) === -1 && path.resolve(mainDir) !== REPO_ROOT) {
    candidates.push(mainDir);
  }

  const clones = candidates.map(function (d) { return readClone(d, defaults); })
    .filter(function (c) { return c !== null; });

  clones.forEach(function (c) {
    line(c.unit, null, c.dir + '  :' + c.port + '  ' + c.domain +
      (c.hasEnv ? '  (.env)' : '  (defaults)'));
  });

  // ── THE PUBLIC HALF RUNS FROM ANYWHERE ─────────────────────────────
  //
  // On the Windows box there is one clone and no systemd, but both
  // relays are still on the internet and both still have to be two
  // relays. So the TLS section works off DOMAINS, which need no clone to
  // exist locally — and the lab's is where lab-install says it is. That
  // is the half of this check the work machine can run, and it is the
  // half that catches the failure that actually costs something.
  const domains = clones.map(function (c) { return c.domain; });
  if (domains.indexOf(labKnobs.SPIRIT_LAB_DOMAIN) === -1) {
    domains.push(labKnobs.SPIRIT_LAB_DOMAIN);
  }

  if (clones.length === 1) {
    line('one clone here', null, 'host checks need both clones on this box; ' +
      domains.length + ' domain(s) still checked over TLS');
  }

  // ── NOTHING IS SHARED ──────────────────────────────────────────────
  //
  // THE CORE CHECK. A second relay that shares any one of these is not a
  // second relay — it is the live one wearing a different directory, and
  // that is precisely how each of the six faults presented.
  if (clones.length > 1) {
    say('two clones stay two');
    [['unit', 'systemd would install one unit over the other'],
     ['port', 'the second to start would fail to bind, or take the first offline'],
     ['domain', 'one certificate, one census, one identity'],
     ['dir', 'not two clones at all']].forEach(function (row) {
      const key = row[0];
      const seen = {};
      const clash = clones.filter(function (c) {
        if (seen[c[key]]) return true;
        seen[c[key]] = true;
        return false;
      });
      if (clash.length === 0) line('distinct ' + key, true);
      else line('distinct ' + key, false, 'SHARED: ' + clash[0][key] + ' — ' + row[1]);
    });
  }

  // ── WHAT SYSTEMD ACTUALLY HAS ──────────────────────────────────────
  //
  // Not what the clone intends — what is installed. install-units wrote
  // one unit over the other for a whole day and nothing said so until a
  // restart pointed the public box at the lab's directory.
  say('units');
  if (!haveSystemd) {
    line('systemd', null, 'not this box — run on spirit-3 for unit, cron and caddy checks');
  } else {
    clones.forEach(function (c) {
      const show = sh('systemctl', ['show', c.unit + '.service',
        '-p', 'WorkingDirectory', '-p', 'ExecStart', '-p', 'ActiveState', '-p', 'UnitFileState']);
      if (!show || show.status !== 0) {
        line(c.unit, false, 'systemd does not know this unit');
        return;
      }
      const props = {};
      show.out.split('\n').forEach(function (l) {
        const i = l.indexOf('=');
        if (i > 0) props[l.slice(0, i)] = l.slice(i + 1);
      });

      const wd = props.WorkingDirectory || '';
      if (wd === c.runDir) line(c.unit + ' WorkingDirectory', true, wd);
      else line(c.unit + ' WorkingDirectory', false, wd + '  != ' + c.runDir + ' — this unit runs the OTHER clone');

      const exec = props.ExecStart || '';
      if (exec.indexOf('--port ' + c.port) !== -1 || exec.indexOf('--port') === -1) {
        line(c.unit + ' port', true, ':' + c.port);
      } else {
        line(c.unit + ' port', false, 'unit says ' + (/--port (\S+)/.exec(exec) || [])[1] +
          ', .env says ' + c.port + ' — reinstall with ./bash/install-units');
      }

      const live = props.ActiveState === 'active';
      line(c.unit + ' state', live, props.ActiveState + ', ' + props.UnitFileState);
    });
  }

  // ── ONE CRON LINE PER CLONE, CARRYING NO ENVIRONMENT ───────────────
  //
  // Two separate rules, and both were broken in turn. The line must name
  // THIS clone's update script, and it must carry no SPIRIT_ variable —
  // a line that states its own unit is a line that can state the wrong
  // one, and on 2026-09-16 one did: live clone's code, lab's service.
  say('update cron');
  const cron = haveSystemd ? sh('crontab', ['-l']) : null;
  if (!cron) {
    line('crontab', null, 'not readable here');
  } else {
    const lines = cron.out.split('\n').filter(function (l) {
      return l.indexOf('spirit-host-update') !== -1 && !/^\s*#/.test(l);
    });
    clones.forEach(function (c) {
      const mine = lines.filter(function (l) { return l.indexOf(c.dir + '/bash/update') !== -1; });
      if (mine.length === 0) {
        line(c.unit + ' cron', false, 'no line runs ' + c.dir + '/bash/update — this clone never updates');
        return;
      }
      if (mine.length > 1) {
        line(c.unit + ' cron', false, mine.length + ' lines run this clone — they will fight');
        return;
      }
      const l = mine[0];
      if (/SPIRIT_[A-Z_]+=/.test(l)) {
        line(c.unit + ' cron', false, 'the line carries an environment: ' +
          (/SPIRIT_[A-Z_]+=\S+/.exec(l) || [])[0] + ' — run ./bash/cron-install from ' + c.dir);
      } else if (l.indexOf('spirit-host-update:' + c.unit) === -1) {
        line(c.unit + ' cron', false, 'runs this clone but is marked for another unit');
      } else {
        line(c.unit + ' cron', true, 'one line, no environment, marked ' + c.unit);
      }
    });
    const orphans = lines.filter(function (l) {
      return !clones.some(function (c) { return l.indexOf(c.dir + '/bash/update') !== -1; });
    });
    orphans.forEach(function (l) {
      line('orphan cron', false, l.replace(/\s+/g, ' ').slice(0, 100));
    });
  }

  // ── CADDY IS ADDITIVE ──────────────────────────────────────────────
  //
  // tls used to write the main Caddyfile with `>`, so running it from a
  // second clone replaced the live relay's config with the lab's. One
  // file per domain now, and the main file imports them.
  say('caddy');
  if (!onLinux) {
    line('caddy', null, 'not this box');
  } else if (!fs.existsSync('/etc/caddy/Caddyfile')) {
    line('caddy', null, 'no /etc/caddy/Caddyfile — caddy is not the front door here');
  } else {
    const main = fs.readFileSync('/etc/caddy/Caddyfile', 'utf8');
    if (/^\s*import\s+sites\//m.test(main)) line('Caddyfile imports sites/', true);
    else line('Caddyfile imports sites/', false, 'the main file is not additive — ./bash/tls will refuse to reload');
    clones.forEach(function (c) {
      const site = '/etc/caddy/sites/' + c.domain + '.caddy';
      if (fs.existsSync(site)) line(c.domain + ' site file', true, site);
      else line(c.domain + ' site file', false, 'missing ' + site + ' — run ./bash/tls from ' + c.dir);
    });
  }

  // ── AND THE ONE THAT ACTUALLY MATTERS ──────────────────────────────
  //
  // Everything above is plumbing. What makes lab.andyflinn.com a
  // different RELAY is its own Ed25519 identity, and that is the thing
  // members pin. Two domains answering with the SAME key means one relay
  // is serving both names and every peer that pinned them is holding a
  // key for a relay it has never actually spoken to.
  //
  // This runs from anywhere with a network — it is the half of the check
  // the Windows box can do.
  say('identity, over TLS');
  const keys = {};
  for (const domain of domains) {
    const r = await getJson('https://' + domain + '/api/relay/who');
    if (r.error || r.status !== 200) {
      line(domain, false, r.error || ('HTTP ' + r.status));
      continue;
    }
    // `relayPublicKey`, and it is NOT the owner's key. The owner's is the
    // `owner:true` row in `peers`; this is the box's own Ed25519 identity,
    // made once on the first --relay boot, and it is the one a member
    // pins in relayKeys.json. Two relays may legitimately share an owner
    // — spirit-3 and the lab nearly did — but they can never share this.
    const key = r.json.relayPublicKey || '';
    const label = r.json.relayLabel || '';
    // AN UNCLAIMED PUBLIC RELAY IS FIRST-CLAIM-IS-OWNER, and certificate
    // transparency publishes the hostname the moment the cert issues.
    // lab.andyflinn.com sat open for about forty minutes on 2026-09-15.
    const owner = (r.json.peers || []).filter(function (p) { return p && p.owner === true; })[0];
    line(domain, true, 'HTTP 200  ' + (r.json.peers || []).length + ' peers' +
      (label ? '  "' + label + '"' : ''));
    if (owner) line('  claimed', true, 'owner is ' + owner.publicLabel);
    else line('  claimed', false, 'NO OWNER — open on the public internet, first claim wins it');
    if (!key) {
      line('  relay key', false, 'no relayPublicKey published — restart it, this box predates the key');
    } else if (keys[key]) {
      line('  relay key', false, 'IDENTICAL to ' + keys[key] + ' — one relay answering to two names');
    } else {
      keys[key] = domain;
      line('  relay key', true, key.slice(-16));
    }

    // ── AND IS IT RUNNING THE CODE WE THINK IT IS ────────────────────
    //
    // /api/version is public on purpose — "the question a deploy check
    // asks must not need a private key". This is the read half of remote
    // update: cron pulls, and this says whether it landed. A clone that
    // is `dirty` has been edited on the box, which `reset --hard` will
    // silently throw away at the next tick.
    const v = await getJson('https://' + domain + '/api/version');
    if (v.error || v.status !== 200) {
      line('  version', null, v.error || ('HTTP ' + v.status));
    } else {
      const up = Math.round((Date.now() - Date.parse(v.json.startedAt)) / 60000);
      line('  running', true, v.json.commit + '  up ' + up + ' min');
      if (v.json.dirty) line('  clean checkout', false, 'DIRTY — the next update will discard those edits');
      if (v.json.untracked) line('  untracked', null, v.json.untracked + ' file(s) on the box');
    }
  }

  console.log();
  if (failures === 0) {
    console.log('  ' + clones.length + ' clone(s) checked — nothing shared, nothing missing' +
      (skipped ? '  (' + skipped + ' check(s) not possible here)' : ''));
  } else {
    console.log('  ' + failures + ' problem(s)' + (skipped ? ', ' + skipped + ' not checkable here' : ''));
  }
  process.exit(failures === 0 ? 0 : 1);
})();
