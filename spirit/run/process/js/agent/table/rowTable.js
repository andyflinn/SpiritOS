'use strict';

// spirit/run/process/js/agent/table/rowTable.js
// ONE KEYED TABLE OF agent.db AND ITS ONE VERB (goal/G41.4), what the provider, model, persona and job tables share; each
// table's server.js names its own fields and nothing else. The contract and the test: ../test/agent.md and
// ../test/agent.js.
//
// EVERY ROW IS KEYED AS THE SHADOW ROLL KEYS A PEER (Andy, box v22: "keyed by ID same as the shadow-roll"; "the ID-key for
// each row of these tables is generated at \"add-row\", including the rest of the key-set stored on that table row"): its
// id is the public key of a whole identity, the one maker of it spirit/relayAuth.js generateIdentity, and its private
// key, seal public key and seal private key sit on the row beside it.
//
// THE SECRETS NEVER LEAVE THE AGENT PROCESS (Andy: an API_KEY "will never reach the browser or any place outside of the
// agent process except the model providers API"; "The private halves of that set stay in the agent process"): no
// answer and no row on the stream carries privateKey, sealPrivateKey or a field the table names secret. In place of a
// secret field the row says whether it is set (apiKeySet).
//
// THE VERB IS FLAT, AS EVERY FAMILY VERB IS (cw, named for the red): <table> {op, ...fields}
//   add {fields}       a new row with its key set; answers { id }
//   set {id, fields}   changes the fields it names, keeps the rest; answers { id }
//   delete {id}        removes the row; answers { id }
//   get {id}           the row without its secrets; answers the row
//   search {text}      the rows ranked against the words, best first, cut to one answer; answers { items, more }
// Any other op is refused. Every change is published as { agent: { table, row } } or { agent: { table, id, removed } }.
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const { generateIdentity } = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const { createProbabilityBucket } = require(path.join(RUN, 'spirit', 'probabilityBucket.js'));
const { probabilityStringObjectMatch } = require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

const KEYSET = ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey'];
const PRIVATE = ['privateKey', 'sealPrivateKey'];
// What every row has beside its key set, with its rule (spirit.js's standard). EVERY ROW HAS AN ICON (Andy, on G41.4:
// "all table rows will have an icon, by default the tables icon"): a glyph, which the page's Add sets to its table's
// icon and its editor lets him choose.
const COMMON = { icon: 'text?', label: 'name?', description: 'description?' };
// One answer is what appServer lets leave, measured on the whole body.
const SEARCH_ROOM = limits.ANSWER_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');

function refuse(code, why) { const e = new Error(why); e.refusal = code; e.extra = { why: why }; return e; }

// The table's SQL type of a field from its rule: a bool is 0 or 1, a list is kept as JSON text.
function sqlType(rule) { return String(rule).replace(/\?$/, '') === 'bool' ? 'INTEGER' : 'TEXT'; }

