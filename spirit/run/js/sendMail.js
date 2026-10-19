'use strict';

// spirit/run/js/sendMail.js
// THE RELAY SENDS MAIL THROUGH A DRIVER, NEVER A VENDOR (goal/G30.2). Andy, 2026-10-19: the core "must have a generic
// js/sendMail.js with a folder sendMail/ to go with it" — no app- or site-specific code in core. The vendors live in
// js/sendMail/<driver>.js, each exporting create(settings, fetch) answering { send } or null.
//
//   relay-state/mail.json   { "driver": "<name>", ...that driver's settings }
//
// Placed by the owner by hand on the relay box, never in git, a box or a chat. The driver is named in the file and
// nowhere else: a file without one sends no mail, with no fallback in core (decided by Andy). The name must be a
// plain word naming a file in sendMail/, so mail.json cannot load anything outside that folder.

const fs = require('fs');
const path = require('path');

const DRIVERS = path.join(__dirname, 'sendMail');

// { driver, send } for the relay's mail.json, or null when it sends no mail (no file, no driver, an unknown driver,
// or settings that driver will not take).
function createSender(rootDir, options) {
  let v = null;
  try { v = JSON.parse(fs.readFileSync(path.join(String(rootDir || ''), 'relay-state', 'mail.json'), 'utf8')); } catch (e) { return null; }
  if (!v || typeof v !== 'object') return null;
  const name = String(v.driver || '').trim();
  if (!/^[a-z][a-zA-Z0-9]*$/.test(name) || !fs.existsSync(path.join(DRIVERS, name + '.js'))) return null;
  let made = null;
  try { made = require(path.join(DRIVERS, name + '.js')).create(v, options && options.fetch); } catch (e) { made = null; }
  return made && typeof made.send === 'function' ? { driver: name, send: made.send } : null;
}

module.exports = { createSender: createSender };
