'use strict';

// spirit/run/js/envSecrets.js
// WHICH SECRET MAY GO WHERE — the ${ENV:NAME} placeholders `net.fetch`
// fills in on the node's side (server.js, handleGenericProxy).
//
// Moved out of server.js on 2026-09-22, when a third secret arrived that
// needed a gate the list could not express, so the rule could be tested
// directly rather than only through a running node.
//
// A caller sends {"headers": {"x-api-key": "${ENV:ANTHROPIC_API_KEY}"}} and
// the real secret is filled in here, server-side, right before the
// outbound fetch, so it never has to exist in browser-visible code or in a
// script. This is credential-SCOPING infrastructure, not app-specific
// knowledge — the proxy still knows nothing about what any particular API
// looks like or does; it knows which secrets it may touch, and where each
// may go. Add a name only when something genuinely needs to reference it.
//
// ── A SECRET IS SCOPED BY NAME, BY RECIPIENT, AND BY WHAT IT MAY DO ─────
//
// The name alone was not enough: any caller could post
// {"url":"https://somewhere-else","headers":{"x-api-key":"${ENV:ANTHROPIC_API_KEY}"}}
// and the server would hand the real key to a host of the caller's
// choosing. So each entry pairs a name with its hosts. And a key that can
// CHANGE things may carry `methods`: the verbs it may be sent with. A
// management key limited to GET cannot be used through this node to write,
// whatever the caller asks for and whatever the key itself could do.
//
// Anything not allowed leaves the literal placeholder, and the target
// rejects the bad auth — never a silent substitution of nothing.
//
// THE LIST IS THE OWNER'S NOW, NOT CODE (2026-09-22). It moved to a node
// file, relay-state/proxy.json, kept by proxyList.js and changed only
// through the proxy verbs. Andy: "on the core-side it's primarily about
// having a configuration file for allowed key/website combinations". This
// module only applies it: the entries are passed in, and default to the
// list a fresh node starts with.
const proxyList = require('./proxyList');

function entriesOr(entries) {
  return Array.isArray(entries) ? entries : proxyList.DEFAULTS.entries;
}

function allowed(varName, targetHost, method, entries) {
  const host = String(targetHost || '').toLowerCase();
  const verb = String(method || 'GET').toUpperCase();
  return entriesOr(entries).some(function (e) {
    return e.key === varName && e.host === host && e.open !== false &&
      (!e.methods || e.methods.indexOf(verb) !== -1);
  });
}

// The ${ENV:NAME}s a value names, for the gate to ask about.
function named(value) {
  const out = [];
  if (typeof value !== 'string') return out;
  value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, function (m, k) { if (out.indexOf(k) === -1) out.push(k); return m; });
  return out;
}

function substitute(value, targetHost, method, env, entries) {
  if (typeof value !== 'string') return value;
  const source = env || process.env;
  return value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, function (match, varName) {
    if (!allowed(varName, targetHost, method, entries)) return match;
    return source[varName] !== undefined ? source[varName] : match;
  });
}

module.exports = { allowed: allowed, substitute: substitute, named: named };