// def: { name, fields: { field: rule }, secret: [field], check(fields, db) -> why or '', shows(row) -> fields shown too,
//   listed: [field] the fields its list shows, which alone a search answers beside the id (icon and label by default) }
function rowTable(db, def, publish) {
  const name = def.name;
  const fields = Object.assign({}, COMMON, def.fields);
  const secret = def.secret || [];
  // The fields its list shows, all a search answers beside the id: icon and label, unless the table names its own.
  const listed = Array.isArray(def.listed) ? def.listed : ['icon', 'label'];
  const t = '"' + name + '"';
  db.exec('CREATE TABLE IF NOT EXISTS ' + t + ' (id TEXT PRIMARY KEY, privateKey TEXT NOT NULL, sealPublicKey TEXT NOT NULL, ' +
    'sealPrivateKey TEXT NOT NULL, ' + Object.keys(fields).map(function (f) {
      return '"' + f + '" ' + sqlType(fields[f]) + ' NOT NULL DEFAULT ' + (sqlType(fields[f]) === 'INTEGER' ? '0' : "''");
    }).join(', ') + ')');
  // A TABLE MADE BEFORE A FIELD WAS: the field is added to it, empty, so a node's agent.db takes the new shape at start
  // (the icon came after the first tables were made).
  const have = db.prepare('PRAGMA table_info(' + t + ')').all().map(function (c) { return c.name; });
  Object.keys(fields).forEach(function (f) {
    if (have.indexOf(f) !== -1) return;
    db.exec('ALTER TABLE ' + t + ' ADD COLUMN "' + f + '" ' + sqlType(fields[f]) + ' NOT NULL DEFAULT ' + (sqlType(fields[f]) === 'INTEGER' ? '0' : "''"));
  });
  const q = {
    get: db.prepare('SELECT * FROM ' + t + ' WHERE id = ?'),
    all: db.prepare('SELECT * FROM ' + t + ' ORDER BY label, id'),
    del: db.prepare('DELETE FROM ' + t + ' WHERE id = ?'),
  };

  // A row as it may leave the process: no private half, no secret, each secret's set flag in its place.
  function shown(r) {
    if (!r) return null;
    const out = {};
    Object.keys(r).forEach(function (k) {
      if (PRIVATE.indexOf(k) !== -1 || secret.indexOf(k) !== -1) return;
      const rule = String(fields[k] || '').replace(/\?$/, '');
      out[k] = rule === 'bool' ? r[k] === 1 : rule === 'list' ? JSON.parse(r[k] || '[]') : r[k];
    });
    secret.forEach(function (k) { out[k + 'Set'] = !!r[k]; });
    // What the table says with each row and keeps nowhere (the model's providerIcon, goal/G41.18).
    if (def.shows) Object.assign(out, def.shows(out));
    return out;
  }
  // A field as the table keeps it.
  function stored(f, v) {
    const rule = String(fields[f]).replace(/\?$/, '');
    return rule === 'bool' ? (v ? 1 : 0) : rule === 'list' ? JSON.stringify(v) : v;
  }

  // Which arguments each op takes, checked by spirit.js's rules (spirit.check), so a refusal says why.
  const byOp = {
    add: Object.assign({ op: 'id' }, fields),
    set: Object.assign({ op: 'id', id: 'key' }, fields),
    delete: { op: 'id', id: 'key' },
    get: { op: 'id', id: 'key' },
    search: { op: 'id', text: 'text?' },
  };
  function the(a) {
    const r = q.get.get(String(a.id));
    if (!r) throw refuse('no-such-row', name + ' has no row ' + a.id);
    return r;
  }
  function given(a) { return Object.keys(fields).filter(function (f) { return a[f] !== undefined; }); }

  const verb = {
    request: { op: '' }, reply: {},
    accepts: function (a) { return !!a && typeof a === 'object' && !Array.isArray(a); },
    handler: function (a) {
      const spec = byOp[a.op];
      if (!spec) throw refuse('bad-request', name + ': op is one of ' + Object.keys(byOp).join(', '));
      const bad = spirit.check(name, spec, a);
      if (bad) throw refuse(bad.code === 'no-such-argument' ? 'no-such-argument' : 'bad-request', bad.message);
      const why = def.check ? def.check(a, db) : '';
      if (why) throw refuse('bad-request', name + ': ' + why);
      if (a.op === 'add') {
        const key = generateIdentity('');
        const set = given(a);
        db.prepare('INSERT INTO ' + t + ' (' + KEYSET.concat(set).map(function (c) { return '"' + c + '"'; }).join(', ') + ') VALUES (' +
          KEYSET.concat(set).map(function () { return '?'; }).join(', ') + ')')
          .run(...[key.publicKey, key.privateKey, key.sealPublicKey, key.sealPrivateKey].concat(set.map(function (f) { return stored(f, a[f]); })));
        publish({ agent: { table: name, row: shown(q.get.get(key.publicKey)) } });
        return { id: key.publicKey };
      }
      if (a.op === 'set') {
        the(a);
        const set = given(a);
        if (set.length) {
          db.prepare('UPDATE ' + t + ' SET ' + set.map(function (f) { return '"' + f + '" = ?'; }).join(', ') + ' WHERE id = ?')
            .run(...set.map(function (f) { return stored(f, a[f]); }).concat([a.id]));
        }
        publish({ agent: { table: name, row: shown(q.get.get(a.id)) } });
        return { id: a.id };
      }
      if (a.op === 'delete') {
        the(a);
        q.del.run(a.id);
        if (def.deleted) def.deleted(a.id);
        publish({ agent: { table: name, id: a.id, removed: true } });
        return { id: a.id };
      }
      if (a.op === 'get') return shown(the(a));
      // search: every row ranked against the words over what it shows; with no words, all of them by label.
      const words = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      let n = 0;
      q.all.all().forEach(function (r) {
        const row = shown(r);
        const flat = {};
        Object.keys(row).forEach(function (k) { if (typeof row[k] === 'string' && k !== 'id' && k !== 'sealPublicKey') flat[k] = row[k]; });
        const score = words ? Number(probabilityStringObjectMatch(words, flat)) || 0 : 1;
        n += 1;
        // A FOUND ROW CARRIES ITS ID AND WHAT ITS LIST SHOWS, NOTHING MORE (Andy, on G41.18: "only the ID and the fields
        // shown in a table, that's all it needs"): the keys and the rest stay for get, so one answer holds four times
        // the rows. It is ranked by all it shows, above.
        const slim = { id: row.id };
        listed.forEach(function (k) { if (row[k] !== undefined) slim[k] = row[k]; });
        if (score > 0) bucket.seatFor(score * (1 - 1e-9) + 1e-9 / (1 + n), { key: row.id, label: JSON.stringify(slim) });
      });
      const r = bucket.serialize(null, SEARCH_ROOM);
      return { items: r.items, more: !!r.more };
    },
  };
  // has(id): the row is there; label(id), icon(id): its label and its icon, '' when it is not (a grant shows its job by
  // them).
  return {
    verb: verb,
    has: function (id) { return !!q.get.get(String(id)); },
    label: function (id) { const r = q.get.get(String(id)); return r ? String(r.label || '') : ''; },
    icon: function (id) { const r = q.get.get(String(id)); return r ? String(r.icon || '') : ''; },
  };
}

module.exports = { rowTable: rowTable };
