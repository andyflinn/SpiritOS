'use strict';

// spirit/run/spirit/netFence.js
// NET.FETCH CANNOT REACH THIS MACHINE (goal/G29.20).
//
//   Andy, 2026-10-18, reversing goal/G19.9: "fetch will not be able to reach ports on this machine, and agents may
//   use it." And on the LAN: "ok, we block only loopback on the same machine."
//
// This machine is a loopback address (127.0.0.0/8, ::1, the name localhost), an unspecified one (0.0.0.0, ::), which
// reach this machine when dialled, or one of this machine's own interface addresses; IPv4 written inside IPv6
// (::ffff:127.0.0.1) counts as its IPv4. Everything else is open: the rest of the LAN and link-local too, because a node binds 127.0.0.1 only and refuses any connection not from its own
// machine, so no other box's node can be reached through here, let alone as owner.
//
// THE ADDRESS, NOT THE NAME: lookup() is handed to http.request as its lookup, so the check is made on the address the
// name resolved to, at connect; a name that resolves to 127.0.0.1 is refused as 127.0.0.1 is. A target written as an
// address is never looked up, so the caller checks isThisMachine(hostname) itself before asking.

const os = require('os');
const dns = require('dns');
const netlib = require('net');

// THIS MACHINE'S OWN ADDRESSES TOO: a service bound to every interface answers on this machine's LAN address as on
// 127.0.0.1, and "ports on this machine" are reached either way. Read on every ask, so a new interface counts at once;
// other machines on the LAN stay open.
function ownAddresses() {
  const out = [];
  let all = {};
  try { all = os.networkInterfaces() || {}; } catch (e) { all = {}; }
  Object.keys(all).forEach(function (name) { (all[name] || []).forEach(function (i) { if (i && i.address) out.push(String(i.address).toLowerCase().replace(/%.*$/, '')); }); });
  return out;
}

function isThisMachine(address) {
  let a = String(address == null ? '' : address).trim().toLowerCase();
  if (a.charAt(0) === '[' && a.charAt(a.length - 1) === ']') a = a.slice(1, -1);
  if (a === 'localhost' || /\.localhost$/.test(a)) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1];
  const kind = netlib.isIP(a);
  if (kind && ownAddresses().indexOf(a.replace(/%.*$/, '')) !== -1) return true;
  if (kind === 4) return /^127\./.test(a) || a === '0.0.0.0';
  if (kind === 6) {
    let full = '';
    try { full = new netlib.SocketAddress({ address: a, family: 'ipv6' }).address; } catch (e) { full = a; }
    return full === '::1' || full === '::' || /^0*(:0*){6}:0*1$/.test(a) || /^0*(:0*){7}$/.test(a);
  }
  return false;
}

// A dns.lookup that refuses this machine: the error carries code 'this-machine'.
function lookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  const refuse = function (address) {
    const err = new Error('net.fetch does not reach this machine: ' + hostname + (address && address !== hostname ? ' is ' + address : ''));
    err.code = 'this-machine';
    return err;
  };
  if (isThisMachine(hostname)) { process.nextTick(callback, refuse(hostname)); return; }
  dns.lookup(hostname, options || {}, function (err, address, family) {
    if (err) return callback(err);
    const all = Array.isArray(address) ? address : [{ address: address, family: family }];
    const near = all.filter(function (x) { return isThisMachine(x.address); })[0];
    if (near) return callback(refuse(near.address));
    return callback(null, address, family);
  });
}

module.exports = { isThisMachine: isThisMachine, lookup: lookup };
