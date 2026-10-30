// spirit/run/shell/navigationWrapper.js
// THE NAVIGATION, AN INTRINSIC SHELL ELEMENT (goal/G40.8). Andy, 2026-10-25: "the stack only holds ONLY navigation.
// ie: an app is only a mountable icon in shell, conceptually, and it simply uses the navigation wrapper as it's top
// container", and "so the shell does ALL the wrapping? agreed."
//
// One stack of pages. A page is a title and something that draws into a box: an app the shell opens is one, a detail
// an app opens is one (the face's login is not: it comes before the link to home, which this file is loaded over).
// Nothing else is on the stack, and nothing is handed back through it: a page
// changes things on the server, and every view hears it on the stream.
//
//   E.navigation.attach(frame)   the shell's frame, once: { title, content, shown(), empty(), apiFor(nav) }:
//                                its title bar's text, the app area every page's box goes into, what to do when the
//                                first page comes and when the last one goes, and the api a page is handed
//   E.navigation.push(page)      page: { title, mount(box, nav), unmount? }. The page gets a box of the whole app area
//                                (space granted top-down: a fill box, shell.css) and draws into it alone; its title and
//                                back are the frame's. Answers its nav: { close(), setTitle(text), isTop(), api }
//   E.navigation.back()          pops the top page: it is thrown away (unmount, its box removed), the one under it
//                                shows again as it was
//   E.navigation.home()          pops them all
//   E.navigation.depth()         how many pages are up

(function () {
  var frame = null;
  var pages = [];   // { title, box, page, nav }, newest last

  function top() { return pages[pages.length - 1] || null; }
  function show() {
    var t = top();
    pages.forEach(function (p) { p.box.hidden = p !== t; });
    if (!frame) return;
    if (!t) { frame.title.textContent = ''; frame.empty(); return; }
    frame.title.textContent = t.title;
    frame.shown();
  }
  function pop(entry) {
    var i = pages.indexOf(entry);
    if (i === -1) return;
    pages.splice(i, 1);
    try { if (typeof entry.page.unmount === 'function') entry.page.unmount(); } catch (e) { /* the page is gone either way */ }
    if (entry.box.parentNode) entry.box.parentNode.removeChild(entry.box);
    show();
  }

  function attach(f) { frame = f; }
  function push(page) {
    if (!frame) throw new Error('navigation: no frame is attached');
    var p = page || {};
    var box = document.createElement('div');
    box.className = 'fill';
    frame.content.appendChild(box);
    var entry = { title: String(p.title || ''), box: box, page: p, nav: null };
    var nav = {
      close: function () { pop(entry); },
      setTitle: function (text) { entry.title = String(text == null ? '' : text); if (top() === entry) frame.title.textContent = entry.title; },
      isTop: function () { return top() === entry; },
    };
    nav.api = typeof frame.apiFor === 'function' ? frame.apiFor(nav) : null;
    entry.nav = nav;
    pages.push(entry);
    show();
    try { if (typeof p.mount === 'function') p.mount(box, nav); }
    catch (e) { pop(entry); throw e; }
    return nav;
  }
  function back() { var t = top(); if (t) pop(t); }
  function home() { while (pages.length) pop(top()); }
  function depth() { return pages.length; }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.navigation = { attach: attach, push: push, back: back, home: home, depth: depth };
}());
