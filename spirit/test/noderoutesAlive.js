'use strict';

// spirit/test/noderoutesAlive.js
// goal/G19.16: the alpha public relay at https://noderoutes.net answers. Andy, 2026-10-12: "noderoutes.net has to go
// up and stay up. now. it's part of the alpha strategy, where spirit is my development releay (for us) and
// noderoutes.et will be the alpha public relay.", and, the relay up: "write a test that checks if noderoutes.net is
// alive."
//
// WHAT IS ASSERTED
//   1. A signed card ask on https://noderoutes.net's one door is answered over a certificate node trusts. It was
//      GET /api/relay/key until goal/G22.6 closed the relay's public door (Andy's decision: a relay answers a card ask
//      from a key it does not know with its key, on its one door).
//   2. It names the relay key recorded in goal/G19.16 (the key that ships with the install, goal/G19.15), so a box
//      rebuilt under the same name with a new identity is caught, not taken for alive.
//   3. Its owner is Andy's node key, as install-units wrote it.
// rule/11: through testSupport only; one card ask to the public relay, signed by a key made in memory, nothing
// written, no local node.

const test = require('./testSupport.js');
const door = require('./relayDoor');

const URL = 'https://noderoutes.net';
const RELAY_KEY = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
const OWNER_KEY = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';

test.startTest('goal/G19.16: noderoutes.net is alive');

door.cardAsk(URL).then(function (r) {
  test.subHeading('1. it answers a card ask over https');
  if (r.ok) test.check('a card ask on ' + URL + ' was answered, signed by the relay, over a trusted certificate');
  else test.fail('a card ask on ' + URL + ' was not answered as a relay: status ' + r.status + ' ' + String(r.text || '').slice(0, 120));

  const said = r.ok ? r.said : null;

  test.subHeading('2. it is the relay we ship');
  if (said && said.relayPublicKey === RELAY_KEY) test.check('it names the relay key recorded in goal/G19.16');
  else test.fail('the relay key is not the one recorded in goal/G19.16: ' + (said ? said.relayPublicKey : 'no card'));

  test.subHeading('3. it is owned by Andy\'s node');
  if (said && said.ownerKey === OWNER_KEY) test.check('its owner is Andy\'s node key');
  else test.fail('its owner is not Andy\'s node key: ' + (said ? said.ownerKey : 'no card'));

  test.reportSuccessFailureCount();
});
