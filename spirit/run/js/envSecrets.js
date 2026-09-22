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
// A SEAM, NOT THE SHAPE. Andy, 2026-09-22: "a instrinisc app will
// maintain the allow list associated with that part of SpiritOS
// services." This list is code until that app exists; when it does, the
// owner keeps these entries through it, and the constant goes. Decided,
// not built — a new persist shape and an owner screen, so a UI session and
// a review (design/agents/GROK-REVIEWS.md). A design sitting for the proxy
// system comes first (Andy: "must come soon").

const ALLOWLIST = [
  { name: 'ANTHROPIC_API_KEY', hosts: ['api.anthropic.com'] },
  // Andy's Grok key, for agent reviews on a budget he grants
  // (process/js/grokReview). Andy, 2026-09-22: "this is where the
  // env-variable proxy-call in node should come in" — "may as well
  // excercise that aspect of the SpiritOS". The script never holds the
  // key; this node fills it in, and only for xAI's API.
  { name: 'GROK_API_KEY', hosts: ['api.x.ai'] },
  // Andy's xAI management key — read-only on xAI's side, pinned to his
  // address there, and READ-ONLY HERE TOO: GET only, to the management API
  // only, so a review can report the prepaid balance and nothing through
  // this node can change his account. The name is spelled as Andy set it.
  { name: 'GROK_MANAGMENT_KEY', hosts: ['management-api.x.ai'], methods: ['GET'] },
];

function allowed(varName, targetHost, method) {
  const entry = ALLOWLIST.find(function (row) { return row.name === varName; });
  if (!entry) return false;
  if (entry.hosts.indexOf(String(targetHost || '').toLowerCase()) === -1) return false;
  if (entry.methods && entry.methods.indexOf(String(method || 'GET').toUpperCase()) === -1) return false;
  return true;
}

function substitute(value, targetHost, method, env) {
  if (typeof value !== 'string') return value;
  const source = env || process.env;
  return value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, function (match, varName) {
    if (!allowed(varName, targetHost, method)) return match;
    return source[varName] !== undefined ? source[varName] : match;
  });
}

module.exports = { ALLOWLIST: ALLOWLIST, allowed: allowed, substitute: substitute };
