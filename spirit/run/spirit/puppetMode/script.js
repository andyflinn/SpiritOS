'use strict';
require('../script.js');

// spirit/run/spirit/puppetMode/script.js
// A NODE OWNED BY ANOTHER NODE.
//
// One unit (goal/G49.24, box v18; Andy: "the \"owner\" shit is already handled by the grant system"): the owner door, its
// command switch and the sender behind them went; who owns a node stays, the one thing kept hard-coded.
//
//   puppetIn(rootDir, log)       whose puppet this node is, read on every call
//
// A puppet is a node OWNED by another node's ID (Andy: "pupped is the fate of having an owner
// that is not the self"). The owner's key is spirit/state/owner.json, which no app can reach.

// A node is a puppet when spirit/state/owner.json names a key that is not its
// own (Andy: "pupped is the fate of having an owner that is not the self").
// Read on every call, so an owner edit is seen at once.
function puppetIn(rootDir, log) {
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  const say = log || function () {};
  let moaned = null;
  return function () {
    let broken = null;
    const owner = auth.loadOwner(String(rootDir || ''), function (raw) { broken = raw; });
    if (broken !== null && broken !== moaned) {
      moaned = broken;
      say('owner.json names no owner as { "owner": "MCowBQYDK2VwAyEA..." }, so this node has no owner until it is fixed');
    }
    if (broken === null) moaned = null;
    if (!owner) return { puppet: false, owner: '' };
    const self = auth.loadIdentity(String(rootDir || ''));
    if (self.publicKey === owner) return { puppet: false, owner: '' };
    return { puppet: true, owner: owner };
  };
}

module.exports = {
  puppetIn: puppetIn,
};
