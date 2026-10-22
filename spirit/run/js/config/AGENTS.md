# config: empty, kept for later use

The `config` namespace has no verbs. Its two, config.searchModules and
config.setModules, were deleted with the include list they read and set
(goal/G30.20): where a process server or a shell app runs is its own
manifest's `runs`, `["home"]`, `["home", "face"]` or `[]`, nothing else.
Local (`wire: false`).
