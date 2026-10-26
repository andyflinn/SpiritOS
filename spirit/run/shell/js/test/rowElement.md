# shell/js/rowElement.js

What every row element shares: one element per subject, which paints its fields into the cells it is given, repaints
only the fields a change touches, runs its actions, fetches its expansion once, and registers in its kind's index until
it is destroyed. A list row and a details panel show the same element. It loads on `window.spirit.elements.rowElement`.

## API

- `create(parts)`, where `parts` is `{ kind, key, row, fields: [{ name, paint(row), from }], actions: [{ name, label, run(el, ctx) }], expand(el), index }`.
  It returns `{ kind, key, row, fields, actions, cells(), mount(hosts), apply(changes), act(name, ctx), expandInfo(), destroy() }`.
- `index(subscribe)` returns `{ add(key, el), remove(key, el), forKey(key), keys() }`.

## Requirements

- `kind` and `key` are text. `row` is a copy of `parts.row`, so the caller's object is never written. `fields` lists the
  field names in order. `actions` is `[{ name, label }]`, and the label defaults to the name.
- `cells()` gives `[{ name, html }]` in field order:
  - `html` is `paint(row)` as text when a paint is given, else `row[name]` as text, else `''`.
  - A paint that throws gives `''` and nothing else is lost.
- `mount(hosts)` sets `innerHTML` on each host named by a field and skips a field that has no host. It returns the element.
- `apply(changes)`:
  - Merges the changes into `row`.
  - Repaints a mounted field only when its own value changed, or when a name in its `from` list changed.
  - A value equal to the current one repaints nothing.
  - After `destroy`, it changes nothing.
- `act(name, ctx)` returns a promise of the action's `run(el, ctx)` answer. An unknown name, or an action without `run`,
  gives `null`. A missing `ctx` arrives as `{}`.
- `expandInfo()` calls `expand(el)` once and keeps the answer: every later call returns the same promise. With no
  `expand`, the answer is `null`.
- With an `index` given, `create` registers the element under its key and `destroy` removes it. A second `destroy`
  does nothing. After `destroy`, `mount` hosts are dropped, so `apply` paints nothing.
- `index(subscribe)`:
  - Calls `subscribe(index)` exactly once, on the first `add`.
  - `forKey(key)` gives a copy of the elements registered for that key, or `[]`.
  - A key whose last element leaves is gone from `keys()`.
  - Removing an element that was never registered changes nothing.

## What its test must try to break

- Writing back into the caller's row.
- A throwing paint.
- A host missing for a field.
- An unchanged value in `apply`.
- A status field that repaints only because of `from`.
- `apply` after `destroy`.
- A double `destroy`.
- Two elements under one key.
- Mutating the array `forKey` returns.
- `subscribe` called more than once.
