'use strict';

// The ICON table read the other way round, so a person can be offered a
// choice from it (iconIndex.js).
//
// Two things this file exists to hold down:
//
//   1. A line is a GLYPH, not a key. Aliases are deliberate — ❌ answers
//      to NO, ERROR and DELETE — and a chooser that listed keys would
//      offer the same picture three times and call them different icons.
//   2. Exclusion is by glyph for the same reason. Contacts and Groups
//      both shipped 👥 while holding different keys; an exclusion keyed
//      on names would have struck one and left the aliases behind, which
//      is how the collision gets back in.

const test = require('./testSupport.js');
const iconIndex = require('../run/js/iconIndex.js');
const spirit = require('../run/js/kernel.js');

const ICON = spirit.core.const.ICON;

// A small table with the interesting shapes in it: one plain glyph, one
// aliased three ways, one aliased twice. Hand-written rather than sliced
// out of ICON so the ordering assertions below say something even after
// somebody edits kernel.js.
const SAMPLE = {
  ROLODEX: '📇',
  DELETE: '❌',
  ERROR: '❌',
  NO: '❌',
  DOCUMENT: '📄',
  FILE: '📄',
  FOLDER: '📁',
};



test.subHeading('One line per glyph, carrying every name it answers to');

{
  const choices = iconIndex.choices(SAMPLE, []);

  if (choices.length === 4) {
    test.check('seven keys over four glyphs comes back as four lines');
  } else {
    test.fail('lines: ' + choices.length + ' — ' + JSON.stringify(choices.map(function (c) { return c.glyph; })));
  }

  const cross = choices.filter(function (c) { return c.glyph === '❌'; })[0];
  if (cross && cross.keys.join(',') === 'DELETE,ERROR,NO') {
    test.check('and an aliased glyph carries all three of its names, in the order the table declares them');
  } else {
    test.fail('❌ line: ' + JSON.stringify(cross));
  }

  // The format Andy asked for: the glyph, then every term it is keyed
  // under. The glyph itself is not in the label — it is drawn in its own
  // column, so that a list of 129 of them scans down the left edge.
  if (cross && cross.label === 'Delete, Error, No') {
    test.check('and reads as "Delete, Error, No", with the glyph left to its own column');
  } else {
    test.fail('❌ label: ' + (cross && cross.label));
  }

  // Which of the names is "the" name has to be answered the same way on
  // every machine and after every reload. Declaration order answers it;
  // enumeration order would answer it differently the day somebody
  // reorders kernel.js, and nothing would say so.
  if (cross && cross.key === 'DELETE' && iconIndex.keyFor(SAMPLE, '❌') === 'DELETE') {
    test.check('the first name a glyph is declared under is its canonical key');
  } else {
    test.fail('canonical key: ' + JSON.stringify({ line: cross && cross.key, keyFor: iconIndex.keyFor(SAMPLE, '❌') }));
  }

  if (iconIndex.keyFor(SAMPLE, '🦄') === null) {
    test.check('and a glyph the table does not carry has no key at all');
  } else {
    test.fail('keyFor(🦄): ' + iconIndex.keyFor(SAMPLE, '🦄'));
  }
}

test.subHeading('Excluding strikes the glyph, not the name');

{
  // The Contacts/Groups case, in miniature. Strike the picture and every
  // name for it goes; strike a name and the aliases would have carried
  // the collision straight back through.
  const choices = iconIndex.choices(SAMPLE, ['❌']);
  const names = choices.reduce(function (all, c) { return all.concat(c.keys); }, []);

  if (names.indexOf('DELETE') === -1 && names.indexOf('ERROR') === -1 && names.indexOf('NO') === -1) {
    test.check('excluding ❌ removes DELETE, ERROR and NO together');
  } else {
    test.fail('names left: ' + names.join(','));
  }

  if (choices.length === 3) {
    test.check('and takes exactly one line with it');
  } else {
    test.fail('lines left: ' + choices.length);
  }

  // What the Apps panel does with it: hand over every glyph another app
  // is already showing and the taken ones are simply not on offer, so
  // setAppOverride's icon-collision refusal has nothing left to refuse.
  const narrowed = iconIndex.choices(SAMPLE, ['❌', '📄', '📁']);
  if (narrowed.length === 1 && narrowed[0].glyph === '📇') {
    test.check('and a caller may strike as many as it likes at once');
  } else {
    test.fail('after striking three: ' + JSON.stringify(narrowed));
  }

  // No exclusions at all is the ordinary case, and must not be special.
  if (iconIndex.choices(SAMPLE).length === 4 && iconIndex.choices(SAMPLE, null).length === 4) {
    test.check('while excluding nothing offers the whole pool');
  } else {
    test.fail('unfiltered: ' + iconIndex.choices(SAMPLE).length);
  }
}

