'use strict';

// spirit/test/wslDesktop.js — platform/wsl/desktop, the parts that decide.
//
// Pure functions only: no server is started, no socket is opened, nothing
// is launched. The gate is checked with request-shaped objects, so this
// suite reaches for nothing and oneDoor's count for test/ does not move.

const path = require('path');
const fs = require('fs');
const os = require('os');
const test = require('./testSupport.js');
const desktop = require(path.join(__dirname, '..', '..', 'platform', 'wsl', 'desktop', 'desktop.js'));

test.startTest('The WSL desktop: what becomes an icon, what runs, and who may ask');

test.subHeading('Reading a .desktop entry');

const entry = desktop.parseDesktopEntry([
  '# comment', '[Desktop Entry]', 'Name=Text Editor', 'Name[de]=Texteditor',
  'Exec=gnome-text-editor %U', 'Icon=org.gnome.TextEditor', 'Type=Application',
  '[Desktop Action new-window]', 'Name=New Window', 'Exec=gnome-text-editor --new-window',
].join('\n'));
if (entry.Name === 'Text Editor' && entry.Exec === 'gnome-text-editor %U') {
  test.check('the [Desktop Entry] group is read; a localized Name and an action group are not');
} else {
  test.fail('parsed: ' + JSON.stringify(entry));
}

const hidden = desktop.toApp('x.desktop', { Name: 'X', Exec: 'x', NoDisplay: 'true' });
const link = desktop.toApp('y.desktop', { Name: 'Y', Exec: 'y', Type: 'Link' });
const noExec = desktop.toApp('z.desktop', { Name: 'Z' });
if (hidden === null && link === null && noExec === null) {
  test.check('NoDisplay, a non-Application and an entry with no command never become icons');
} else {
  test.fail('should have been skipped: ' + JSON.stringify([hidden, link, noExec]));
}

test.subHeading('What actually runs');

const split = desktop.splitExec('"/opt/My App/run" --flag %U 100%% "a \\"q\\" b"');
if (JSON.stringify(split) === JSON.stringify(['/opt/My App/run', '--flag', '100%', 'a "q" b'])) {
  test.check('Exec is split as the spec says: quotes group, escapes hold, %U is dropped, %% is a percent');
} else {
  test.fail('split: ' + JSON.stringify(split));
}

const vim = desktop.toApp('vim.desktop', { Name: 'Vim', Exec: 'vim %F', Terminal: 'true' });
const gui = desktop.toApp('ed.desktop', { Name: 'Ed', Exec: 'gnome-text-editor %U' });
if (JSON.stringify(desktop.launchArgv(vim, 'zutty')) === JSON.stringify(['zutty', '-e', 'vim']) &&
    JSON.stringify(desktop.launchArgv(vim, 'gnome-terminal')) === JSON.stringify(['gnome-terminal', '--', 'vim']) &&
    JSON.stringify(desktop.launchArgv(gui, 'zutty')) === JSON.stringify(['gnome-text-editor']) &&
    desktop.launchArgv(vim, null) === null) {
  test.check('a terminal program runs inside a terminal, a window program runs as itself, and with no terminal it is not run');
} else {
  test.fail('launchArgv: ' + JSON.stringify([desktop.launchArgv(vim, 'zutty'), desktop.launchArgv(gui, 'zutty')]));
}

test.subHeading('Scanning, with the first directory winning');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-desktop-'));
const mine = path.join(tmp, 'user');
const sys = path.join(tmp, 'system');
fs.mkdirSync(mine); fs.mkdirSync(sys);
fs.writeFileSync(path.join(mine, 'ed.desktop'), '[Desktop Entry]\nName=My Ed\nExec=myed\n');
fs.writeFileSync(path.join(sys, 'ed.desktop'), '[Desktop Entry]\nName=Ed\nExec=ed\n');
fs.writeFileSync(path.join(sys, 'hid.desktop'), '[Desktop Entry]\nName=Hid\nExec=hid\nNoDisplay=true\n');
const apps = desktop.scanApps([mine, sys, path.join(tmp, 'missing')]);
if (apps.length === 1 && apps[0].name === 'My Ed') {
  test.check('a user entry replaces the system one with the same id, and a missing folder is skipped');
} else {
  test.fail('scanned: ' + JSON.stringify(apps));
}

