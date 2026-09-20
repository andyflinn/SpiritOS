# Andys Rules for Agents

**This file answers "how we work". It is not falsified by a commit: it goes stale only when the method changes.** It is the top of the tree and the portable one — a template, carried into any project Andy works on with agents, and a bilateral agreement: it binds Andy as much as the agents, and either side may object to any of it.

All of the following is about adapting to Andy's cognitive patterns. Your job is to help Andy build a system out of Andy's style of reasoning, Andy's way of learning and understanding. That is how you promote his ideas rather than your own.

**The scope of the collaboration is Andy's understanding.** Borrowed from Karpathy's method: what the human can follow is the boundary of what the machine is allowed to add. Work Andy cannot verify is not his system, however well it runs — so the pace is his, the terms are his, and an agent that gets ahead of him has produced something nobody owns.

**That is what `./DICTIONARY.md` is for, and it is the opposite of what it looks like.** It is not a glossary explaining how experts speak so Andy can keep up. It is an analysis of **how Andy speaks** — what he means by a word, recorded in his words. Where his usage and the industry's differ, his is the one this project uses; where he has not drawn a distinction an agent needs, the agent draws it out loud and asks, rather than importing one silently. Agents adapt their language to the dictionary, never the reverse.

## The document set

A project governed this way carries four kinds of file. Names in brackets are this project's instance; the kinds are what ports.

| kind | answers | maintained by | goes stale when |
|---|---|---|---|
| **these rules** [`ANDYS_RULES_FOR_AGENTS.md`] | how we work | Andy. An agent proposes and is expected to name flaws in them | the method changes |
| **the dictionary** [`DICTIONARY.md`] | what Andy means by a word | Andy owns the meanings; an agent records usage it has observed and never redefines a term | Andy's usage changes |
| **the project file** [`AGENT.md`] | what is true in this system, what is settled, what is off limits | the in-studio agent, against the tree, with every correction marked in place; Andy rules on a dispute | the code or the box changes |
| **a per-agent file**, one per agent [`CLAUDE.md`, `GROK.md`] | how THAT agent delivers, and nothing else | that agent and Andy together | that agent's role changes |

**Precedence:** words from the dictionary, facts from the project file, method from these rules. A per-agent file overrides none of them, and a rule that contradicts a layer above it is a mistake in the lower file.

**A rule gets its home at the moment it is stated.** Deferring that is how a method ends up written in an agent's file. A rule that moves leaves one line saying where it went.

**Porting to a new project:** this file goes first and unchanged. The dictionary starts empty and fills as Andy talks. The project file is written by the first agent that reads the tree. A per-agent file is created when a second agent joins, never before — with one agent there is nothing to separate.

## General Rules

1. Your interaction with Andy must always be bounded by Andys Understanding. Short, concise responses are preferred when Andy asks anything. Be brief in your response, and if the brief response cannot be absolutely true, append a one-sentence summary of the caveats. Lengthy responses cause drift in focus.
2. The ./DICTIONARY.md must focus on what Andy means by a term, not the agent. This helps the agent to frame responses short and precisely in terms Andy understands.
3. When entering planning mode, the first thing to determine is the goal of the plan. It maybe a design document, an implementation plan, or an implementation/test cycle.
4. While planning Andy will inject ideas for consideration in realtime. In planning mode you're expected to always have an ear open for redirections in the thought process.
5. both, Andy and the agent may object to closing a discussion.
6. Each cycle complies with the decided spec wherever it touches code, even where later cycles haven't built what it depends on. It leaves a marked seam for them instead of a temporary shape. Later cycles fill seams; they retrofit an earlier cycle only when Andy agrees that cycle failed in the design, and the retrofit is recorded as a supersession in that cycle's document. Where the spec is undecided, ask, don't guess.
7. The agent never asks for approval of a plan while an issue that changes what gets built is unresolved. Before asking, it lists those issues or states there are none; an issue deferred with a recorded reason is not open. If Andy says "not done yet", the agent keeps working the plan and does not ask again until Andy says it's ready or the list is empty.
8. The agent is allowed to comment on flaws in these general rules.

## Andys preferences for  Planning and implementation cycles

This is a working method, not anything about a particular agent. It has two
positions: **in studio** — present in the sitting, with the tree in hand —
and **in review** — reading a checkpoint from outside, in batches. The rules
belong to the positions, and whoever holds one follows them. A reviewer can
read this to see what happens to their findings.

1. A cycle is shaped in four steps: **dream** the whole shape, **pare** it
   to the smallest achievable first step, **clamp** the scope to that
   minimum and say what is left out, **reconcile** the result with the
   vision and the existing rules. Step 4 is the one that gets skipped.
2. Step 4 is the in-studio agent's to run before presenting anything: does
   this break a decided rule, who holds the authority, does it supersede
   something and is that marked, does it promise what it cannot guarantee.
   Andy should only have to trigger it for what only he can see — the
   vision.
3. Corrections run both ways and are marked in place — "this corrects an
   earlier note" — never edited away. A conclusion whose reasoning is
   invisible gets undone by the next reader.
4. "Or not" is a real outcome. Andy cancels features once the cost is
   visible; that is the process working. The cost of waiting is stated, and
   a plan whose premise broke is not pushed further.
5. Plans carry no guarantees. Every plan says what is expected to go wrong
   and what the user sees when it does.
6. Review happens at checkpoints, in batches, and has a shape: findings
   arrive as a list, are triaged into **regressions of closed gates** and
   **design not implemented yet**, and go back and forth two to four rounds
   until the list is settled. Nothing in the sitting waits on a review.
7. A review is input; Andy decides. Where a finding and an agreement made in
   the studio conflict, the agreement wins and the disagreement is recorded
   rather than settled by deferring to the outside voice.
8. An agreement becomes a requirement the moment it is made, and a
   requirement is not done until something verifies it. The mechanism is
   `design/cycles/README.md`; "green" is never the completion report.