test.subHeading('The filter reads every name on the line');

{
  const cross = iconIndex.choices(SAMPLE, []).filter(function (c) { return c.glyph === '❌'; })[0];

  // The reason for building the widget instead of using a native
  // <select>. Native type-ahead matches a prefix of the whole option
  // text, and every line here starts with the glyph, so it could only
  // ever have been reached by typing the emoji. Here `del` finds ❌
  // through a name that is not even the one at the head of the line.
  if (iconIndex.matches(cross, 'del')) {
    test.check('typing "del" finds ❌ through DELETE');
  } else {
    test.fail('del did not match ' + JSON.stringify(cross.keys));
  }

  if (iconIndex.matches(cross, 'ERR') && iconIndex.matches(cross, 'no')) {
    test.check('and so do its other names, in either case');
  } else {
    test.fail('ERR/no did not match');
  }

  // Anywhere in the name, not just its start — `rror` is a poor thing to
  // type but a good thing to prove, because prefix-only is exactly the
  // limit we left the native widget to escape.
  if (iconIndex.matches(cross, 'rror')) {
    test.check('matched anywhere in a name, not only at its start');
  } else {
    test.fail('rror did not match');
  }

  if (!iconIndex.matches(cross, 'folder')) {
    test.check('and a name from another line does not match');
  } else {
    test.fail('folder matched the ❌ line');
  }

  if (iconIndex.matches(cross, '') && iconIndex.matches(cross, '   ')) {
    test.check('an empty filter matches everything, so the closed list is the whole pool');
  } else {
    test.fail('the empty filter excluded a line');
  }
}

test.subHeading('Against the table this actually runs on');

{
  const choices = iconIndex.choices(ICON, []);
  const glyphs = choices.map(function (c) { return c.glyph; });
  const distinct = Object.keys(ICON).reduce(function (seen, key) {
    seen[ICON[key]] = true;
    return seen;
  }, Object.create(null));

  if (glyphs.length === Object.keys(distinct).length) {
    test.check('every distinct glyph in ICON gets a line — ' + glyphs.length + ' of them');
  } else {
    test.fail('lines ' + glyphs.length + ' vs distinct glyphs ' + Object.keys(distinct).length);
  }

  // The property the whole file is for: what a person is choosing from is
  // a list of pictures, and no picture is on it twice.
  const duplicated = glyphs.filter(function (g, i) { return glyphs.indexOf(g) !== i; });
  if (duplicated.length === 0) {
    test.check('and no glyph appears on two lines');
  } else {
    test.fail('duplicated glyphs: ' + duplicated.join(' '));
  }

  // Every key survives somewhere, or the index would be quietly losing
  // names off the ends of lines.
  const namesCarried = choices.reduce(function (n, c) { return n + c.keys.length; }, 0);
  if (namesCarried === Object.keys(ICON).length) {
    test.check('and all ' + namesCarried + ' keys are carried, none dropped');
  } else {
    test.fail('names carried ' + namesCarried + ' of ' + Object.keys(ICON).length);
  }

  // ROLODEX is why this cycle started: Contacts and Groups were both 👥,
  // which is a collision no test could see. It has its own picture now.
  const rolodex = choices.filter(function (c) { return c.key === 'ROLODEX'; })[0];
  if (rolodex && rolodex.glyph === '📇' && rolodex.keys.length === 1) {
    test.check('and ROLODEX is a line of its own, aliased to nothing');
  } else {
    test.fail('ROLODEX line: ' + JSON.stringify(rolodex));
  }
}

test.subHeading('No two shipped apps paint the same picture');

