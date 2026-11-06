# The search elements in spirit/element/search/

goal/G43.18. Its test is `./searchFolder.js`: the tree read as it is, what is there, what is gone and what the code names, and each file loaded on a page. That nothing else changed (*"No behaviour or function changes: renaming only"*) is judged by the moved elements' own suites, moved with them.

Andy: *"all "probabilitySearch" elements follow the EXACT SAME PATTERN."*

## Requirements

- There: `spirit/element/search.js`; under `spirit/element/search/`:
  - `api.js` and `api/verb.js`: *"appServerSelector.js is today's api search in dropdown mode: it becomes search/api.js"*, *"apiFamilySelector.js ... folds into search/api.js"*, *"apiVerbSelector.js is the verb dropdown filter: search/api/verb.js"*.
  - `app.js` and `app/rowElement.js`, from `spirit/app/appSelector/listElement.js` and `rowElement.js`.
  - `contact.js`, `contact/listElement.js`, `contact/rowElement.js`; the same for `icon`, `bundle` and `branch`.
  - `file.js` and `file/rowElement.js`, `grant.js` and `grant/rowElement.js`: *"their listElement becomes search/file.js and search/grant.js, their rowElement stays in the folder."*
  - `valued.js`.
- Gone: `probabilitySearch.js`, `appServerSelector.js`, `apiFamilySelector.js`, `apiVerbSelector.js`, `contactSelector.js` and `contact/`, `files/`, `iconSelector.js` and `icons/`, `bundleSelector.js` and its folder, `branchSelector.js` and its folder, `grantSelector/`, `valued.js`, and `spirit/app/appSelector/listElement.js` and `rowElement.js`.
- The same pattern for all: every name under `search/` is a word, a to z, and every folder sits beside its `<name>.js`.
- *"The apps and elements that require them name the new paths"*: no code, tests included, comments left out, names an old path.
- *"search/api/verb.js, which branch names too"*: `search/api.js` and branch both load it.
- Renaming only, so what loaded before still loads: in a real Chrome on a scratch node's `face.html`, every file in the list above is required through `spirit.require` and answers within 8 seconds. Folding the family selector into `search/api.js` made it and `search/api/verb.js` require each other, and neither loaded. Andy saw it in the agent: *"the bundles fail to pop into a tab, when i click on a bundle, no network activity, no console activity."*

The app search's server filter, node.mount true and active, hidden by default, is judged in a real Chrome by the app search's own suite, `spirit/element/search/app/test/listElement.js`.