test.subHeading("Andy's list decides, not what is installed");

fs.writeFileSync(path.join(sys, 'gimp.desktop'), '[Desktop Entry]\nName=GIMP\nExec=gimp %U\n');
fs.writeFileSync(path.join(sys, 'vim.desktop'), '[Desktop Entry]\nName=Vim\nExec=vim %F\nTerminal=true\n');
const listed = desktop.scanApps([mine, sys], ['gimp', 'ed', 'not-installed']);
if (JSON.stringify(listed.map(function (a) { return a.id; })) === JSON.stringify(['gimp', 'ed'])) {
  test.check('only listed ids appear, in the order listed; an unlisted program (vim) and a listed one not installed are left out');
} else {
  test.fail('listed: ' + JSON.stringify(listed.map(function (a) { return a.id; })));
}

const listFile = path.join(tmp, 'apps.json');
fs.writeFileSync(listFile, JSON.stringify({ apps: ['google-chrome'] }));
const fromFile = desktop.loadList(listFile);
const fromNothing = desktop.loadList(path.join(tmp, 'no-such.json'));
fs.writeFileSync(path.join(tmp, 'bad.json'), '{ not json');
const fromBad = desktop.loadList(path.join(tmp, 'bad.json'));
if (JSON.stringify(fromFile) === '["google-chrome"]' && fromNothing.length === 0 && fromBad.length === 0 &&
    desktop.scanApps([mine, sys], fromNothing).length === 0) {
  test.check('a missing or broken list is an empty one, so nothing shows — never a fallback to everything');
} else {
  test.fail('lists: ' + JSON.stringify([fromFile, fromNothing, fromBad]));
}
if (/\.config\/wsl-desktop\/apps\.json$/.test(desktop.listPath({ HOME: '/home/x' })) &&
    desktop.listPath({ HOME: '/home/x', XDG_CONFIG_HOME: '/cfg' }) === '/cfg/wsl-desktop/apps.json') {
  test.check('the list lives on the machine, under ~/.config (or XDG_CONFIG_HOME), outside git');
} else {
  test.fail('listPath: ' + desktop.listPath({ HOME: '/home/x' }));
}

test.subHeading('Who may ask — the same refusal the node has since deb5978');

const PORT = 45480;
function req(headers, addr) {
  return { headers: Object.assign({ host: '127.0.0.1:' + PORT }, headers), socket: { remoteAddress: addr || '127.0.0.1' } };
}
const cases = [
  ['the page itself (own Origin)', req({ origin: 'http://127.0.0.1:' + PORT, 'sec-fetch-site': 'same-origin' }), null],
  ['localhost as the name', req({ host: 'localhost:' + PORT, origin: 'http://localhost:' + PORT }), null],
  ['a script with no Origin', req({}), null],
  ['another site', req({ origin: 'https://evil.example' }), 'refused'],
  ['Origin: null', req({ origin: 'null' }), 'refused'],
  ['cross-site with no Origin', req({ 'sec-fetch-site': 'cross-site' }), 'refused'],
  ['another local port', req({ origin: 'http://127.0.0.1:65432' }), 'refused'],
  ['a rebinding Host', req({ host: 'evil.example:' + PORT }), 'refused'],
  ['from off the machine', req({}, '10.0.0.5'), 'refused'],
];
const wrong = cases.filter(function (c) { return (desktop.refusal(c[1], PORT) === null) !== (c[2] === null); });
if (wrong.length === 0) {
  test.check('own origin and plain scripts pass; another site, null, cross-site, another port, a rebinding Host and a remote address are refused');
} else {
  test.fail('wrong verdict for: ' + wrong.map(function (c) { return c[0]; }).join(', '));
}

test.subHeading('The page');

const html = desktop.page([{ id: 'a"><script>', name: '<b>x</b>', comment: '', icon: '', argv: ['x'], terminal: false }]);
if (html.indexOf('<script>alert') === -1 && html.indexOf('&lt;b&gt;x&lt;/b&gt;') !== -1 && html.indexOf('a&quot;&gt;&lt;script&gt;') !== -1) {
  test.check('a program name or id is escaped before it reaches the page');
} else {
  test.fail('unescaped content in the page');
}

test.reportSuccessFailureCount();
