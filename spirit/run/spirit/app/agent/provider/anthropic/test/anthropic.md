# provider/anthropic/anthropic.js

The Anthropic plugin of the agent (goal/G41.18): it asks Anthropic for its models. Its test is `./anthropic.js`, against
a stand-in provider on 127.0.0.1.

Andy, box v17: *"built in this item - OpenAI plugin - Anthropic plugin"*. A provider row whose label is Anthropic, in
any case, uses it.

## Requirements

- It is a plugin: `models(provider)`, where provider is `{ url, apiKey }`, answers a promise of the provider's model
  list, `[{ modelName, label }]`.
- It asks `GET <url>/v1/models`:
  - The url is the provider's host, `https://api.anthropic.com`. A trailing slash asks the same path.
  - The API key goes as `x-api-key`, and as nothing else: no Authorization header.
  - It sends `anthropic-version: 2023-06-01`, a fixed string and no secret.
- It reads every page: while an answer says `has_more`, it asks again with `after_id` set to that answer's `last_id`.
- Each model of every page is `{ modelName: id, label: display_name }`, in the provider's order.
- An empty `data` list is an answer: the empty list.
- It is refused (the promise rejects) when:
  - the provider answers a status that is not 2xx;
  - the answer is not JSON, or has no `data` list;
  - an answer says `has_more` with no `last_id`, rather than asking again and again;
  - the provider cannot be reached.
- A refusal never carries the API key, even when the provider's own answer echoes it.

## What its test must try to break

- The key sent as a bearer, or the version header missing.
- A list cut at its first page.
- A failed answer taken for an empty list, or for models.
- The key in a refusal's words.
