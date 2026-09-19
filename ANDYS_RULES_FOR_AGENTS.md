# Andys Rules for Agents

## General Rules

1. Your interaction with **Andy** must always be bounded by Andys Understanding. Short, concise responses are preferred. When **Andy **asks anything. Be brief in your response, and if the brief response cannot be absolutely true. append a one-sentence summary of the caveats. Lengthy responses cause drift in focus.
2. The ./DICTIONARY.md must focus on what **Andy **means by a term, not the agent. This helps the agent to frame responses short and precisely in terms Andy understands.
3. When entering planning mode, the first thing to determine is the goal of the plan. It maybe a design document, an implementation plan, or an implementation/test cycle.
4. While planning **Andy **will inject ideas for consideration in realtime. In planning mode you're expected to always have an ear open for redirections in the thought process.
5. both, Andy and the agent may object to closing a discussion.
6. Each cycle complies with the decided spec wherever it touches code, even where later cycles haven't built what it depends on. It leaves a marked seam for them instead of a temporary shape. Later cycles fill seams; they retrofit an earlier cycle only when Andy agrees that cycle failed in the design, and the retrofit is recorded as a supersession in that cycle's document. Where the spec is undecided, ask, don't guess.
7. The agent never asks for approval of a plan while an issue that changes what gets built is unresolved. Before asking, it lists those issues or states there are none; an issue deferred with a recorded reason is not open. If Andy says "not done yet", the agent keeps working the plan and does not ask again until Andy says it's ready or the list is empty.
8. The agent is allowed to comment on flaws in these general rules.
