'use strict';
// spirit/run/spirit/app/testicle/data.js
// WHAT A CLIENT KNOWS OF TESTICLE'S SERVER, IN THE testicle FAMILY'S OWN FOLDER (goal/G41.28, goal/G47.1). A page loads it
// through spirit.require; it keeps what busy last answered in that page's spirit.data, under the node that served it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader asks spirit.data.testicle.data (below).
//   testicleBusy   'now' -> what busy last answered, true or false
// The server publishes no row of its own, so it translates nothing: a reader keeps what busy answered (keep).
(function () {
  var BUSY = 'testicleBusy';
  var NOW = 'now';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../spirit.js').require('spirit/data.js');
  D.makeFamily('testicle', function () {
    var HOME = D.viewAt(null, 'testicle');
    // THE READS AND THE ONE WRITE:
    //   keep(busy)   what busy answered, true or false; anything else lets it go
    //   busy()       what was kept, or null
    //   watch(fn)    fn(busy) on every change; answers its release
    //   branch       its whole path
    var testicleReads = {
      keep: function (busy) {
        if (busy === true || busy === false) HOME.set(BUSY + '/' + NOW, busy);
        else HOME.del(BUSY + '/' + NOW);
      },
      busy: function () { var b = HOME.get(BUSY + '/' + NOW); return b === true || b === false ? b : null; },
      // The row busy() reads, and only that: what it watches is what it answers.
      watch: function (fn) { return HOME.watch(BUSY + '/' + NOW, function () { if (typeof fn === 'function') fn(testicleReads.busy()); }); },
      get branch() { return HOME.path(BUSY); },
    };
    return testicleReads;
  });
}());