{
  // Andy's line is that avoiding collisions between the apps we ship is
  // ours to handle, and it is. This is how the promise gets kept instead
  // of remembered: Contacts and Groups were both 👥 for as long as they
  // were, and nothing said so — setAppOverride refuses a COLLIDING
  // OVERRIDE, but nothing ever compared the shipped defaults to each
  // other.
  //
  // Resolved the way the shell resolves them (ICON[key] || ICON.FILE), so
  // this reads what is actually painted rather than what was meant.
  const fs = require('fs');
  const path = require('path');
  const RUN_DIR = path.join(__dirname, '..', 'run');

  const byGlyph = Object.create(null);
  const literalIcons = [];

  function claim(glyph, who) {
    (byGlyph[glyph] = byGlyph[glyph] || []).push(who);
  }

  fs.readdirSync(path.join(RUN_DIR, 'app')).forEach(function (folder) {
    const manifestPath = path.join(RUN_DIR, 'app', folder, folder + '.json');
    if (!fs.existsSync(manifestPath)) return;
    const shipped = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!shipped.icon) return;
    if (!ICON[shipped.icon]) literalIcons.push('app/' + folder + ' → ' + JSON.stringify(shipped.icon));
    claim(ICON[shipped.icon] || ICON.FILE, 'app/' + folder + ' (' + shipped.icon + ')');
  });

  // The built-ins still registered from index.html, which have no
  // manifest to read — they name their icon as ICON.SOMETHING inline.
  const inline = fs.readFileSync(path.join(RUN_DIR, 'index.html'), 'utf8');
  (inline.match(/icon: ICON\.[A-Z0-9_]+/g) || []).forEach(function (found) {
    const key = found.split('.')[1];
    claim(ICON[key], 'index.html (' + key + ')');
  });

  const collisions = Object.keys(byGlyph).filter(function (g) { return byGlyph[g].length > 1; });
  if (collisions.length === 0) {
    test.check('every shipped app resolves to a picture of its own — ' + Object.keys(byGlyph).length + ' in use');
  } else {
    test.fail('two apps share a glyph: ' + collisions.map(function (g) {
      return g + ' ← ' + byGlyph[g].join(' + ');
    }).join('; '));
  }

  // A manifest's `icon` must be a KEY — kernel.js resolves it through
  // ICON[...] and falls back to FILE when it cannot. A manifest carrying
  // the glyph itself therefore paints 📄 and says nothing about it, which
  // is a failure with no symptom: the app just quietly wears the wrong
  // face. Relay Chat carried a literal "☀️" and showed 📄 for exactly
  // that reason, and nothing said so until this check was written.
  //
  // Now that it is fixed there is no known case left, so this is the
  // whole rule rather than a pin at one exception.
  if (literalIcons.length === 0) {
    test.check('and every manifest names an ICON key, not a glyph of its own');
  } else {
    test.fail('manifests naming a glyph instead of an ICON key: ' + literalIcons.join(', '));
  }
}

test.subHeading('An icon is picked from the pool, never typed');

{
  const fs = require('fs');
  const path = require('path');
  const RUN_DIR = path.join(__dirname, '..', 'run');

  // The two panels that let an operator set an icon: an app's override,
  // and a group's. Both used to be a text box captioned "paste any emoji"
  // that took anything at all and was refused afterwards if something
  // else was already showing it. Both are the picker now, which is not
  // offered a taken glyph in the first place.
  //
  // Checked on the source because the alternative is a full DOM for two
  // apps; narrow enough to mean something — an <input> whose id ends in
  // -icon-input is exactly the control that was removed, and re-adding
  // one is exactly the regression.
  [
    ['app/apps/apps.js', 'the Apps panel'],
    ['app/group-manager/group-manager.js', 'the Groups panel'],
  ].forEach(function (pair) {
    const src = fs.readFileSync(path.join(RUN_DIR, pair[0]), 'utf8');
    const typedIn = src.match(/<input[^>]*id="[a-z-]*icon[a-z-]*"/g) || [];
    const picks = src.indexOf('createIconSelector') !== -1;

    if (picks && typedIn.length === 0) {
      test.check(pair[1] + ' offers the picker and no icon text field');
    } else {
      test.fail(pair[1] + ': createIconSelector ' + picks + ', typed fields ' + JSON.stringify(typedIn));
    }
  });

  // And it comes through api, not the globals. buildApiFor's own comment
  // asks apps to use the doorway; a widget the shell builds is exactly
  // the kind of thing that has no excuse to reach around it (unlike
  // setAppOverride, which no app-scoped api can express).
  [
    ['app/apps/apps.js', 'the Apps panel'],
    ['app/group-manager/group-manager.js', 'the Groups panel'],
  ].forEach(function (pair) {
    const src = fs.readFileSync(path.join(RUN_DIR, pair[0]), 'utf8');
    if (src.indexOf('spirit.shell.ui') === -1 && /\bui\.elements\.createIconSelector/.test(src)) {
      test.check('and reaches it through api, not spirit.shell — ' + pair[1]);
    } else {
      test.fail(pair[1] + ' reaches the selector through the globals');
    }
  });
}

test.reportSuccessFailureCount();
