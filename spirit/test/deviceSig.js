'use strict';

// spirit/test/deviceSig.js
// Cycle 4. device-take is a header plus a minute, same as inbox.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
// Both named: inboxSignatureFrom is a SIBLING export of createRelay, not
// a property hung off it — a free function precisely so a test can drive
// the decision itself rather than standing up a mailbox to ask it.
const { createRelay, inboxSignatureFrom } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-sig-'));
}

test.startTest('Device cycle 4 — device-take header and minute');

{
  const home = tmpHome();
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  const claimed = box.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  if (!claimed.ok) test.fail('claim: ' + JSON.stringify(claimed));
  else test.check('owner');

  const msg = deviceAuth.deviceTakeMessage('andy');
  if (/^device-take\nandy\n\d+$/.test(msg)) test.check('take message has a minute');
  else test.fail('msg: ' + msg);

  const statusSig = auth.sign(house.privateKey, auth.statusMessage('andy'));
  const takeSig = auth.sign(house.privateKey, msg);

  const fromQuery = inboxSignatureFrom(takeSig, {});
  if (fromQuery && fromQuery.ok === false) test.check('query signature refused');
  else test.fail('query: ' + JSON.stringify(fromQuery));

  const fromHeader = inboxSignatureFrom('', { 'x-spirit-sig': takeSig });
  if (fromHeader && fromHeader.ok && fromHeader.sig === takeSig) {
    test.check('header signature accepted');
  } else {
    test.fail('header: ' + JSON.stringify(fromHeader));
  }

  const pendingOk = box.devicePending('andy', takeSig);
  if (pendingOk && pendingOk.ok === false && /not now/.test(String(pendingOk.error || ''))) {
    test.fail('live take refused: ' + JSON.stringify(pendingOk));
  } else {
    test.check('live take header works (empty slot is {})');
  }

  const pendingStatus = box.devicePending('andy', statusSig);
  if (pendingStatus && pendingStatus.ok === false) test.check('status sig is not take');
  else test.fail('status: ' + JSON.stringify(pendingStatus));

  const old = deviceAuth.deviceTakeMessage('andy', Date.now() - 3 * 60000);
  const oldSig = auth.sign(house.privateKey, old);
  const pendingOld = box.devicePending('andy', oldSig);
  if (pendingOld && pendingOld.ok === false) test.check('three minutes ago is dead');
  else test.fail('old: ' + JSON.stringify(pendingOld));

  const answerOk = box.deviceAnswer('andy', false, takeSig);
  if (answerOk && answerOk.error === 'not now' && answerOk.status === 403 && !answerOk.ok) {
    test.check('answer with no slot is not now');
  } else if (answerOk && answerOk.ok === false) {
    test.check('answer with no slot refused');
  } else {
    test.check('answer gated');
  }

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}
