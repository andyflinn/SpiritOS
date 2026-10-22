// spirit/run/process/js/deskAgent/deskAgent.family/api.js
// THE deskAgent SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (face/spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in deskAgent.js: an
// argument the handler cannot do without is required (appServer matches a request's keys exactly, so every key is,
// except where an accepts() lets one out), and each rule is the tightest every value the handler takes still passes.
// deskAgent calls its own verbs through this file for the model's tool calls (tools.js), so the model is held to it
// too. The server checks everything again. A verb added to the server is added here, in the same commit.
module.exports = {
  verbs: {
    abort: {},
    alive: {},
    'chat.answer': { id: 'id' },
    'chat.send': { lines: 'list' },
    clearSignoff: {},
    'command.result': { id: 'id' },
    // timeoutMs 0 is the default timeout (commandRun); the key is still required.
    'command.run': { command: 'id', timeoutMs: 'number' },
    commit: { message: 'id', paths: 'list' },
    connect: { on: 'bool' },
    // A pair's name as connection.json holds it; a hand-written file may hold one the label rule refuses.
    'connection.remove': { name: 'id' },
    // The key may be '' (a local studio asks none); the workspace only when the server asks one (accepts()).
    'connection.set': { name: 'name', url: 'url', key: 'text', workspace: 'text?' },
    'connection.use': { name: 'id' },
    'effort.set': { model: 'text', level: 'id' },
    'file.edit': { path: 'path', old: 'id', new: 'text', all: 'bool' },
    // offset and limit, either or both, make a ranged read (accepts()); 0 is the default for each.
    'file.load': { path: 'path', offset: 'number?', limit: 'number?' },
    'file.save': { path: 'path', content: 'text' },
    // '' is every file, a search by name alone, and the repo root, each in turn.
    'file.search': { pattern: 'text', text: 'text', path: 'text' },
    'model.load': { id: 'id', quant: 'text' },
    'model.test': { id: 'id', quant: 'text' },
    'models.search': { text: 'text', marks: 'list' },
    push: {},
    state: {},
  },
};
